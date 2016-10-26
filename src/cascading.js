const Rx = require('rxjs/Rx')
const r = require('rethinkdb')
const semver = require('semver')
const npm = require('./datastreams/npm')

const connect = Rx.Observable.bindNodeCallback(r.connect)
const connection = connect({host: 'localhost', port: '55570'}).share()

const getAllVulnerable = r.db('rastogi').table('vulndependencies').filter({'adv': 'shell-quote'}).filter(function (doc) {
  return r.do(doc('versions'), doc('dist-tags')('latest'), function (list, ver) {
    return list.filter(function (lver) {
      return lver('version').eq(ver)
    }).hasFields('maxVuln', 'minVuln')
      .withFields('maxVuln', 'minVuln')
      .do(function (val) {
        return val('maxVuln')(0).eq(true).and(val('minVuln')(0).eq(true))
      })
  })
})

const getDependedUpon = npmid => npm
  .fetchDependedUpon(npmid)
  .filter(res => res.rows.length > 0)
  .flatMap(res => Rx.Observable.forkJoin(res.rows.map(o => npm.fetchDocument(o.key[1]))), (res, doc) => {
    res.rows.map((e, i) => {
      e.doc = doc[i]
    })
    return {
      name: npmid,
      children: res.rows.map(r => {
        var l = r.doc['dist-tags'] && r.doc['dist-tags'].latest
        if (!l) return
        l = r.doc.versions && r.doc.versions[l]
        if (!l || l.deprecated) return
        var d = l.dependencies
        return ({name: r.doc._id, parent: npmid, range: d[npmid], version: r.doc['dist-tags'].latest, versions: Object.keys(r.doc.versions)})
      })
    }
  })

const markVulnerableDep = top => getDependedUpon(top.npmid).map(res => {
  res.children = res.children.map(child => {
    child.validRange = semver.validRange(child.range)
    if (child.validRange !== null) {
      child.maxSatisfying = semver.maxSatisfying(top.adv.fullSet, child.range)
      child.minSatisfying = semver.minSatisfying(top.adv.fullSet, child.range)
      //  child.satisfied = [...top.adv.vulnSet].filter(ver => semver.satisfies(ver, child.range))
      child.maxVuln = top.adv.vulnSet.has(child.maxSatisfying)
      child.minVuln = top.adv.vulnSet.has(child.minSatisfying)
      if (child.maxVuln === true) {
        child.adv = {
          fullSet: child.versions.filter(ver => semver.clean(ver)),
          vulnSet: new Set([child.version])
        }
      }
    } else {
      child.maxVuln = false
      child.minVuln = false
    }
    return child
  }).filter(x => x.maxVuln === true)
  return res
})

let nodes = []
let edges = []

const buildDependencyTree = top => markVulnerableDep(top).expand(res => {
  if (res.children.length > 0) {
    res.children.map(o => edges.push({ data: {source: o.parent, target: o.name} }))
    const unmarked = res.children.filter(o => !(nodes.indexOf(o.name) > -1))
    unmarked.map(o => nodes.push(o.name))
    if (unmarked.length > 0) return Rx.Observable.forkJoin(unmarked.map(o => markVulnerableDep({npmid: o.name, adv: o.adv}))).flatMap(Rx.Observable.from)
    else return Rx.Observable.empty() // We have no more to check
  } else {
    return Rx.Observable.empty() // We are complete
  }
})

let liveConn = null
connection
  .do(conn => {
    liveConn = conn
  })
  .flatMap(conn => Rx.Observable.fromPromise(getAllVulnerable.run(conn).then(cursor => cursor.toArray())))
  .flatMap(Rx.Observable.from)
  .concatMap(res => {
    if (!(nodes.indexOf(res.adv) > -1)) {
      nodes.push(res.adv)
    }
    nodes.push(res.npmid)
    edges.push({data: {source: res.adv, target: res.npmid}})
    return buildDependencyTree(({npmid: res.npmid, adv: {fullSet: res.versions.map(v => v.version).filter(ver => semver.clean(ver)), vulnSet: new Set(res.versions.filter(ver => semver.clean(ver.version)).filter(ver => ver.maxVuln === true && ver.minVuln === true).map(v => v.version))}}))
  })
  .subscribe(x => x, console.log, () => {
    liveConn.close()
    const graph = {
      elements: {
        nodes: nodes.map(id => ({ data: { id: id } })),
        edges: edges
      }
    }
    console.log(JSON.stringify(graph))
  })

  /* .flatMap(cursor => Rx.Observable.create(observer => {
     const data = Rx.Observable.fromEvent(cursor, 'data').subscribe(observer)
     const error = Rx.Observable.fromEvent(cursor, 'error').subscribe(observer)
     return data.add(error)
   })).concatMap(res => buildDependencyTree(res.npmid), (adv, res) => ({start: adv.adv, range: adv['adv-range'], res})) */

  /*
  let liveConn = null
  connection
    .do(conn => {
      liveConn = conn
    })
    .flatMap(conn => Rx.Observable.fromPromise(getAllVulnerable.run(conn).then(cursor => cursor.toArray())))
    .flatMap(Rx.Observable.from)
    .concatMap(x => markVulnerableDep({npmid: x.npmid, adv: {fullSet: x.versions.map(v => v.version).filter(ver => semver.clean(ver)), vulnSet: new Set(x.versions.filter(ver => semver.clean(ver.version)).filter(ver => ver.maxVuln === true && ver.minVuln === true).map(v => v.version))}}))
    .filter(x => x.children.length > 0)
    .subscribe(x => console.log(JSON.stringify(x)), console.log, () => {
      liveConn.close()
      console.log('complete')
    })
  */
