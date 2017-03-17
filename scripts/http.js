import qs from 'querystring'
import url from 'url'

module.exports.POST = (link, postdata, opts, headers) => {
  let options = {
    postJSON: false,
    expectJSON: true
  }

  if (opts != null) {
    for (let ext in opts) {
      options[ext] = opts[ext]
    }
  }

  let parsed = url.parse(link)
  let postData = (options.postJSON ? JSON : qs).stringify(postdata)
  let postOptions = {
    host: parsed.host,
    port: parsed.port,
    path: parsed.path,
    method: 'POST',
    headers: {
      'Content-Type': (!options.postJSON ? 'application/x-www-form-urlencoded' : 'application/json charset=UTF-8'),
      'Content-Length': Buffer.byteLength(postData),
      'User-Agent': 'trotland@iced-server/backend'
    }
  }

  if (headers != null) {
    for (let ext in headers) {
      let header = headers[ext]
      postOptions.headers[ext] = header
    }
  }

  let httpModule = parsed.protocol === 'https:' ? require('https') : require('http')

  return new Promise((resolve, reject) => {
    let postReq = httpModule.request(postOptions, (res) => {
      res.setEncoding('utf8')

      let data = ''
      let obj = null

      res.on('data', (chunk) => {
        data += chunk
      })

      res.on('end', () => {
        if (options.expectJSON === true) {
          obj = JSON.parse(data)
        } else {
          obj = data
        }

        resolve({data: obj, request: res})
      })

      res.on('error', (e) => {
        reject(e)
      })
    })

    postReq.write(postData)
    postReq.end()
  })
}

const getRequest = module.exports.GET = (link, opts, headers) => {
  let options = {
    expectJSON: true
  }

  if (opts != null) {
    for (let ext in opts) {
      options[ext] = opts[ext]
    }
  }

  let parsed = url.parse(link)
  let getOptions = {
    host: parsed.host,
    port: parsed.port,
    path: parsed.path,
    method: 'GET',
    headers: {
      'User-Agent': 'trotland@iced-server/backend',
      'Accept': '*/*'
    }
  }

  if (headers != null) {
    for (let ext in headers) {
      getOptions.headers[ext] = headers[ext]
    }
  }

  let httpModule = parsed.protocol === 'https:' ? require('https') : require('http')

  return new Promise((resolve, reject) => {
    httpModule.get(getOptions, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        getRequest.call(this, res.headers.location, opts, headers).then(resolve, reject)
        return
      }

      let data = ''
      let obj = null

      res.on('data', (chunk) => {
        data += chunk
      })

      res.on('end', () => {
        if (options.expectJSON === true) {
          obj = JSON.parse(data)
        } else {
          obj = data
        }

        resolve({data: obj, request: res})
      })

      res.on('error', (e) => {
        reject(e)
      })
    })
  })
}
