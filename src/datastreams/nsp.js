const fetch = require('../utils/fetch')
const Rx = require('rxjs/Rx')
const config = require('config')
const Loki = require('lokijs')

// /
// /  Get and poll of advisories
// /
const get = fetch(process.env.NSP_URL || config.get('nsp.advisories')).filter(x => x.statusCode === 200).map(x => JSON.parse(x.body))

const poll = get.merge(Rx.Observable.interval(config.get('nsp.refreshInterval')).switchMapTo(get))

const pollWithdistinctUntilChanged = () => {
  const db = new Loki('nsp.json')
  const adv = db.addCollection('advisories')
  return poll.flatMap(x => Rx.Observable.from(x.results)).filter(a => adv.findOne({id: a.id}) === null).do(a => adv.insert(a))
}

module.exports = {poll, get, pollWithdistinctUntilChanged}
