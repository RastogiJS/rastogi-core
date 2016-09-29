const test = require('tape')
const nock = require('nock')
const fetch = require('./fetch')

test('http get with status code 200', (assert) => {
  assert.plan(2)
  const expected = {
    _id: '123ABC',
    _rev: '946B7D1C',
    username: 'pgte',
    email: 'pedro.teixeira@gmail.com'
  }
  nock('http://myapp.iriscouch.com').get('/users/1').reply(200, expected)

  fetch('http://myapp.iriscouch.com/users/1')
    .subscribe(res => {
      assert.ok(res.statusCode, 200)
      assert.ok(JSON.parse(res.body), expected, 'the json object should be equal')
    }, _ => _, () => assert.end())
})

test('https get with status code 200', (assert) => {
  assert.plan(2)
  const expected = {
    _id: '123ABC',
    _rev: '946B7D1C',
    username: 'pgte',
    email: 'pedro.teixeira@gmail.com'
  }
  nock('https://myapp.iriscouch.com').get('/users/1').reply(200, expected)

  fetch('https://myapp.iriscouch.com/users/1')
    .subscribe(res => {
      assert.ok(res.statusCode, 200)
      assert.ok(JSON.parse(res.body), expected, 'the json object should be equal')
    }, _ => _, () => assert.end())
})

test('http get with status code 200', (assert) => {
  assert.plan(2)
  const expected = {
    _id: '123ABC',
    _rev: '946B7D1C',
    username: 'pgte',
    email: 'pedro.teixeira@gmail.com'
  }
  nock('http://myapp.iriscouch.com').get('/users/1').reply(200, expected)

  fetch('http://myapp.iriscouch.com/users/1')
    .subscribe(res => {
      assert.ok(res.statusCode, 200)
      assert.ok(JSON.parse(res.body), expected, 'the json object should be equal')
    }, _ => _, () => assert.end())
})
test('http get with status code 404', (assert) => {
  assert.plan(2)
  const expected = {statusCode: 404, error: 'Not Found'}
  nock('http://myapp.iriscouch.com').get('/mcdonalds/').reply(404, expected)

  fetch('http://myapp.iriscouch.com/mcdonalds/')
    .subscribe(res => {
      assert.ok(res.statusCode, 404)
      assert.ok(JSON.parse(res.body), expected, 'the json object should be equal')
    }, _ => _, () => assert.end())
})

test('https get with status code 404', (assert) => {
  assert.plan(2)
  const expected = {statusCode: 404, error: 'Not Found'}
  nock('https://myapp.iriscouch.com').get('/mcdonalds/').reply(404, expected)

  fetch('https://myapp.iriscouch.com/mcdonalds/')
    .subscribe(res => {
      assert.ok(res.statusCode, 404)
      assert.ok(JSON.parse(res.body), expected, 'the json object should be equal')
    }, _ => _, () => assert.end())
})

test('https get with status code 404', (assert) => {
  assert.plan(2)
  const expected = {statusCode: 404, error: 'Not Found'}
  nock('https://myapp.iriscouch.com').get('/mcdonalds/').reply(404, expected)

  fetch('https://myapp.iriscouch.com/mcdonalds/')
    .subscribe(res => {
      assert.ok(res.statusCode, 404)
      assert.ok(JSON.parse(res.body), expected, 'the json object should be equal')
    }, _ => _, () => assert.end())
})

test('https post ', (assert) => {
  assert.plan(2)
  const keys = ['nock', 'nock', 'nock']
  const expected = {
    ok: true,
    id: '123ABC',
    rev: '946B7D1C'
  }
  nock('https://skimdb.npmjs.com/')
    .post('/_all_docs', {'keys': keys})
    .reply(201, expected)

  fetch('https://skimdb.npmjs.com/_all_docs', JSON.stringify({'keys': keys}))
    .subscribe(res => {
      assert.ok(res.statusCode, 201)
      assert.ok(JSON.parse(res.body), expected, 'the json object should be equal')
    }, _ => _, () => assert.end())
})
