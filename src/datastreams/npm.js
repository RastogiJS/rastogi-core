const Rx = require('rxjs/Rx')
const EventSource = require('eventsource')
const fetch = require('../utils/fetch')
const config = require('config')
const couchURL = process.env.NPM_URL || config.get('npm.registry')

// for real-time stream, set param to this: include_docs=true&since=now
const streamRawEvent$ = (param) => Rx.Observable.create((observer) => {
  param = param || ''
  const datasource = new EventSource(`${couchURL}/_changes?feed=eventsource&${param}`)

  const onData = (d) => observer.next(d)
  const onError = (err) => {
    if (err && err.status) {
      observer.error(err)
    }
    console.log(`connection ${err.type} and just reconnected now`)
  }
  datasource.on('open', (d) => console.log(`connection is ${d.type}`))

  datasource.on('message', onData)
  datasource.on('error', onError)

  return () => {
    datasource.removeListener('message', onData)
    datasource.removeListener('error', onError)
    datasource.close()
  }
})

const streamJSON$ = (param) => streamRawEvent$(param).map(e => JSON.parse(e.data))

const fetchDocuments = (keys) => fetch(`${couchURL}/_all_docs?include_docs=true`, JSON.stringify({'keys': keys}))
  .filter(x => x.statusCode === 200)
  .map(x => JSON.parse(x.body))

const fetchDocument = (doc) => fetch(`${couchURL}/${doc}`)
  .filter(x => x.statusCode === 200)
  .map(x => JSON.parse(x.body))

const fetchDependencies = (mod) => fetch(`${couchURL}/_design/app/_view/allDependencies?key="${mod}"`)
  .filter(x => x.statusCode === 200)
  .map(x => JSON.parse(x.body))

const fetchDependedUpon = (mod) => fetch(`${couchURL}/_design/app/_view/dependedUpon?group_level=2&startkey=["${mod}"]&endkey=["${mod}"%2C{}]`)
  .filter(x => x.statusCode === 200)
  .map(x => JSON.parse(x.body))

const dbInfo = fetch(couchURL).filter(x => x.statusCode === 200).map(x => JSON.parse(x.body))

const fetchDependedUponCount = (mod) => fetch(`${couchURL}/_design/app/_view/dependedUpon?startkey=["${mod}"]&endkey=["${mod}"%2C{}]&limit=1&reduce=true&stale=update_after`)
  .filter(x => x.statusCode === 200)
  .map(x => JSON.parse(x.body))
  .retryWhen(errors => errors
    // log error message
    .do(val => console.log(val))
    // restart in 5 seconds
    .delayWhen(_ => Rx.Observable.timer(5000))
)

module.exports = {streamJSON$, streamRawEvent$, fetchDocument, fetchDependencies, fetchDocuments, fetchDependedUpon, fetchDependedUponCount, dbInfo}
