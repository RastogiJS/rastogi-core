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
const setupRethinkDB = (conn) => r.dbList().run(conn)
  .then(list => list.indexOf(config.get('rethinkdb.db')) > -1 ? true : r.dbCreate(config.get('rethinkdb.db')).run(conn))
  .then(_ => r.db(config.get('rethinkdb.db')).tableList().run(conn))
  .then(list => {
    if (!(list.indexOf(config.get('rethinkdb.tableAdv')) > -1) && !(list.indexOf(config.get('rethinkdb.tableVuln')) > -1)) return Promise.all([r.db(config.get('rethinkdb.db')).tableCreate(config.get('rethinkdb.tableAdv')).run(conn), r.db(config.get('rethinkdb.db')).tableCreate(config.get('rethinkdb.tableVuln')).run(conn)])
    else if (!(list.indexOf(config.get('rethinkdb.tableAdv')) > -1) && list.indexOf(config.get('rethinkdb.tableVuln')) > -1) return r.db(config.get('rethinkdb.db')).tableCreate(config.get('rethinkdb.tableAdv')).run(conn)
    else if (list.indexOf(config.get('rethinkdb.tableAdv')) > -1 && !(list.indexOf(config.get('rethinkdb.tableVuln')) > -1)) return r.db(config.get('rethinkdb.db')).tableCreate(config.get('rethinkdb.tableVuln')).run(conn)
    else return true
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
          id: val.doc._id,
          advisories: [],
          'dist-tags': val.doc['dist-tags']
        }
        res.advisories.push({
          adv: val.adv.module_name,
          'adv-category': val.adv.category,
          'adv-range': val.adv.vulnerable_versions,
          versions: memanalyzeDependency(val.adv)(val.doc)
        })

        const checkmaxVuln = res.advisories[0].versions.map(ver => ver.maxVuln).reduce((prev, curr) => prev || curr, false)
        const checkminVuln = res.advisories[0].versions.map(ver => ver.minVuln).reduce((prev, curr) => prev || curr, false)
        const insertAdv = r.db(config.get('rethinkdb.db')).table(config.get('rethinkdb.tableAdv')).insert(val.adv, {conflict: 'update'}).run(connR)
        const insertVuln = r.db(config.get('rethinkdb.db')).table(config.get('rethinkdb.tableVuln')).insert(res, {conflict: 'update'}).run(connR)
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
