let connections = {}

module.exports = (io) => {
  io.on('connection', function (socket) {
    connections[socket.conn.id] = {login: null}

    socket.on('boot', () => {
      socket.emit('remote_on')
    })

    socket.on('login', (data) => {
      if (!data.username || !data.password) {
        return socket.emit('login_status', {fail: true, message: 'missing fields'})
      }

      // TODO: term login

      socket.emit('login_status', {fail: false, message: 'logged in as ' + data.username})
    })

    socket.on('disconnect', () => {
      delete connections[socket.conn.id]
    })
  })
}
