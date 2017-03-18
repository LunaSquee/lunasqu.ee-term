const tutils = require('./t_util.js')

let helpList = {
  'help': '    - display list of commands or help for a specific command',
  'clear': '   - clear the screen',
  'term': '    - terminal',
  'return': '  - return from current function\n',
  'sitemap': ' - URLs that you can visit'
}

let commands = {
  'help': function (term, argc, argv, exit) {
    if (argc > 1) {
      let cmd = argv[1].toLowerCase()
      if (helpList[cmd]) {
        term.stdout.write(argv[1] + ' ' + helpList[cmd] + '\n')
      } else {
        term.stdout.write('No manual entry for ' + cmd + '\n')
        return exit(16)
      }
    } else {
      term.stdout.write('list of available commands:\n\n')
      for (let cmd in helpList) {
        let desc = helpList[cmd]
        term.stdout.write(cmd + ' ' + desc + '\n')
      }
      term.stdout.write('\n')
    }
    exit(0)
  },
  'clear': function (term, argc, argv, exit) {
    term.clear()
    exit(0)
  },
  'sitemap': function (term, argc, argv, exit) {
    API.loadStaticPage('sitemap.txt', (lines) => {
      if (!lines) return exit(1)
      for (let i in lines) {
        term.stdout.write(lines[i] + '\n')
      }
      exit(0)
    })
  },
  'social': function (term, argc, argv, exit) {
    API.loadStaticPage('social.txt', (lines) => {
      if (!lines) return exit(1)
      for (let i in lines) {
        term.stdout.write(lines[i] + '\n')
      }
      exit(0)
    })
  },
  'exit': function (term, argc, argv, exit) {
    window.location.reload()
    exit(0)
  },
  'return': function (term, argc, argv, exit) {
    exit((!isNaN(parseInt(argv[1])) ? parseInt(argv[1]) : term.returnCode))
  },
  'boot': function (term, argc, argv, exit) {
    term.stdout.write('connecting to remote..\n\n')
    if (term.remote) {
      term.stderr.write('already initialized\n')
      return exit(1)
    }
    term.socket.emit('boot')
    term.socket.once('remote_on', () => {
      term.stdout.writeDelay(50, 'mounting /\n')
      term.stdout.writeDelay(50, 'mounting /home\n\n')
      term.stdout.writeDelay(80, 'starting terminal..\n\n')
      setTimeout(() => {
        term.remote = true
        API.runCommand(term, ['term'])
      }, 200)
    })
    term.socket.once('disconnect', () => {
      term.remote = false
      term.prompt(false)
      term.stderr.write('disconnected from remote\n')
      term.stdout.writeDelay(50, 'reconnecting...\n')
    })
  },
  'login': function (term, argc, argv, exit) {
    function listen (done) {
      term.stdin.once('data', (line) => {
        if (line.indexOf('\x1b^C') !== -1) return exit(1)
        done(line)
      })
    }
    term.setPrompt('Username: ')
    term.prompt(true)
    listen((uname) => {
      term.setPrompt('Password: ')
      term.password(true)
      term.prompt(true)
      listen((pword) => {
        term.socket.emit('login', {username: uname, password: pword})
        term.socket.once('login_status', (data) => {
          term.prompt(false)
          if (data.fail) {
            term.stderr.write(data.message + '\n')
            return API.runCommand(term, argv)
          }
          term.stdout.write(data.message)
          exit(0)
        })
      })
    })
  },
  'term': function (term, argc, argv, exit) {
    term.clear()
    term.stdout.writeSpell(20, () => {
      term.pwd = '/home'
      term.stdout.write('\n\n')
      term.stdout.write('Shell interface written by LunaSquee \x1b6(https://github.com/LunaSquee/lunasqu.ee-term)\x1br\n\n')
      term.stdout.write('Type in \'help\' for a list of things you can do.\n')
      term.stdout.write('Type in \'sitemap\' for links elsewhere.\n\n')
      term.prompt(true)
      term.promptDefault()
      exit(0)
    }, 'Welcome to \x1balunasqu.ee\x1br!\n')
  }
}

function positionsOfOccurence (array, str) {
  let pos = []
  for (let i in array) {
    if (array[i] === str) {
      pos.push(parseInt(i))
    }
  }
  return pos
}

let API = module.exports = {
  commandscape: true,
  return: (term, code) => {
    API.commandscape = false
    term.exitWith(code)
    term.prompt(true)
    term.password(false)
    term.promptDefault()
  },
  loadStaticPage: (page, cb) => {
    tutils.fireRequest('/static/' + page).then((data) => {
      let lines = data.split('\n')
      cb(lines)
    }, () => {
      cb(null)
    })
  },
  runCommand: (term, params) => {
    if (!params.length) return

    let commandsToRun = []

    function executeNext (index) {
      let cmdParam = commandsToRun[index].split(' ')

      if (commands[cmdParam[0]] == null) {
        term.stderr.write('term: command not found: ' + cmdParam[0] + '\n')
        return API.return(term, 127)
      }

      commands[cmdParam[0]](term, cmdParam.length, cmdParam, (code) => {
        if (commandsToRun[index + 1]) {
          if (code === 0) {
            return executeNext(index + 1)
          }
        }
        API.return(term, code)
      })
    }

    term.prompt(false)
    API.commandscape = true

    if (positionsOfOccurence(params, '&&').length) {
      let occurences = positionsOfOccurence(params, '&&')

      for (let i in occurences) {
        let index = occurences[i]
        i = parseInt(i)

        if (!commandsToRun.length) {
          commandsToRun.push(params.slice(0, index).join(' '))
        }

        let nextOneAt = params.length
        if (occurences[i + 1] !== null) {
          nextOneAt = occurences[i + 1]
        }
        commandsToRun.push(params.slice(index + 1, nextOneAt).join(' '))
      }
    } else {
      commandsToRun = [params.join(' ')]
    }

    if (commandsToRun === null) {
      term.stderr.write('term: failed to execute statement\n')
      return API.return(term, 127)
    }

    if (commandsToRun.length) {
      executeNext(0)
    }
  },
  initialize: (term) => {
    term.stdin.on('data', (line) => {
      if (API.commandscape === true) return
      if (line.indexOf('\x1b^C') !== -1) return API.return(term, term.returnCode)
      let params = line.split(' ')
      API.runCommand(term, params)
    })
  }
}
