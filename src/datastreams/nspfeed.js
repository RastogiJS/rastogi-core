const Rx = require('rxjs/Rx')
const nsp = require('./nsp')
const npm = require('./npm')

const nspFeed = nsp.pollWithdistinctUntilChanged()
  .flatMap(adv => npm.fetchDocument(adv.module_name), (adv, doc) => {
    if (doc && doc.versions) {
      adv.module_versions = Object.keys(doc.versions)
    } else {
      adv.module_versions = []
    }
    adv.category = 'nsp'
    return adv
  })
  .flatMap(adv => npm.fetchDependencies(adv.module_name).flatMap(res => Rx.Observable.from(res.rows)), (adv, doc) => ({adv: adv, dep: doc.id}))
  .flatMap(res => npm.fetchDocument(res.dep), ({adv}, doc) => ({adv, doc}), 50)

module.exports = nspFeed
