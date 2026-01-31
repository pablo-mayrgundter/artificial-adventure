const controls = document.forms.controls
const replyElt = document.getElementById('reply-content')
const historyLogElt = document.getElementById('history-log')

const promptGamePrefix = 'You are a text-based adventure game, similar to Zork.  You describe where I am and what is around me. After that, present me short numbered list of choices for what I may do next.  Then I make a choice, and you respond by telling me what happens next, and then prompt me to make my next decision, and so on.'

let gameState


async function sendPrompt(prompt) {
  const req = {
    input: prompt,
  }
  let reply = await altQuery(req)
  // TODO(pablo): Replies are prefixed with spaces
  reply = reply.replace(/\s+/, '')
  return reply
}


async function nextTurn() {
  // Get the AI's last reply
  gameState += replyElt.innerText
  const humanPlay = controls.prompt.value
  controls.prompt.value = ''
  gameState += `\n\n Your play: ${humanPlay}\n Game: `

  // Send game state to server
  const reply = await sendPrompt(promptGamePrefix + gameState)
  // Display reply
  replyElt.innerText = reply

  // Try to parse description
  const match = reply.match(/(^.*\.)([^.]+\s*\n\s*1.*)/m)
  const logEntry = addLogEntry({
    humanPlay,
    reply,
  })
  const imagePrompt = match && match.length > 1 && typeof match[1] === 'string'
    ? match[1]
    : reply
  createImage(imagePrompt, logEntry.image)
  historyLogElt.scrollTo(0, historyLogElt.scrollHeight)
}


function onSubmit() {
  event.preventDefault()
  loadApiKey()
  nextTurn()
}


let lastImageB64
async function createImage(imgPrompt, imageElt) {
  const requestOptions = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      prompt: imgPrompt,
      n: 1,
      size: '512x512',
      response_format: 'b64_json',
    })
  }
  const response = await fetch('https://api.openai.com/v1/images/generations', requestOptions)
  const data = await response.json()
  if (data.error) {
    alert(`${data.error.message} (openai.com)`)
    throw new Error(data.error.message)
  }
  lastImageB64 = data.data[0].b64_json
  // TODO: use last image as prior for next.
  const imageUrl = `data:image/png;base64, ${lastImageB64}`
  imageElt.src = imageUrl
}


function loadGameState() {
  gameState = document.forms.story.opening.value
  historyLogElt.innerHTML = ''
  addLogEntry({
    humanPlay: 'Game start',
    reply: gameState,
    imageUrl: 'opening-scene.png',
  })
}
document.getElementById('opening-select').onchange = loadGameState

controls.prompt.value = 'Ok, I\'m ready to play'
controls.submit.onclick = onSubmit
replyElt.innerText = ''
setupApiKeyInput()
loadGameState()


function addLogEntry({ humanPlay, reply, imageUrl }) {
  const entry = document.createElement('div')
  entry.className = 'log-entry'

  const image = document.createElement('img')
  image.alt = 'AI rendering of game scene'
  image.src = imageUrl || ''

  const text = document.createElement('div')
  text.className = 'log-text'
  text.innerText = `Your play: ${humanPlay}\n\nGame: ${reply}`

  entry.appendChild(image)
  entry.appendChild(text)
  historyLogElt.appendChild(entry)

  return { entry, image, text }
}


let apiKey
const apiKeyCookieName = 'openai_api_key'

function readCookie(name) {
  const cookie = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`))
  if (!cookie) {
    return ''
  }
  return decodeURIComponent(cookie.split('=')[1] || '')
}

function writeCookie(name, value) {
  const maxAge = 60 * 60 * 24 * 365
  const secure = window.location.protocol === 'https:' ? '; secure' : ''
  document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${maxAge}; path=/; samesite=strict${secure}`
}

function applyApiKey(value, { persist } = { persist: false }) {
  apiKey = value
  if (persist) {
    writeCookie(apiKeyCookieName, value)
  }
}

function loadApiKey() {
  const apiKeyElt = document.getElementById('api-key')
  applyApiKey(apiKeyElt.value, { persist: true })
  if (!(apiKey && apiKey.length > 10)) {
    console.error('Need an api-key')
  }
}

function setupApiKeyInput() {
  const apiKeyElt = document.getElementById('api-key')
  const storedApiKey = readCookie(apiKeyCookieName)
  if (storedApiKey) {
    apiKeyElt.value = storedApiKey
    applyApiKey(storedApiKey)
  }
  apiKeyElt.addEventListener('change', () => {
    loadApiKey()
    document.getElementById('prompt').focus()
  })
}


// https://platform.openai.com/docs/api-reference/responses/create
const DEFAULT_PARAMS = {
  model: "gpt-4o-mini",
  temperature: 0.8,
  max_output_tokens: 512,
  top_p: 1,
  frequency_penalty: 0.25,
  presence_penalty: 0.25,
}
// https://stackoverflow.com/questions/72326140/openai-api-refused-to-set-unsafe-header-user-agent
async function altQuery(params = {}) {
  const params_ = { ...DEFAULT_PARAMS, ...params }
  const requestOptions = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(params_)
  }
  const response = await fetch('https://api.openai.com/v1/responses', requestOptions)
  const data = await response.json()
  if (data.error) {
    alert(`${data.error.message} (openai.com)`)
    throw new Error(data.error.message)
  }
  const output = data.output?.[0]?.content?.find((item) => item.type === 'output_text')
  if (!output?.text) {
    throw new Error('No output text returned from OpenAI.')
  }
  return output.text
}
