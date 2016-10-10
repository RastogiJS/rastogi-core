// TODO: maybe adding a reduce function
const eachVersion = (fnMap) => (doc) => Object.keys(doc.versions).map(key => fnMap({snapshot: doc.versions[key], publishedAt: doc.hasOwnProperty('time') ? doc.time[key] : null}))
module.exports = {eachVersion}
