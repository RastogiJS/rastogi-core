const Rx = require('rxjs/Rx')
const fetch = require('../utils/fetch')
const url = require('url')
const path = require('path')

const fetchBower = fetch('http://bower.herokuapp.com/packages')
  .filter(x => x.statusCode === 200)
  .map(x => JSON.parse(x.body))
  .flatMap(Rx.Observable.from)

const fetchBowerJSON = (pathname) => fetch(`https://cdn.rawgit.com${pathname}/master/bower.json`)
  .filter(x => x.statusCode === 200)
  .map(x => JSON.parse(x.body))
  .catch(_ => Rx.Observable.empty())

const getBowerDependencies =
fetchBower
  .map(b => url.parse(b.url).pathname)
  .filter(x => x !== null)
  .map(pathname => {
    const res = path.parse(pathname)
    return `${res.dir}/${res.name}`
  })
  .flatMap(pathname => fetchBowerJSON(pathname), 500)

getBowerDependencies.subscribe(x => console.log(x))
