const path = require('path')
let ppp

try {
  ppp = require(path.join(__dirname, '../conf.json'))
} catch (e) {
  console.error('Configuration failed to load.')
  console.error(e.stack)
}

module.exports = ppp
