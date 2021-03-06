const fetch = require('../utils/fetch')
const Rx = require('rxjs/Rx')
const config = require('config')
const Loki = require('lokijs')

// /
// /  Get and poll of advisories
// /
const get = fetch(process.env.NSP_URL || config.get('nsp.advisories')).filter(x => x.statusCode === 200).map(x => JSON.parse(x.body))

const getWithOffset = (offset, fetchCount) => fetch(`${process.env.NSP_URL || config.get('nsp.advisories')}?offset=${offset || 0}`)
  .filter(x => x.statusCode === 200)
  .map(x => JSON.parse(x.body))
  .map(x => {
    x.fetchCount = x.count + (fetchCount || 0)
    return x
  })

const getAll = getWithOffset().expand(res => res.fetchCount === res.total ? Rx.Observable.empty() : getWithOffset(res.count, res.fetchCount))

const poll = getAll.merge(Rx.Observable.interval(config.get('nsp.refreshInterval')).switchMapTo(getAll))

const pollWithdistinctUntilChanged = () => {
  const db = new Loki('nsp.json')
  const adv = db.addCollection('advisories')
  return poll.do(_ => console.log(`[${new Date().toISOString()}] checked for new advisories`)).flatMap(x => Rx.Observable.from(x.results)).filter(a => adv.findOne({id: a.id}) === null).do(a => adv.insert(a))
}

module.exports = {poll, get, pollWithdistinctUntilChanged}
