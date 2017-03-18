function fireRequest (url, method = 'GET', data, formHeader = false) {
  return new Promise((resolve, reject) => {
    let xhttp = new XMLHttpRequest()
    xhttp.onreadystatechange = function () {
      if (this.readyState === 4 && this.status === 200) {
        resolve(xhttp.responseText)
      } else if (this.readyState === 4 && this.status !== 200) {
        reject(xhttp)
      }
    }
    xhttp.open(method, url, true)
    if (formHeader) {
      xhttp.setRequestHeader('Content-type', 'application/json')
    }
    xhttp.send(data)
  })
}

module.exports = {
  fireRequest: fireRequest
}
