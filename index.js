import { loadApiKey, setupApiKeyInput } from './api-key.js'
import { createImage, altQuery } from './openai.js'

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
