const nsp = require('./datastreams/nsp')
const npm = require('./datastreams/npm')
const Rx = require('rxjs/Rx')
const r = require('rethinkdb')

// / --- start analysis section --
const semver = require('semver')
const memoize = require('memoizee')

const transformAdv = (adv) => {
  if (adv && adv.module_versions.length > 0) {
    const cleanedVers = adv.module_versions.filter(ver => semver.clean(ver))
    return {
      fullSet: cleanedVers,
      vulnSet: new Set(cleanedVers.filter(ver => semver.satisfies(ver, adv.vulnerable_versions))),
      name: adv.module_name,
      publish_date: adv.publish_date
    }
  }
  return {
    advSet: adv.module_versions,
    vulnSet: new Set(),
    name: adv.module_name,
    publish_date: adv.publish_date
  }
}

const checkDependencies = (adv) => (ver) => {
  const deps = ver.snapshot.dependencies || {}
  const res = {
    version: ver.snapshot.version,
    publishedAt: ver.publishedAt,
    count: Object.keys(deps).length,
    inUse: deps.hasOwnProperty(adv.name),
    isAfterAdvisoryPublication: new Date(ver.publishedAt) >= new Date(adv.publish_date)
  }

  if (res.inUse) {
    const depRange = deps[adv.name]
    res.range = depRange
    res.validRange = semver.validRange(depRange)
    if (res.validRange !== null) {
      res.maxSatisfying = semver.maxSatisfying(adv.fullSet, depRange)
      res.minSatisfying = semver.minSatisfying(adv.fullSet, depRange)
      res.maxVuln = adv.vulnSet.has(res.maxSatisfying)
      res.minVuln = adv.vulnSet.has(res.minSatisfying)
    }
  }
  return res
}

const analyze = (fnMap) => (doc) => Object.keys(doc.versions).map(key => fnMap({snapshot: doc.versions[key], publishedAt: doc.hasOwnProperty('time') ? doc.time[key] : null}))
const memoized = memoize(transformAdv)

// / --- end analysis --

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
r.connect({host: '192.168.99.100', port: 32770}, (err, conn) => {
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
        const analyzeDep = analyze(checkDependencies(memoized(adv)))
        const res = {
          id: doc._id,
          adv: adv.module_name,
          'adv-category': adv.category,
          'adv-range': adv.vulnerable_versions,
          'dist-tags': doc['dist-tags'],
          versions: analyzeDep(doc)
        }
        return ({doc: res, adv})
      })
      .subscribe(res => {
        const checkmaxVuln = res.doc.versions.map(ver => ver.maxVuln).reduce((prev, curr) => prev || curr, false)
        const checkminVuln = res.doc.versions.map(ver => ver.minVuln).reduce((prev, curr) => prev || curr, false)

        const insertAdv = r.db('rastogi').table('advisories').insert(res.adv, {conflict: 'update'}).run(connection)
        const insertVuln = r.db('rastogi').table('vulnDep').insert(res, {conflict: 'update'}).run(connection)
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
