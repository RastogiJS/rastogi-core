const npm = require('./npm')
const Rx = require('rxjs/Rx')
const r = require('rethinkdb')
const config = require('config')

// /
// / Helper functions
// /
const isSuspect = (doc, advs) => {
  let l = doc['dist-tags'] && doc['dist-tags'].latest
  if (!l) return []
  l = doc.versions && doc.versions[l]
  if (!l || l.deprecated) return []
  var deps = l.dependencies
  if (!deps) return []
  const advSet = new Set(advs)
  const intersection = Object.keys(deps).filter(x => advSet.has(x)) // intersection
  if (intersection.length > 0) return intersection
  else return []
}
const noop = _ => _

// /
// / Database queries
// /
const getAdvisories = r.table(config.get('rethinkdb.tableAdv')).map(r.row('module_name'))
const queryAdvisories = (ids) => r.table(config.get('rethinkdb.tableAdv')).getAll(r.args(ids), {index: 'module_name'})
const queryExist = (id) => r.table(config.get('rethinkdb.tableAdv')).filter(r.row('module_name').eq(r.table(config.get('rethinkdb.tableVuln')).get(id).pluck('adv')('adv')))

const listAdvisories = (conn) => Rx.Observable.fromPromise(getAdvisories.run(conn, {db: config.get('rethinkdb.db')}).then(curser => curser.toArray()))
const enrichAdvisories = (conn) => (ids) => Rx.Observable.fromPromise(queryAdvisories(ids).run(conn, {db: config.get('rethinkdb.db')}).then(curser => curser.toArray()))
const vulnDocExist = (conn) => (id) => Rx.Observable.fromPromise(queryExist(id).run(conn, {db: config.get('rethinkdb.db')}).then(curser => curser.toArray()))
// /
// / Data streams
// /
const inspectDoc = (conndb) => (cdoc) => conndb.flatMap(connOpen => {
  const inspectDependencies = (doc) => listAdvisories(connOpen)
    .flatMap(advs => {
      const res = isSuspect(doc, advs)
      return res.length > 0 ? Rx.Observable.of(res) : Rx.Observable.empty()
    })
    .flatMap(res => enrichAdvisories(connOpen)(res))
    .map(advs => advs.map(adv => ({adv: adv, doc: doc})))
  const isExist = (doc) => vulnDocExist(connOpen)(doc._id).flatMap(res => res.length <= 0 ? Rx.Observable.empty() : Rx.Observable.of(res.map(adv => ({adv, doc}))))

  return Rx.Observable.concat(inspectDependencies(cdoc), isExist(cdoc)).first(noop, noop, null)
})

const npmStream = npm.streamJSON$('include_docs=true&since=now').filter(ev => !/^_design/.test(ev.id))

const changesStream = (rConn) => {
  const inspectOnRethink = inspectDoc(rConn)
  return npmStream.map(ev => ev.doc).flatMap(doc => inspectOnRethink(doc)).filter(x => x !== null).flatMap(Rx.Observable.from)
}

module.exports = {npmStream, changesStream}

/**
 * Example
 **

const connect = Rx.Observable.bindNodeCallback(r.connect)
const connection = connect(config.get('rethinkdb.connect')).share()

changesStream(connection).subscribe(console.log)

*/
