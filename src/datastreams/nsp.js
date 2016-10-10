const fetch = require('../utils/fetch')
const Rx = require('rxjs/Rx')
const config = require('config')

// /
// /  Diff such that we only get added or edited delta (e.g new or updated advisories)
// /

const isInt = (value) => {
  let x
  if (isNaN(value)) {
    return false
  }
  x = parseFloat(value)
  return (x | 0) === x
}

const differ = require('jsondiffpatch').create({
  objectHash: obj => obj._id || obj.id,
  arrays: {
    detectMove: true,
    includeValueOnMove: false
  },
  cloneDiffValues: false
})

const diff = source => Rx.Observable.create(observer => {
  let cache = []
  source.subscribe(x => {
    const delta = differ.diff(cache, x.results)
    cache = x.results
    if (delta !== undefined) Object.keys(delta).filter(k => isInt(k)).map(k => x.results[k]).map(x => observer.next(x))
  }, err => observer.error(err), () => observer.complete())
})

// /
// /  Get and poll of advisories
// /
const get = fetch(process.env.NSP_URL || config.get('nsp.advisories')).filter(x => x.statusCode === 200).map(x => JSON.parse(x.body))

const poll = get.merge(Rx.Observable.interval(config.get('nsp.refreshInterval')).switchMapTo(get))

const pollWithdistinctUntilChanged = diff(poll)

module.exports = {poll, get, pollWithdistinctUntilChanged, diff}
