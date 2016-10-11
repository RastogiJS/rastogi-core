const memoize = require('memoizee')
const Rx = require('rxjs/Rx')
const r = require('rethinkdb')
const config = require('config')
// TEST
const amqp = require('amqplib/callback_api')
const cluster = require('cluster')
const numCPUs = require('os').cpus().length
const q = 'rastogi'
//
// Data streams
//
const nsp = require('./datastreams/nsp')
const npm = require('./datastreams/npm')
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
// Processing pipeline
//
const processNSP = nsp.get.flatMap(x => Rx.Observable.from(x.results))
  .flatMap(adv => npm.fetchDocument(adv.module_name), (adv, doc) => {
    if (doc && doc.versions) {
      adv.module_versions = Object.keys(doc.versions)
    } else {
      adv.module_versions = []
    }
    adv.category = 'nsp'
    return adv
  })
  .flatMap(adv => npm.fetchDependencies(adv.module_name).flatMap(res => Rx.Observable.from(res.rows)), (adv, doc) => ({adv: adv, dep: doc.id}))
  .flatMap(res => npm.fetchDocument(res.dep), ({adv}, doc) => ({adv, doc}), 50)

//
// AMQP
//
const bail = (err) => {
  console.error(err)
  process.exit(1)
}
const publisher = (conn) => {
  const onOpen = (err, ch) => {
    if (err != null) bail(err)
    ch.assertQueue(q)
    processNSP.subscribe(res => ch.sendToQueue(q, new Buffer(JSON.stringify(res))))
  }
  conn.createChannel(onOpen)
}
const consumer = (connamqp, connR) => {
  const onOpen = (err, ch) => {
    if (err != null) bail(err)
    ch.assertQueue(q)
    ch.prefetch(100)
    ch.consume(q, function (msg) {
      if (msg !== null) {
        const val = JSON.parse(msg.content.toString())
        const res = {
          id: val.doc._id,
          adv: val.adv.module_name,
          'adv-category': val.adv.category,
          'adv-range': val.adv.vulnerable_versions,
          'dist-tags': val.doc['dist-tags'],
          versions: memanalyzeDependency(val.adv)(val.doc)
        }
        const checkmaxVuln = res.versions.map(ver => ver.maxVuln).reduce((prev, curr) => prev || curr, false)
        const checkminVuln = res.versions.map(ver => ver.minVuln).reduce((prev, curr) => prev || curr, false)
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
    amqp.connect('amqp://localhost', (err, connA) => {
      if (err != null) bail(err)
      if (cluster.isMaster) {
        // Fork workers.
        for (var i = 0; i < numCPUs; i++) {
          cluster.fork()
        }
        cluster.on('exit', (worker, code, signal) => {
          console.log(`worker ${worker.process.pid} died`)
        })
        publisher(connA)
      } else {
        consumer(connA, connR)
      }
    })
  })
})
