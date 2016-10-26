const npm = require('./datastreams/npm')
npm.fetchDependedUponCount('express')
  .subscribe(x => console.log(x.rows[0].value))
