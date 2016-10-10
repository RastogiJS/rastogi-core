const memoize = require('memoizee')
const Rx = require('rxjs/Rx')
const r = require('rethinkdb')

// Streams dependency
const nsp = require('./datastreams/nsp')
const npm = require('./datastreams/npm')
// Analysis dependency
const nspAnalyzer = require('./analyzer/nsp-analyzer')
const memoizedAdv = memoize(nspAnalyzer.modifyAdvisoryRange)
const analyzeDependency = (adv) => nspAnalyzer.analyze(memoizedAdv(adv))
const memanalyzeDependency = memoize(analyzeDependency)

const processNSP = nsp.get
  .flatMap(x => Rx.Observable.from(x.results))
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

var connection = null
r.connect({host: 'localhost', port: 32770}, (err, conn) => {
  if (err) throw err
  connection = conn

  /* const createdb = r.dbCreate('rastogi').run(connection)
  const createAdv = r.db('rastogi').tableCreate('advisories').run(connection)
  const createVuln = r.db('rastogi').tableCreate('vulnDep').run(connection) */
  // const createdb = Promise.resolve()
  const createAdv = Promise.resolve()
  const createVuln = Promise.resolve()

  Promise.all([createAdv, createVuln]).then(res => {
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

        const insertAdv = r.db('rastogi').table('advisories').insert(res.adv, {conflict: 'update'}).run(connection)
        const insertVuln = r.db('rastogi').table('vulnDep').insert(res.doc, {conflict: 'update'}).run(connection)
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
