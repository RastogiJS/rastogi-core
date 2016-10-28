const r = require('rethinkdb')
const config = require('config')
const Rx = require('rxjs/Rx')
const npm = require('../datastreams/npm')

const connect = Rx.Observable.bindNodeCallback(r.connect)
const connection = connect(config.get('rethinkdb.connect')).share()

// /
// / Volume of Vulnerabilities
// /

const queryVuln = r.db(config.get('rethinkdb.db')).table(config.get('rethinkdb.tableVuln')).filter(function (doc) {
  return r.do(doc('versions'), doc('dist-tags')('latest'), function (list, ver) {
    return list.filter(function (lver) { return lver('version').eq(ver) }).hasFields('maxVuln', 'minVuln')
      .withFields('maxVuln', 'minVuln')
      .do(function (val) { return val('maxVuln')(0).eq(true).or(val('minVuln')(0).eq(true)) }) // switch to "or" for getting vulnRange
  })
}).group('adv', 'adv-range').count().ungroup().orderBy(r.desc('reduction'))

const getallVuln = (conn) => Rx.Observable.fromPromise(queryVuln.run(conn, {db: config.get('rethinkdb.db')}).then(curser => curser.toArray()))

const dbCount = npm.dbInfo.map(x => x.doc_count).cache()

const getVulnSum = connection
  .flatMap(conn => getallVuln(conn).flatMap(Rx.Observable.from))
  .flatMap(mod => npm.fetchDependedUponCount(mod.group[0]), (mod, res) => {
    mod.total = res.rows[0].value
    return mod
  })

const vulnStats = getVulnSum.combineLatest(dbCount, (x, y) => {
  x.npmCount = y
  return x
}).map(x => `${x.group[0]}	${x.group[1]}	${x.reduction}	${x.total}	${x.npmCount}`)

// /
// / Oudated Dependencies
// /

vulnStats.subscribe(console.log)
