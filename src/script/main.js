const EventEmitter = require('events').EventEmitter
const util = require('util')

/**
 * Web-based shell interface by LunaSquee
 *
 * Color codes: Start with control character \x1b
 * 0 - Black
 * 1 - Navy Blue
 * 2 - Green
 * 3 - Red
 * 4 - Brown
 * 5 - Purple
 * 6 - Olive
 * 7 - Yellow
 * 8 - Lime Green
 * 9 - Teal
 * a - Aqua Light
 * b - Royal Blue
 * c - Hot Pink
 * d - Dark Gray
 * e - Light Gray
 * f - White
 * r - Reset
 *
 * Commands are located in the `commands.js` script
 */

let commandAPI = require('./commands.js')

let term = {
  elem: {},
  promptLen: 0,
  returnCode: 0,
  focused: true,
  promptDisabled: true,
  replicate: true
}

function hexEncode (str) {
  let result = ''
  for (let i = 0; i < str.length; i++) {
    let hex = str.charCodeAt(i).toString(16)
    result += ('000' + hex).slice(-4)
  }

  return result
}

function getURLs (s) {
  let regexp = /\b((?:https?|irc:\/\/|www\d{0,3}[.]|[a-z0-9.-]+[.][a-z]{2,4}\/)(?:[^\s()<>]+|\(([^\s()<>]+|(\([^\s()<>]+\)))*\))+(?:\(([^\s()<>]+|(\([^\s()<>]+\)))*\)|[^\s`!()[\]{};:''.,<>?«»“”‘’]))/gi
  return s.match(regexp)
}

function chunkify (text, selectedChars) {
  let chars = text.split('')
  let endHtml = ''
  let observingCtrl = null

  let urls = getURLs(text)
  let urlsAt = []
  if (urls) {
    for (let i in urls) {
      let url = urls[i]
      urlsAt.push({
        startsAt: text.indexOf(url),
        addr: urls[i],
        endsAt: text.indexOf(url) + url.length
      })
    }
  }

  for (let i in chars) {
    let char = chars[i]
    let extr = hexEncode(char)

    if (char === '\x1b') {
      observingCtrl = true
      continue
    }

    if (observingCtrl === true && (!isNaN(parseInt(char)) || char.match(/[a-f]/))) {
      observingCtrl = isNaN(parseInt(char)) ? char.match(/[a-f]/)[0] : parseInt(char)
      continue
    } else if (observingCtrl === true && char === 'r') {
      observingCtrl = null
      continue
    }

    if (selectedChars != null) {
      if (i >= selectedChars[0] && i <= selectedChars[1]) {
        extr += ' sel'
      }
    }

    for (let j in urlsAt) {
      let url = urlsAt[j]
      if (parseInt(i) === url.startsAt) {
        endHtml += '<a href="' + url.addr + '" rel="nofollow" target="_blank">'
      } else if (parseInt(i) === url.endsAt) {
        endHtml += '</a>'
      }
    }

    if (char === '\n') {
      endHtml += '<br>'
    } else {
      endHtml += '<span class="char char-' + extr + (observingCtrl != null ? ' col-' + observingCtrl : '') + '">' + char + '</span>'
    }
  }

  return endHtml
}

function clonePrompt () {
  let fakePrompt = term.elem.prompt.cloneNode(true)
  fakePrompt.removeChild(fakePrompt.querySelector('.cursor'))
  fakePrompt.removeChild(fakePrompt.querySelector('#pif'))
  fakePrompt.className = 'prompt old'
  fakePrompt.removeAttribute('id')
  term.elem.lb.appendChild(fakePrompt)
  scrollBottom()
}

function writeOut (text, cb) {
  term.elem.lb.innerHTML += chunkify(text)
  if (typeof cb === 'function') cb()
}

function writeOutDelayed (text, delayms, cb) {
  setTimeout(() => {
    writeOut(text, cb)
  }, delayms)
}

function scrollBottom () {
  document.body.scrollTop = document.body.scrollHeight
  document.documentElement.scrollTop = document.body.scrollHeight
}

function spellOut (text, delayms, cb) {
  let chars = text.split('')
  let observingCtrl = null

  function writeChar (char, i) {
    let hexVal = hexEncode(char)

    if (char === '\x1b') {
      observingCtrl = true
      return
    }

    if (observingCtrl === true && (!isNaN(parseInt(char)) || char.match(/[a-f]/))) {
      observingCtrl = isNaN(parseInt(char)) ? char.match(/[a-f]/)[0] : parseInt(char)
      return
    } else if (observingCtrl === true && char === 'r') {
      observingCtrl = null
      return
    }

    if (char === '\n') {
      term.elem.lb.innerHTML += '<br>'
    } else {
      term.elem.lb.innerHTML += '<span class="char char-' + hexVal + (observingCtrl != null ? ' col-' + observingCtrl : '') + '">' + char + '</span>'
    }

    if (i + 1 === chars.length && typeof cb === 'function') {
      cb()
    }
  }

  for (let i in chars) {
    let ii = parseInt(i)
    setTimeout(() => {
      writeChar(chars[i], ii)
    }, delayms * ii)
  }
}

function updateCursor () {
  // CALCULATE POS

  let len = term.promptLen

  let charExample = document.querySelector('.char')
  let blockLen = charExample.offsetWidth
  let blockHei = charExample.offsetHeight

  let promptLen = term.elem.prompt.clientWidth

  // Get percise measurements if available
  if (charExample.getBoundingClientRect) {
    blockLen = charExample.getBoundingClientRect().width
    blockHei = charExample.getBoundingClientRect().height
    promptLen = term.elem.prompt.getBoundingClientRect().width
  }

  let posInInput = term.elem.input.selectionStart

  // Tell chunkifier if the user has highlighted some text in the input
  let selection = null
  if (term.elem.input.selectionStart !== term.elem.input.selectionEnd) {
    selection = [term.elem.input.selectionStart, term.elem.input.selectionEnd]
  }

  // Calculations..
  let availableWidth = promptLen - (posInInput + len) * blockLen
  let cursorMoveDown = (availableWidth < blockLen ? blockHei : 0)
  let offsetLeft = (posInInput + len) * blockLen

  // Do not show exit code when theres text behind it
  if (offsetLeft > promptLen - blockLen * (4 + term.returnCode.toString().length)) {
    term.elem.return.style.display = 'none'
  } else if (term.returnCode !== 0) {
    showReturn(term.returnCode)
  }

  // Move cursor down
  if (cursorMoveDown > 0) {
    let chars = Math.floor(promptLen / blockLen)
    let timesOverScreen = Math.floor((posInInput + len) / chars)
    offsetLeft = (offsetLeft - (chars * timesOverScreen) * blockLen)
    cursorMoveDown = blockHei * timesOverScreen
    scrollBottom()
  }

  // SET CLASS
  let baseClass = 'cursor char'

  if (term.focused) {
    term.elem.cursor.className = baseClass + ' focus'
  } else {
    term.elem.cursor.className = baseClass
  }

  if (!term.replicate) {
    term.elem.cursor.style.left = len * blockLen + 'px'
    term.elem.cursor.style.top = '0px'
    term.elem.fakeinput.innerHTML = ''
    return
  }

  term.elem.cursor.style.left = offsetLeft + 'px'
  term.elem.cursor.style.top = cursorMoveDown + 'px'
  term.elem.input.style.top = cursorMoveDown + 'px'
  term.elem.fakeinput.innerHTML = chunkify(term.elem.input.value, selection)
}

function updatePrompt (ps1) {
  term.promptLen = ps1.replace(/\u001b[0-9a-fr]/g, '').length
  term.elem.ps1.innerHTML = chunkify(ps1)
  updateCursor()
}

function setPromptVisible (val) {
  term.promptDisabled = !val

  if (term.promptDisabled) {
    term.elem.prompt.style.display = 'none'
    term.elem.input.disabled = true
  } else {
    term.elem.prompt.style.display = 'block'
    term.elem.input.disabled = false
  }

  updateCursor()
  if (val) focus()
}

function clear () {
  term.elem.lb.innerHTML = ''
}

function focus () {
  term.elem.input.focus()
  term.focused = true
  updateCursor()
}

function setPromptTextReplicate (val) {
  term.replicate = !val
}

function showReturn (num) {
  term.returnCode = num
  if (num === 0) {
    term.elem.return.style.display = 'none'
  } else {
    term.elem.return.style.display = 'block'
    term.elem.return.innerHTML = num + ' &crarr;'
  }
}

function doInput () {
  if (term.promptDisabled) return
  clonePrompt()
  term.stdin.handle(term.elem.input.value)
  term.elem.input.value = ''
}

class Writable extends EventEmitter {
  constructor (name) {
    super()
    this.name = name
  }

  write (cb) {
    let args = (typeof cb === 'function' ? Array.prototype.slice.call(arguments, 1) : arguments)
    let data = util.format.apply(null, args)

    writeOut(data)

    this.emit('data', data)
    if (typeof cd === 'function') cb()
  }

  writeDelay (delayms = 100, cb) {
    let argSlice = (typeof cb === 'function' ? 2 : 1)
    let data = util.format.apply(null, Array.prototype.slice.call(arguments, argSlice))

    writeOutDelayed(data, delayms, () => {
      this.emit('data', data)
      if (typeof cd === 'function') cb()
    })
  }

  writeSpell (delayms = 100, cb) {
    let argSlice = (typeof cb === 'function' ? 2 : 1)
    let data = util.format.apply(null, Array.prototype.slice.call(arguments, argSlice))

    spellOut(data, delayms, () => {
      this.emit('data', data)
      if (typeof cb === 'function') {
        cb()
      }
    })
  }
}

class StdIn extends Writable {
  constructor () {
    super('stdin')
    this.history = []
    this.historyPos = 0
  }

  write () {
    let data = util.format.apply(null, arguments)
    term.elem.input.value += data
    updateCursor()
    doInput()
  }

  handle (input) {
    if (input === '' || (/^\s+$/.test(input))) return

    if (!commandAPI.commandscape) {
      this.history.push(input)
      this.historyPos = this.history.length
    }
    this.emit('data', input.trim())
  }

  terminate () {
    this.write('\x1b^C')
  }
}

function keyDownHandle (key) {
  if (key === 38) {
    if (term.stdin.historyPos <= 0) {
      term.stdin.historyPos = 0
    } else {
      term.stdin.historyPos -= 1
    }

    let selection = term.stdin.history[term.stdin.historyPos]

    if (selection) {
      term.elem.input.value = selection
    }
  } else if (key === 40) {
    if (term.stdin.historyPos >= term.stdin.history.length) {
      term.stdin.historyPos = term.stdin.history.length
    } else {
      term.stdin.historyPos += 1
    }

    let selection = term.stdin.history[term.stdin.historyPos]

    if (!term.stdin.history[term.stdin.historyPos]) {
      selection = ''
    }

    term.elem.input.value = selection
  }
}

function addComponentsToTerm () {
  term.stdout = new Writable('stdout')
  term.stderr = new Writable('stderr')
  term.stdin = new StdIn()

  term.clear = clear
  term.prompt = setPromptVisible
  term.setPrompt = updatePrompt
  term.password = setPromptTextReplicate

  term.promptDefault = function () {
    term.setPrompt('\x1b3' + term.pwd + '\x1br $ ')
  }

  term.exitWith = showReturn
  term.prompt(false)

  return term
}

window.onload = () => {
  term.socket = window.io.connect()
  term.elem.lb = document.querySelector('.letterbox')
  const prompt = term.elem.prompt = document.querySelector('.prompt')
  term.elem.ps1 = prompt.querySelector('#ps1')
  term.elem.fakeinput = prompt.querySelector('#fakeinput')
  term.elem.cursor = prompt.querySelector('.cursor')
  term.elem.return = prompt.querySelector('.returnCode')
  const input = term.elem.input = document.querySelector('#pif')

  addComponentsToTerm()
  commandAPI.initialize(term)

  term.socket.on('connect', () => {
    commandAPI.runCommand(term, ['boot'])
  })

  document.querySelector('body').addEventListener('click', (e) => {
    focus()
  })

  input.addEventListener('keydown', (e) => {
    updateCursor()
  })

  input.addEventListener('keyup', (e) => {
    term.stdin.value = term.elem.input.value

    if (e.keyCode === 13) {
      doInput()
    } else if (e.ctrlKey && e.keyCode === 67) {
      term.stdin.terminate()
    } else {
      keyDownHandle(e.keyCode)
    }

    focus()
  }, false)

  window.onfocus = () => {
    term.focused = true
    updateCursor()
  }

  window.onblur = () => {
    term.focused = false
    updateCursor()
  }

  window.onresize = () => {
    updateCursor()
  }

  focus()
}
