import express from 'express'
import session from 'express-session'
import bodyParser from 'body-parser'
import connectRedis from 'connect-redis'
import morgan from 'morgan'

import config from '../scripts/config'
import flash from '../scripts/flash'
import routes from './routes'

const socketio = require('socket.io')

const app = express()
const server = require('http').createServer(app)
const RedisStore = connectRedis(session)

let io = socketio(server)

require('./io')(io)

app.enable('trust proxy')

const dev = process.env.NODE_ENV !== 'production'

app.use(session({
  key: config.server.session.key,
  secret: config.server.session.secret,
  store: new RedisStore({ port: config.server.session.port }),
  resave: false,
  saveUninitialized: true
}))

app.use(morgan((dev ? 'dev' : 'short')))
app.use(flash())

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

app.disable('x-powered-by')

app.set('devel', dev)

app.use(routes)

server.listen(config.server.port, () => {
  console.log('Listening on 0.0.0.0:%d', config.server.port)
})
