const npm = require('./npm')
const Rx = require('rxjs/Rx')
const r = require('rethinkdb')

const connect = Rx.Observable.bindNodeCallback(r.connect)

const isSuspect = (doc, advs) => {
  let l = doc['dist-tags'] && doc['dist-tags'].latest
  if (!l) return false
  l = doc.versions && doc.versions[l]
  if (!l || l.deprecated) return false
  var deps = l.dependencies
  if (!deps) return false
  console.log(advs.length)
  const advSet = new Set(advs)
  const res = Object.keys(deps).filter(x => advSet.has(x)) // intersection
  console.log(res)
  if (res.length > 0) return res
}
const queryForAdvisories = r.table('advisories').map(r.row('module_name'))
const queryForAdvisory = (id) => r.db('rastogi').table('advisories').filter({'module_name': id})
// const queryVulnTable = r.table('vulnDep')
const queryAgain = (id) => r.db('rastogi').table('advisories').filter(r.row('module_name').eq(r.db('rastogi').table('vulnDep').get(id).pluck('adv')('adv')))

const inspectDoc = (connection) => (doc) => connection.flatMap(conn => {
  let val = []
  const isExist = (doc) => Rx.Observable.fromPromise(queryAgain(doc._id).run(conn, {db: 'rastogi'}).then(curser => curser.toArray())).flatMap(res => res.length <= 0 ? Rx.Observable.empty() : Rx.Observable.of(res.map(adv => ({adv, doc}))))
  const hasAdvDep = (doc) => Rx.Observable.fromPromise(queryForAdvisories.run(conn, {db: 'rastogi'}).then(curser => curser.toArray())).flatMap(advs => {
    val = isSuspect(doc, advs)
    return val ? Rx.Observable.of({doc, advs: val}) : Rx.Observable.empty()
  }).flatMap(res => Rx.Observable.from(res.advs.map(adv => ({adv: adv, doc: res.doc}))))
    .flatMap(res => Rx.Observable.fromPromise(queryForAdvisory(res.adv).run(conn, {db: 'rastogi'}).then(curser => curser.toArray())), ({doc}, advs) => advs.map(adv => ({adv, doc})))
    .bufferCount(val.length)
  return Rx.Observable.concat(hasAdvDep(doc), isExist(doc)).first(_ => _, _ => _, null)
})

/*
const listenOnChanges = conn => Rx.Observable.create(observer => queryVulnTable.changes().run(conn, {db: 'rastogi'}, (err, cursor) => {
  if (err) observer.error(err)
  const errorStream = Rx.Observable.fromEvent(cursor, 'error', e => {
    throw e
  }).subscribe(observer)
  const dataStream = Rx.Observable.fromEvent(cursor, 'data').subscribe(observer)
  return dataStream.add(errorStream)
}))

const streamCascade = (connection) => connection.flatMap(conn => listenOnChanges(conn))

streamCascade(connection).subscribe(console.log, console.log)

*/
const npmStream = npm.streamJSON$('include_docs=true&since=now').filter(ev => !/^_design/.test(ev.id))

const connection = connect({host: '192.168.99.100', port: 32770}).share()

const checkOnRethink = inspectDoc(connection)

npmStream
  .map(ev => ev.doc)
  .flatMap(doc => checkOnRethink(doc))
  .filter(x => x !== null)
  .subscribe(console.log)
