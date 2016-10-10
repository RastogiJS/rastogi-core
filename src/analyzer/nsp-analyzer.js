const semver = require('semver')
const analyzer = require('./')

const inspectDependencies = (adv) => (ver) => {
  const deps = ver.snapshot.dependencies || {}

  const res = {
    version: ver.snapshot.version,
    publishedAt: ver.publishedAt,
    count: Object.keys(deps).length,
    inUse: deps.hasOwnProperty(adv.name),
    isAfterAdvisoryPublication: new Date(ver.publishedAt) >= new Date(adv.publish_date)
  }
  if (res.inUse) {
    const depRange = deps[adv.name]
    res.range = depRange
    res.validRange = semver.validRange(depRange)
    if (res.validRange !== null) {
      res.maxSatisfying = semver.maxSatisfying(adv.fullSet, depRange)
      res.minSatisfying = semver.minSatisfying(adv.fullSet, depRange)
      res.satisfied = [...adv.vulnSet].filter(ver => semver.satisfies(ver, depRange))
      res.maxVuln = adv.vulnSet.has(res.maxSatisfying)
      res.minVuln = adv.vulnSet.has(res.minSatisfying)
    }
  }
  return res
}

const modifyAdvisoryRange = (adv) => {
  if (adv && adv.module_versions.length > 0) {
    const cleanedVers = adv.module_versions.filter(ver => semver.clean(ver))
    return {
      fullSet: cleanedVers,
      vulnSet: new Set(cleanedVers.filter(ver => semver.satisfies(ver, adv.vulnerable_versions))),
      name: adv.module_name,
      publish_date: adv.publish_date
    }
  }
  return {
    advSet: adv.module_versions,
    vulnSet: new Set(),
    name: adv.module_name,
    publish_date: adv.publish_date
  }
}

const analyze = (adv) => analyzer.eachVersion(inspectDependencies(adv))

module.exports = {analyze, inspectDependencies, modifyAdvisoryRange}
