const url = require('url')
const Rx = require('rxjs/Rx')

const protocol = {
  'http:': require('http'),
  'https:': require('https')
}

const port = {
  'http:': 80,
  'https:': 443
}

const fetch = (inputURL, body) => Rx.Observable.create(observer => {
  const parsedURL = url.parse(inputURL)
  if (body) {
    inputURL = {
      host: parsedURL.hostname,
      path: parsedURL.path,
      port: parsedURL.port || port[parsedURL.protocol],
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body)
      }

    }
  }
  const req = protocol[parsedURL.protocol].request(inputURL)
  const res = Rx.Observable.fromEvent(req, 'response')
    .first()
    .flatMap(
      (res) => {
        const data = Rx.Observable.fromEvent(res, 'data')
        const complete = Rx.Observable.fromEvent(res, 'end')
        return data.takeUntil(complete).reduce((body, delta) => body + delta, '')
      },
      ({statusCode, headers}, body) => ({
        statusCode: statusCode,
        headers: headers,
        body: body
      }))
    .subscribe(observer)

  const err = Rx.Observable.fromEvent(req, 'error', e => {
    throw e
  }).subscribe(observer)
  res.add(err)
  body && req.write(body)
  req.end()
  return res
})
module.exports = fetch
