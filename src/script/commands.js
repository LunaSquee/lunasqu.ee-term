let helpList = {
  'help': '   - display list of commands or help for a specific command',
  'clear': '  - clear the screen',
  'term': '   - terminal'
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
  'exit': function (term, argc, argv, exit) {
    window.location.reload()
    exit(0)
  },
  'term': function (term, argc, argv, exit) {
    term.clear()
    term.stdout.writeSpell(20, () => {
      term.pwd = '/home'
      term.stdout.write('\n\n')
      term.stdout.write('Shell interface written by LunaSquee \x1b6(https://github.com/LunaSquee/lunasqu.ee-term)\x1br\n\n')
      term.stdout.write('Type in \'help\' and hit Enter for a list of things you can do.\n\n')
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
    term.promptDefault()
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
      let params = line.split(' ')
      API.runCommand(term, params)
    })
  }
}
