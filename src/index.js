const memoize = require('memoizee')
const Rx = require('rxjs/Rx')
const r = require('rethinkdb')
const config = require('config')
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
const processNSP = nsp.pollWithdistinctUntilChanged
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

r.connect(config.get('rethinkdb.connect'), (err, conn) => {
  if (err) throw err

  setupRethinkDB(conn).then(_ => {
    processNSP
      .map(({adv, doc}) => {
        const res = {
          id: doc._id,
          adv: adv.module_name,
          'adv-category': adv.category,
          'adv-range': adv.vulnerable_versions,
          'dist-tags': doc['dist-tags'],
          versions: memanalyzeDependency(adv)(doc)
        }
        return ({doc: res, adv})
      })
      .subscribe(res => {
        const checkmaxVuln = res.doc.versions.map(ver => ver.maxVuln).reduce((prev, curr) => prev || curr, false)
        const checkminVuln = res.doc.versions.map(ver => ver.minVuln).reduce((prev, curr) => prev || curr, false)

        const insertAdv = r.db(config.get('rethinkdb.db')).table(config.get('rethinkdb.tableAdv')).insert(res.adv, {conflict: 'update'}).run(conn)
        const insertVuln = r.db(config.get('rethinkdb.db')).table(config.get('rethinkdb.tableVuln')).insert(res.doc, {conflict: 'update'}).run(conn)
        if (checkmaxVuln || checkminVuln) {
          Promise.all([insertAdv, insertVuln]).then(res => {
            console.log(JSON.stringify(res))
          })
        } else {
          insertAdv.then(x => console.log(JSON.stringify(x)))
        }
      }, console.log, () => console.log('complete'))
  })
})
