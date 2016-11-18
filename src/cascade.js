const Rx = require('rxjs/Rx')
const r = require('rethinkdb')
const config = require('config')
const npm = require('./datastreams/npm')
const semver = require('semver')
const stats = require('./stats/stats')
const cytoscape = require('cytoscape')
const fs = require('fs')
// /
// / Setup DB connection
// /
const connect = Rx.Observable.bindNodeCallback(r.connect)
const connection = connect(config.get('rethinkdb.connect')).share()

// /
// / RethinkDB Queries
// /
const queryAdvisories = r.db('rastogi').table('advisories').pluck('module_name', 'vulnerable_versions').limit(3)

const getAdvisories = (conn) => Rx.Observable.fromPromise(queryAdvisories.run(conn).then(cursor => cursor.toArray()))

// /
// / Data Sources
// /
let liveConn = null
const rootNodes = connection.do(conn => {
  liveConn = conn
}).flatMap(conn => getAdvisories(conn)).flatMap(Rx.Observable.from)

const searchDependencies = root => npm.fetchDependedUponAll(root.npmid).map(res => ({root, children: res.rows}))
  .flatMap(res => Rx.Observable.from(res.children)
    .map(child => ({
      npmid: child.key[1],
      parentid: child.key[0],
      vulnVersions: new Set(child.value.filter(pair => {
        const range = pair[Object.keys(pair)[0]]
        const maxResolvedVersion = semver.maxSatisfying(res.root.allVersions, range)
        const maxVuln = res.root.vulnVersions.has(maxResolvedVersion)
        return maxVuln
      }).map(pair => Object.keys(pair)[0]).filter(ver => semver.clean(ver))),
      allVersions: child.value.map(pair => Object.keys(pair)[0]).filter(ver => semver.clean(ver)),
      latest: child.key[2]
    })))
  .filter(child => child.vulnVersions.size > 0)
  .map(child => {
    child.latest = child.vulnVersions.has(child.latest)
    return child
  })

const statics = npmid => {
  return Rx.Observable.forkJoin(stats.getGHstats(npmid), stats.getDownloadstats(npmid))
}

// /
// / Graph construction
// /

const createDepGraph = (root, cy) => {
  const nodeExist = node => {
    if (cy.getElementById(node.npmid).length > 0) {
      const existing = cy.getElementById(node.npmid)[0].data().vulnVersions
      const diff = new Set([...node.vulnVersions].filter(x => !existing.has(x)))
      if (diff.size > 0) {
        const merged = new Set([...existing, ...node.vulnVersions])
        cy.getElementById(node.npmid)[0].data('vulnVersions', merged)
        node.vulnVersions = merged
        return {node, exist: true, proceed: true}
      } else {
        return {node, proceed: false, exist: true}
      }
    } else {
      return {node, proceed: true, exist: false}
    }
  }
  return Rx.Observable.of(root)
    .filter(adv => semver.validRange(adv.range) !== null)
    .flatMap(adv => npm.fetchDocument(adv.npmid), (adv, res) => {
      adv.allVersions = Object.keys(res.versions).filter(ver => semver.clean(ver))
      adv.vulnVersions = new Set(adv.allVersions.filter(ver => semver.satisfies(ver, adv.range)))
      return adv
    })
    .expand(rawnode => {
      const {node, exist, proceed} = nodeExist(rawnode)
      if (!exist && proceed) {
        return statics(node.npmid).flatMap(stats => {
          if (!node.parentid) {
            cy.add({data: { id: node.npmid, downloads: stats[1].downloads, stars: stats[0].collected.github.starsCount, forks: stats[0].collected.github.forksCount, vulnVersions: node.vulnVersions }})
          } else {
            cy.add({data: { id: node.npmid, downloads: stats[1].downloads || null, stars: stats[0].collected.github.starsCount, forks: stats[0].collected.github.forksCount, vulnVersions: node.vulnVersions }})
            cy.add({data: {source: node.parentid, target: node.npmid, latest: node.latest}})
          }
          return searchDependencies(node)
        })
      } else if (exist && proceed) {
        console.log(node)
        cy.add({data: {source: node.parentid, target: node.npmid, latest: node.latest}})
        return searchDependencies(node)
      } else {
        cy.add({data: {source: node.parentid, target: node.npmid, latest: node.latest}})
        return Rx.Observable.empty()
      }
    }, 1) // we need process one at a time (e.g like concatMap)
}

const buildDependencyTree = root => {
  const cy = cytoscape({})
  return Rx.Observable.create(observer => createDepGraph(root, cy).subscribe(_ => _, err => observer.error(err), () => {
    observer.next({cy, root})
    observer.complete()
  }))
}

// /
// / Main
// /

/**
v The current node.
e The edge connecting the previous node to the current node.
u The previous node.
 */

rootNodes.flatMap(node => {
  return buildDependencyTree({npmid: node.module_name, range: node.vulnerable_versions})
}, 2).map(x => {
  x.cy.elements().bfs({ // or dfs
    root: x.cy.getElementById(x.root.npmid),
    visit: (i, depth, v, e, u) => {
      v.data('depth', depth)
    },
    directed: false // or your preference
  })
  return {npmid: x.root.npmid, cy: x.cy}
}).map(x => {
  const visitedNodes = []
  const root = x.cy.getElementById(x.npmid).data()
  visitedNodes.push(`${root.id}	${null}	${null}	${root.depth}	${root.downloads}	${root.stars}	${root.forks}`)
  x.cy.edges().forEach(function (ele) {
    const edgeData = ele.data()
    const nodeData = x.cy.getElementById(edgeData.target).data()
    visitedNodes.push(`${nodeData.id}	${edgeData.source}	${edgeData.latest}	${nodeData.depth}	${nodeData.downloads}	${nodeData.stars}	${nodeData.forks}`)
  })
  return {npmid: x.npmid, visitedNodes}
}).subscribe(x => {
  const file = fs.createWriteStream(`res/${x.npmid}-${Math.random()}.csv`)
  file.on('error', (err) => console.log(err))
  x.visitedNodes.forEach(v => file.write(v + '\n'))
  file.end()
}, console.log, () => liveConn.close())
