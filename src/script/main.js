let term = {
  promptLen: 0,
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

function chunkify (text) {
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
    let hexVal = hexEncode(char)

    if (char === '\x1b') {
      observingCtrl = true
      continue
    }

    if (observingCtrl === true && (!isNaN(parseInt(char)) || char.match(/[a-f]/))) {
      observingCtrl = isNaN(parseInt(char)) ? char.match(/[a-f]/)[0] : parseInt(char)
      continue
    } else if (observingCtrl && char === 'r') {
      observingCtrl = null
      continue
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
      endHtml += '<span class="char char-' + hexVal + (observingCtrl != null ? ' col-' + observingCtrl : '') + '">' + char + '</span>'
    }
  }

  return endHtml
}

function clonePrompt () {
  let fakePrompt = term.prompt.cloneNode(true)
  fakePrompt.removeChild(fakePrompt.querySelector('.cursor'))
  fakePrompt.removeChild(fakePrompt.querySelector('#pif'))
  fakePrompt.className = 'old_prompt'
  fakePrompt.removeAttribute('id')
  term.lb.appendChild(fakePrompt)
}

function writeOut (text, cb) {
  term.lb.innerHTML += chunkify(text)
  if (typeof cb === 'function') cb()
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
    } else if (observingCtrl && char === 'r') {
      observingCtrl = null
      return
    }

    if (char === '\n') {
      term.lb.innerHTML += '<br>'
    } else {
      term.lb.innerHTML += '<span class="char char-' + hexVal + (observingCtrl != null ? ' col-' + observingCtrl : '') + '">' + char + '</span>'
    }

    updateCursor()
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

  let len = 0
  len += term.promptLen

  let charExample = document.querySelector('.char')
  let blockLen = 8

  if (charExample.getBoundingClientRect) {
    blockLen = charExample.getBoundingClientRect().width
  } else {
    blockLen = charExample.offsetWidth
  }

  let posInInput = term.input.selectionStart
  let offsetLeft = (posInInput + len) * blockLen

  term.cursor.style.left = offsetLeft + 'px'
  term.fakeinput.innerHTML = chunkify(term.input.value)

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

function focus () {
  term.input.focus()
  term.focused = true
  updateCursor()
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
  const input = term.input = document.querySelector('#pif')
  setPromptVisible(false)

  spellOut('Welcome to \x1balunasqu.ee\x1br!\n', 100, () => {
    writeOut('test \x1b8data\x1br here\nlel\n')

    setPromptVisible(true)

    updatePrompt('\x1b3/home\x1br $ ')
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
    term.focused = false
    updateCursor()
  }

  focus()
}
