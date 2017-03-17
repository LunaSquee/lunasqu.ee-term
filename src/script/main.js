let term = {
  promptLen: 0,
  returnCode: 0,
  focused: true,
  promptDisabled: true
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
  let regexp = /\b((?:https?:\/\/|www\d{0,3}[.]|[a-z0-9.-]+[.][a-z]{2,4}\/)(?:[^\s()<>]+|\(([^\s()<>]+|(\([^\s()<>]+\)))*\))+(?:\(([^\s()<>]+|(\([^\s()<>]+\)))*\)|[^\s`!()[\]{};:''.,<>?«»“”‘’]))/gi
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
  let fakePrompt = term.prompt.cloneNode(true)
  fakePrompt.removeChild(fakePrompt.querySelector('.cursor'))
  fakePrompt.removeChild(fakePrompt.querySelector('#pif'))
  fakePrompt.className = 'prompt old'
  fakePrompt.removeAttribute('id')
  term.lb.appendChild(fakePrompt)
  scrollBottom()
}

function writeOut (text, cb) {
  term.lb.innerHTML += chunkify(text)
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
      term.lb.innerHTML += '<br>'
    } else {
      term.lb.innerHTML += '<span class="char char-' + hexVal + (observingCtrl != null ? ' col-' + observingCtrl : '') + '">' + char + '</span>'
    }

    if (i + 1 === chars.length && typeof cb === 'function') cb()
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

  let promptLen = term.prompt.clientWidth

  // Get percise measurements if available
  if (charExample.getBoundingClientRect) {
    blockLen = charExample.getBoundingClientRect().width
    blockHei = charExample.getBoundingClientRect().height
    promptLen = term.prompt.getBoundingClientRect().width
  }

  let posInInput = term.input.selectionStart

  // Tell chunkifier if the user has highlighted some text in the input
  let selection = null
  if (term.input.selectionStart !== term.input.selectionEnd) {
    selection = [term.input.selectionStart, term.input.selectionEnd]
  }

  // Calculations..
  let availableWidth = promptLen - (posInInput + len) * blockLen
  let cursorMoveDown = (availableWidth < blockLen ? blockHei : 0)
  let offsetLeft = (posInInput + len) * blockLen

  // Do not show exit code when theres text behind it
  if (offsetLeft > promptLen - blockLen * (4 + term.returnCode.toString().length)) {
    term.return.style.display = 'none'
  } else if (term.returnCode !== 0) {
    showReturn(term.returnCode)
  }

  // Move cursor down
  if (cursorMoveDown > 0) {
    offsetLeft = offsetLeft - (promptLen + len) + blockLen
    if (offsetLeft > promptLen - blockLen) {
      offsetLeft = offsetLeft - promptLen
      cursorMoveDown += blockHei
    }
  }

  term.cursor.style.left = offsetLeft + 'px'
  term.cursor.style.top = cursorMoveDown + 'px'
  term.fakeinput.innerHTML = chunkify(term.input.value, selection)

  // SET CLASS
  let baseClass = 'cursor char'

  if (term.focused) {
    term.cursor.className = baseClass + ' focus'
  } else {
    term.cursor.className = baseClass
  }
}

function updatePrompt (ps1) {
  term.promptLen = ps1.replace(/\u001b[0-9a-fr]/g, '').length
  term.ps1.innerHTML = chunkify(ps1)
  updateCursor()
}

function setPromptVisible (val) {
  term.promptDisabled = !val

  if (term.promptDisabled) {
    term.prompt.style.display = 'none'
    term.input.disabled = true
  } else {
    term.prompt.style.display = 'block'
    term.input.disabled = false
  }

  updateCursor()
  if (val) focus()
}

function clear () {
  term.lb.innerHTML = ''
}

function focus () {
  term.input.focus()
  term.focused = true
  updateCursor()
}

function showReturn (num) {
  term.returnCode = num
  if (num === 0) {
    term.return.style.display = 'none'
  } else {
    term.return.style.display = 'block'
    term.return.innerHTML = num + ' &crarr;'
  }
}

function doInput () {
  if (term.promptDisabled) return
  // term.lb.innerHTML += chunkify(term.input.value + '\n')
  clonePrompt()
  term.input.value = ''
}

window.onload = () => {
  term.socket = window.io.connect()
  term.lb = document.querySelector('.letterbox')
  const prompt = term.prompt = document.querySelector('.prompt')
  term.ps1 = prompt.querySelector('#ps1')
  term.fakeinput = prompt.querySelector('#fakeinput')
  term.cursor = prompt.querySelector('.cursor')
  term.return = prompt.querySelector('.returnCode')
  const input = term.input = document.querySelector('#pif')
  setPromptVisible(false)
  writeOutDelayed('\x1b8Hello there!\n\n', 100)
  writeOutDelayed('loading system\n\n', 110)
  writeOutDelayed('exec \'sh\'\n', 500)

  writeOutDelayed('\n\n', 1000, () => {
    clear()
    spellOut('Welcome to \x1balunasqu.ee\x1br!\n\n', 60, () => {
      writeOutDelayed('This is an open-source unix-like fake terminal (https://github.com/LunaSquee/lunasqu.ee-term)\n\n', 100)
      writeOutDelayed('\xA9 2017 LunaSquee\n\n', 200, () => {
        setPromptVisible(true)

        showReturn(1)
        updatePrompt('\x1b3/home\x1br $ ')
      })
    })
  })

  document.querySelector('body').addEventListener('click', (e) => {
    focus()
  })

  input.addEventListener('keydown', (e) => {
    updateCursor()
  })

  input.addEventListener('keyup', (e) => {
    if (e.keyCode === 13) {
      doInput()
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
