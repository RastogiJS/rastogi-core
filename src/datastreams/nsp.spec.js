const test = require('tape')
const nsp = require('./nsp')
const nock = require('nock')

const results = [{
  'id': 134,
  'created_at': '2016-07-27T00:24:38+00:00',
  'updated_at': '2016-09-27T13:11:04+00:00',
  'title': 'Timing attack vulnerability',
  'author': 'unknown',
  'module_name': 'cookie-signature',
  'publish_date': '2016-08-29T14:27:47+00:00',
  'cves': {
  },
  'vulnerable_versions': '<=1.0.5',
  'patched_versions': '>=1.0.6',
  'slug': 'cookie-signature_timing-attack-vulnerability',
  'overview': 'Cookie-signature is a library for signing cookies. Versions before 1.0.4 were vulnerable to timing attacks.',
  'recommendation': 'Upgrade to 1.0.6 or latest',
  'references': 'https://github.com/tj/node-cookie-signature/commit/39791081692e9e14aa62855369e1c7f80fbfd50e',
  'legacy_slug': null,
  'allowed_scopes': [
    'public',
    'early',
    'admin'
  ],
  'cvss_vector': 'CVSS:3.0/AV:N/AC:H/PR:H/UI:R/S:C/C:H/I:N/A:N',
  'cvss_score': 5.4
},
  {
    'id': 140,
    'created_at': '2016-08-15T18:16:57+00:00',
    'updated_at': '2016-08-26T17:28:19+00:00',
    'title': 'Denial of Service',
    'author': 'Matteo Collina',
    'module_name': 'mqtt',
    'publish_date': '2016-08-26T17:28:19+00:00',
    'cves': {
    },
    'vulnerable_versions': '<=0.3.13',
    'patched_versions': '>=1.0.0',
    'slug': 'mqttjs_denial-of-service',
    'overview': 'Specifically crafted MQTT packets can crash the application, making a DoS attack feasible with very little bandwidth.',
    'recommendation': 'Upgrade to v1.0.0 or later',
    'references': '* https://github.com/mqttjs/MQTT.js/blob/388a084d7803934b18b43c1146c817deaa1396b1/lib/parse.js#L230',
    'legacy_slug': null,
    'allowed_scopes': [
      'public',
      'early',
      'admin'
    ],
    'cvss_vector': 'CVSS:3.0/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H',
    'cvss_score': 7.5
  },
  {
    'id': 139,
    'created_at': '2016-08-10T15:05:24+00:00',
    'updated_at': '2016-08-26T17:28:01+00:00',
    'title': 'XSS',
    'author': 'Todd Wolfson',
    'module_name': 'pivottable',
    'publish_date': '2016-08-26T17:28:01+00:00',
    'cves': {
    },
    'vulnerable_versions': '>=1.4.0 <2.0.0',
    'patched_versions': '>=2.0.0',
    'slug': 'pivottable_xss',
    'overview': "PivotTable.js is a Javascript Pivot Table library with drag'n'drop functionality built on top of jQuery/jQueryUI. Due to a change from text to html functions in how JSON elements are rendered, a cross site scripting (XSS) vulnerability was introduced in version 1.4.0. This vulnerability remained in place until version 2.0.0.",
    'recommendation': 'Upgrade to version 2.0.0 or later.',
    'references': '* https://github.com/nicolaskruchten/pivottable/pull/401',
    'legacy_slug': null,
    'allowed_scopes': [
      'public',
      'early',
      'admin'
    ],
    'cvss_vector': 'CVSS:3.0/AV:N/AC:L/PR:N/UI:N/S:C/C:L/I:L/A:N',
    'cvss_score': 7.2
  },
  {
    'id': 138,
    'created_at': '2016-08-08T19:42:49+00:00',
    'updated_at': '2016-08-26T17:27:49+00:00',
    'title': 'XSS via tooltips',
    'author': 'Calvin K Cox',
    'module_name': 'c3',
    'publish_date': '2016-08-26T17:27:49+00:00',
    'cves': {
    },
    'vulnerable_versions': '<=0.4.10',
    'patched_versions': '>=0.4.11',
    'slug': 'c3_xss-via-tooltips',
    'overview': 'c3 is a D3-based reusable chart library that enables deeper integration of charts into web applications. Versions 0.4.10 and lower of c3 contain a cross site scripting (XSS) vulnerability through improper html sanitization on rendered tooltips.',
    'recommendation': 'Upgrade to 0.4.11 or later',
    'references': '* https://github.com/c3js/c3/issues/1536',
    'legacy_slug': null,
    'allowed_scopes': [
      'public',
      'early',
      'admin'
    ],
    'cvss_vector': 'CVSS:3.0/AV:N/AC:L/PR:N/UI:R/S:C/C:N/I:L/A:N',
    'cvss_score': 4.7
  }
]
/*
const movedPositionresults = [
  {
    'id': 140,
    'created_at': '2016-08-15T18:16:57+00:00',
    'updated_at': '2016-08-26T17:28:19+00:00',
    'title': 'Denial of Service',
    'author': 'Matteo Collina',
    'module_name': 'mqtt',
    'publish_date': '2016-08-26T17:28:19+00:00',
    'cves': {
    },
    'vulnerable_versions': '<=0.3.13',
    'patched_versions': '>=1.0.0',
    'slug': 'mqttjs_denial-of-service',
    'overview': 'Specifically crafted MQTT packets can crash the application, making a DoS attack feasible with very little bandwidth.',
    'recommendation': 'Upgrade to v1.0.0 or later',
    'references': '* https://github.com/mqttjs/MQTT.js/blob/388a084d7803934b18b43c1146c817deaa1396b1/lib/parse.js#L230',
    'legacy_slug': null,
    'allowed_scopes': [
      'public',
      'early',
      'admin'
    ],
    'cvss_vector': 'CVSS:3.0/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H',
    'cvss_score': 7.5
  },
  {
    'id': 134,
    'created_at': '2016-07-27T00:24:38+00:00',
    'updated_at': '2016-09-27T13:11:04+00:00',
    'title': 'Timing attack vulnerability',
    'author': 'unknown',
    'module_name': 'cookie-signature',
    'publish_date': '2016-08-29T14:27:47+00:00',
    'cves': {
    },
    'vulnerable_versions': '<=1.0.5',
    'patched_versions': '>=1.0.6',
    'slug': 'cookie-signature_timing-attack-vulnerability',
    'overview': 'Cookie-signature is a library for signing cookies. Versions before 1.0.4 were vulnerable to timing attacks.',
    'recommendation': 'Upgrade to 1.0.6 or latest',
    'references': 'https://github.com/tj/node-cookie-signature/commit/39791081692e9e14aa62855369e1c7f80fbfd50e',
    'legacy_slug': null,
    'allowed_scopes': [
      'public',
      'early',
      'admin'
    ],
    'cvss_vector': 'CVSS:3.0/AV:N/AC:H/PR:H/UI:R/S:C/C:H/I:N/A:N',
    'cvss_score': 5.4
  },
  {
    'id': 139,
    'created_at': '2016-08-10T15:05:24+00:00',
    'updated_at': '2016-08-26T17:28:01+00:00',
    'title': 'XSS',
    'author': 'Todd Wolfson',
    'module_name': 'pivottable',
    'publish_date': '2016-08-26T17:28:01+00:00',
    'cves': {
    },
    'vulnerable_versions': '>=1.4.0 <2.0.0',
    'patched_versions': '>=2.0.0',
    'slug': 'pivottable_xss',
    'overview': "PivotTable.js is a Javascript Pivot Table library with drag'n'drop functionality built on top of jQuery/jQueryUI. Due to a change from text to html functions in how JSON elements are rendered, a cross site scripting (XSS) vulnerability was introduced in version 1.4.0. This vulnerability remained in place until version 2.0.0.",
    'recommendation': 'Upgrade to version 2.0.0 or later.',
    'references': '* https://github.com/nicolaskruchten/pivottable/pull/401',
    'legacy_slug': null,
    'allowed_scopes': [
      'public',
      'early',
      'admin'
    ],
    'cvss_vector': 'CVSS:3.0/AV:N/AC:L/PR:N/UI:N/S:C/C:L/I:L/A:N',
    'cvss_score': 7.2
  },
  {
    'id': 138,
    'created_at': '2016-08-08T19:42:49+00:00',
    'updated_at': '2016-08-26T17:27:49+00:00',
    'title': 'XSS via tooltips',
    'author': 'Calvin K Cox',
    'module_name': 'c3',
    'publish_date': '2016-08-26T17:27:49+00:00',
    'cves': {
    },
    'vulnerable_versions': '<=0.4.10',
    'patched_versions': '>=0.4.11',
    'slug': 'c3_xss-via-tooltips',
    'overview': 'c3 is a D3-based reusable chart library that enables deeper integration of charts into web applications. Versions 0.4.10 and lower of c3 contain a cross site scripting (XSS) vulnerability through improper html sanitization on rendered tooltips.',
    'recommendation': 'Upgrade to 0.4.11 or later',
    'references': '* https://github.com/c3js/c3/issues/1536',
    'legacy_slug': null,
    'allowed_scopes': [
      'public',
      'early',
      'admin'
    ],
    'cvss_vector': 'CVSS:3.0/AV:N/AC:L/PR:N/UI:R/S:C/C:N/I:L/A:N',
    'cvss_score': 4.7
  }
]
*/

const resultsModified = JSON.parse(JSON.stringify(results))
resultsModified[0].updated_at = '2016-07-29T22:30:08+00:00'

const resultsAddedAdvisory = results.slice()

resultsAddedAdvisory.unshift({
  'id': 114,
  'created_at': '2016-05-05T22:29:59+00:00',
  'updated_at': '2016-07-29T22:30:08+00:00',
  'title': 'Insecure Defaults Leads to Potential MITM',
  'author': 'Adam Baldwin',
  'module_name': 'ezseed-transmission',
  'publish_date': '2016-07-29T22:27:11+00:00',
  'cves': {
  },
  'vulnerable_versions': '>= 0.0.10 <= 0.0.14',
  'patched_versions': '>= 0.0.15',
  'slug': 'ezseed-transmission_insecure-defaults-leads-to-potential-mitm',
  'overview': 'ezseed-transmission is a module that provides shell bindings for Ezseed transmission. Between versions 0.0.10 and 0.0.14 (inclusive), ezseed-transmission would download a script from `http://stedolan.github.io/jq/download/linux64/jq` without checking the certificate. An attacker on the same network or on an ISP level could intercept the traffic and push their own version of the file, causing the attackers code to be executed.',
  'recommendation': 'Upgrade to at least version 0.0.15',
  'references': null,
  'legacy_slug': null,
  'allowed_scopes': [
    'public',
    'admin',
    'early'
  ],
  'cvss_vector': 'CVSS:3.0/AV:A/AC:H/PR:N/UI:N/S:U/C:L/I:L/A:N',
  'cvss_score': 4.2
})

const setNockResult = res => nock('https://api.nodesecurity.io:443', {'encodedQueryParams': true})
  .get('/advisories')
  .reply(200, {'total': 116, 'count': 100, 'offset': 0, 'results': res}, { 'cache-control': 'no-cache',
    'content-type': 'application/json; charset=utf-8',
    date: 'Fri, 30 Sep 2016 16:26:29 GMT',
    'strict-transport-security': 'max-age=15768000',
    vary: 'origin,accept-encoding',
    'x-content-type-options': 'nosniff',
    'x-download-options': 'noopen',
    'x-frame-options': 'DENY',
    'x-xss-protection': '1; mode=block',
    connection: 'close',
  'transfer-encoding': 'chunked' })

test('get nsp advisories', (t) => {
  setNockResult(results)
  t.plan(3)
  nsp.get.subscribe(x => {
    t.ok(x.hasOwnProperty('total'), true)
    t.ok(x.hasOwnProperty('count'), true)
    t.ok(x.hasOwnProperty('results'), true)
  }, _ => _, () => t.end())
})

/*
test('no delta shown for shuffled results array', (t) => {
  t.plan(results.length)
  setNockResult(results)
  setTimeout(() => setNockResult(movedPositionresults), 3000)
  const poll = nsp.pollWithdistinctUntilChanged().subscribe(x => {
    t.pass('# of invokes should equal the results array')
  }, _ => _, _ => _)

  setTimeout(() => {
    poll.unsubscribe()
    t.end()
  }, 12000)
})

test('adding a new advisory should yield in #previous advisories + 1', (t) => {
  t.plan(results.length + 1)
  setNockResult(results)
  setTimeout(() => setNockResult(resultsAddedAdvisory), 3000)
  const poll = nsp.pollWithdistinctUntilChanged.subscribe(x => {
    t.pass('# of invokes should equal the results array + delta')
  }, _ => _, _ => _)

  setTimeout(() => {
    poll.unsubscribe()
    t.end()
  }, 12000)
})
*/
/*
FIX: currently we only check for new based on id and not dates
test('modifying an exsisting should yield in #previous advisories + 1', (t) => {
  t.plan(results.length + 2)
  let count = 0
  setNockResult(results)
  setTimeout(() => setNockResult(resultsModified), 3000)

  const poll = nsp.pollWithdistinctUntilChanged().subscribe(x => {
    count = count + 1
    if (count === (results.length + 1)) t.ok(x.updated_at, resultsModified[0].updated_at)
    t.pass('# of invokes should equal the results array + delta')
  }, _ => _, _ => _)

  setTimeout(() => {
    poll.unsubscribe()
    t.end()
  }, 15000)
})
*/
