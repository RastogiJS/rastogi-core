const fetch = require('../utils/fetch')
const Rx = require('rxjs/Rx')

const getNPMSstats = npmid => fetch(`https://api.npms.io/v2/package/${npmid}`)
  .filter(x => x.statusCode === 200)
  .map(x => JSON.parse(x.body))
  .retryWhen(errors => errors
    // log error message
    .do(val => console.log(val))
    // restart in 5 seconds
    .delayWhen(_ => Rx.Observable.timer(10000)))

const getGHstats = npmid => getNPMSstats(npmid).map(x => {
  if (x.collected && x.collected.github) return x
  x.collected.github = {starsCount: 0, forksCount: 0}
  return x
})

const getDownloadstats = npmid => fetch(`https://api.npmjs.org/downloads/point/2016-09-28:2016-10-28/${npmid}`)
  .filter(x => x.statusCode === 200)
  .map(x => JSON.parse(x.body))
  .retryWhen(errors => errors
    // log error message
    .do(val => console.log(val))
    // restart in 5 seconds
    .delayWhen(_ => Rx.Observable.timer(10000)))

module.exports = {getGHstats, getNPMSstats, getDownloadstats}
