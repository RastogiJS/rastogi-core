const test = require('tape')
const npm = require('./npm')
const nock = require('nock')

test('getting an arbitrary document from npm', t => {
  const id = 'left-pad'
  nock('https://skimdb.npmjs.com:443', {'encodedQueryParams': true})
    .get('/registry/left-pad')
    .reply(200, {'_id': 'left-pad'}, { server: 'CouchDB/1.6.1 (Erlang OTP/R16B03)',
      etag: '"3-73d823d84a9fbad490e994cf445bc8a0"',
      date: 'Sun, 02 Oct 2016 13:45:27 GMT',
      'content-type': 'text/plain; charset=utf-8',
      'content-length': '14504',
    'cache-control': 'must-revalidate' })

  t.pass(2)
  npm
    .fetchDocument(id)
    .subscribe(res => {
      t.equal(id, res._id, 'the requested document should match with the query id')
    }, _ => _, () => {
      t.pass('should tear down after a single  call')
      t.end()
    })
})

test('getting five documents from a single http call to npm', t => {
  const ids = ['left-pad', 'bassmaster', 'express', 'socket.io', 'mocha']
  nock('https://skimdb.npmjs.com:443', {'encodedQueryParams': true})
    .post('/registry/_all_docs', {'keys': ids})
    .query({'include_docs': 'true'})
    .reply(200, {'total_rows': 333518, 'offset': 0, 'rows': [{'id': 'left-pad', 'key': 'left-pad', 'value': {'rev': '3-73d823d84a9fbad490e994cf445bc8a0'}}, {'id': 'bassmaster', 'key': 'bassmaster', 'value': {'rev': '2-55d907da93cb06bd791044426e618527'}}, {'id': 'express', 'key': 'express', 'value': {'rev': '64-0a328416f861599e85ae17f498468462'}}, {'id': 'socket.io', 'key': 'socket.io', 'value': {'rev': '26-7c6d5f3bcad4a5f2433ead93a61dad86'}}, {'id': 'mocha', 'key': 'mocha', 'value': {'rev': '16-09a956eac8fa5be9d82762694c1b0be5'}}]}, { 'transfer-encoding': 'chunked',
      server: 'CouchDB/1.6.1 (Erlang OTP/R16B03)',
      etag: '"BQ70FFACPA91F78T3SGX11KXT"',
      date: 'Sun, 02 Oct 2016 13:51:02 GMT',
      'content-type': 'text/plain; charset=utf-8',
    'cache-control': 'must-revalidate' })
  t.pass(2)
  npm
    .fetchDocuments(ids)
    .subscribe(res => {
      t.deepEqual(ids, res.rows.map(doc => doc.id), 'the requested document ids should match the query ids')
    }, console.log, () => {
      t.pass('should tear down after a single  call')
      t.end()
    })
})
/* we need env variable
test('fetch all (current and old) dependencies for a document', t => {
  const id = 'bassmaster'
  nock('http://localhost:55590', {'encodedQueryParams': true})
    .get('/registry/_design/app/_view/allDependencies')
    .query({'key': '%22bassmaster%22'})
    .reply(200, {'total_rows': 942574,'offset': 80974,'rows': [{'id': 'snyk-demo-app','key': 'bassmaster','value': 1}, {'id': 'starcount-common','key': 'bassmaster','value': 1}]}, { 'transfer-encoding': 'chunked',
      server: 'CouchDB/1.6.1 (Erlang OTP/17)',
      etag: '"C6WXN2XJATJVJ8KC8ZI7QTFUX"',
      date: 'Sun, 02 Oct 2016 14:54:24 GMT',
      'content-type': 'text/plain; charset=utf-8',
    'cache-control': 'must-revalidate' })

  npm
    .fetchDependencies(id)
    .subscribe(res => {
      res.rows.map(v => t.equal(v.key, id))
    }, _ => _, () => {
      t.pass('should tear down after a single  call')
      t.end()
    })
})
*/

test('streaming of _changes data', t => {
  const stream = npm.streamJSON$().subscribe(x => {
    t.ok(x.hasOwnProperty('seq'), 'has seq attribute')
    t.ok(x.hasOwnProperty('id'), 'has id attribute')
  })
  setTimeout(() => {
    stream.unsubscribe()
    t.end()
  }, 10)
})
