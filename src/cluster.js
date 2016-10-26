const memoize = require('memoizee')
const r = require('rethinkdb')
const config = require('config')
const Rx = require('rxjs/Rx')

const amqp = require('amqplib/callback_api')
const cluster = require('cluster')
const numCPUs = require('os').cpus().length
const q = 'rastogi'

const nspfeed = require('./datastreams/nspfeed')
const changesFeed = require('./datastreams/changesfeed').changesStream
//
// Analyzer nsp-dependencies
//
const nspAnalyzer = require('./analyzer/nsp-analyzer')
const memoizedAdv = memoize(nspAnalyzer.modifyAdvisoryRange)
const analyzeDependency = (adv) => nspAnalyzer.analyze(memoizedAdv(adv))
const memanalyzeDependency = memoize(analyzeDependency)
//
// Setup rethinkdb
//

// / create compound indexes

const createVulnTableAndIndex = (conn) => r.db(config.get('rethinkdb.db')).tableCreate(config.get('rethinkdb.tableVuln')).run(conn)
  .then(_ => r.db(config.get('rethinkdb.db')).table(config.get('rethinkdb.tableVuln')).indexCreate('rastogi_id', [r.row('npmid'), r.row('adv'), r.row('adv-range')]).run(conn))

const createAdvTableAndIndex = (conn) => r.db(config.get('rethinkdb.db')).tableCreate(config.get('rethinkdb.tableAdv')).run(conn)
  .then(_ => r.db(config.get('rethinkdb.db')).table(config.get('rethinkdb.tableAdv')).indexCreate('module_name').run(conn))

const setupRethinkDB = (conn) => r.dbList().run(conn)
  .then(list => list.indexOf(config.get('rethinkdb.db')) > -1 ? true : r.dbCreate(config.get('rethinkdb.db')).run(conn))
  .then(_ => r.db(config.get('rethinkdb.db')).tableList().run(conn))
  .then(list => {
    if (!(list.indexOf(config.get('rethinkdb.tableAdv')) > -1) && !(list.indexOf(config.get('rethinkdb.tableVuln')) > -1)) return Promise.all([createVulnTableAndIndex(conn), createAdvTableAndIndex(conn)])
    else if (!(list.indexOf(config.get('rethinkdb.tableAdv')) > -1) && list.indexOf(config.get('rethinkdb.tableVuln')) > -1) return createAdvTableAndIndex(conn)
    else if (list.indexOf(config.get('rethinkdb.tableAdv')) > -1 && !(list.indexOf(config.get('rethinkdb.tableVuln')) > -1)) return createVulnTableAndIndex(conn)
    else return true
  })

const insertToRethink = (doc) => r.do(
  r.db(config.get('rethinkdb.db')).table(config.get('rethinkdb.tableVuln')).getAll([doc.npmid, doc.adv, doc['adv-range']], {index: 'rastogi_id'}).coerceTo('array'), function (res) {
    return r.branch(res.count().eq(1),
      r.db(config.get('rethinkdb.db')).table(config.get('rethinkdb.tableVuln')).get(res('id')(0)).replace(res.pluck('id')(0).merge(doc)),
      r.db(config.get('rethinkdb.db')).table(config.get('rethinkdb.tableVuln')).insert(doc))
  })

//
// AMQP
//
const bail = (err) => {
  console.error(err)
  process.exit(1)
}
const publisher = (conn, connR) => {
  const onOpen = (err, ch) => {
    if (err != null) bail(err)
    ch.assertQueue(q)
    Rx.Observable.merge(nspfeed, changesFeed(connR)).subscribe(res => ch.sendToQueue(q, new Buffer(JSON.stringify(res))))
  }
  conn.createChannel(onOpen)
}
const consumer = (connamqp, connR) => {
  const onOpen = (err, ch) => {
    if (err != null) bail(err)
    ch.assertQueue(q)
    ch.prefetch(config.get('amqp.prefetch'))
    ch.consume(q, function (msg) {
      if (msg !== null) {
        const val = JSON.parse(msg.content.toString())
        const res = {
          npmid: val.doc._id,
          'dist-tags': val.doc['dist-tags'],
          adv: val.adv.module_name,
          'adv-category': val.adv.category,
          'adv-range': val.adv.vulnerable_versions,
          versions: memanalyzeDependency(val.adv)(val.doc)
        }

        const checkmaxVuln = res.versions.map(ver => ver.maxVuln).reduce((prev, curr) => prev || curr, false)
        const checkminVuln = res.versions.map(ver => ver.minVuln).reduce((prev, curr) => prev || curr, false)
        const insertAdv = r.db(config.get('rethinkdb.db')).table(config.get('rethinkdb.tableAdv')).insert(val.adv, {conflict: 'update'}).run(connR)
        // const insertVuln = r.db(config.get('rethinkdb.db')).table(config.get('rethinkdb.tableVuln')).insert(res, {conflict: 'update'}).run(connR)
        const insertVuln = insertToRethink(res).run(connR)
        if (checkmaxVuln || checkminVuln) {
          Promise.all([insertAdv, insertVuln]).then(res => {
            console.log(JSON.stringify(res))
            ch.ack(msg)
          })
        } else {
          insertAdv.then(x => console.log(JSON.stringify(x)))
          ch.ack(msg)
        }
      }
    })
  }
  connamqp.createChannel(onOpen)
}

r.connect(config.get('rethinkdb.connect'), (err, connR) => {
  if (err) throw err
  setupRethinkDB(connR).then(_ => {
    amqp.connect(`amqp://${config.get('amqp.host')}:${config.get('amqp.port')}`, (err, connA) => {
      if (err != null) bail(err)
      if (cluster.isMaster) {
        // Fork workers.
        for (var i = 0; i < numCPUs; i++) {
          cluster.fork()
        }
        cluster.on('exit', (worker, code, signal) => {
          console.log(`worker ${worker.process.pid} died`)
        })
        // FIX: we should follow one style
        const connect = Rx.Observable.bindNodeCallback(r.connect)
        const connection = connect(config.get('rethinkdb.connect')).share()
        publisher(connA, connection)
      } else {
        consumer(connA, connR)
      }
    })
  })
})
