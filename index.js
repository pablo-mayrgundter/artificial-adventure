import {Configuration, OpenAIApi} from 'openai'



const controls = document.forms.controls
const replyElt = document.getElementById('reply-content')
const sceneElt = document.getElementById('scene')
const scriptElt = document.getElementById('script')
const scriptContentElt = document.getElementById('script-content')

const promptGamePrefix = 'You are a text-based adventure game, similar to Zork.  You describe where I am and what is around me. After that, present me short numbered list of choices for what I may do next.  Then I make a choice, and you respond by telling me what happens next, and then prompt me to make my next decision, and so on.'

let gameState
let openai


async function sendPrompt(prompt) {
  const req = {
    model: 'text-davinci-003',
    prompt,
    temperature: 0.9,
    max_tokens: 150,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0.6,
    stop: [' Your play:', ' Game:'],
  }
  const response = await openai.createCompletion(req)
  // TODO(pablo): Replies are prefixed with spaces
  let reply = response.data.choices[0].text
  reply = reply.replace(/\s+/, '')
  return reply
}


async function nextTurn() {
  // Get the AI's last reply
  gameState += replyElt.innerText
  scriptContentElt.innerText = gameState

  // Then the human's
  const humanPlay = controls.prompt.value
  controls.prompt.value = ''
  gameState += `\n\n Your play: ${humanPlay}\n Game: `

  // Add it to the display script
  scriptContentElt.innerText = gameState
  scriptElt.scrollTo(0, scriptElt.scrollHeight);

  // Send game state to server
  const reply = await sendPrompt(promptGamePrefix + gameState)
  // Display reply
  replyElt.innerText = reply

  // Try to parse description
  const match = reply.match(/(^.*\.)([^.]+\s*\n\s*1.*)/m)
  if (match && match.length > 1 && typeof match[1] === 'string') {
    // Use description for an image
    createImage(match[1])
  } else {
    createImage(reply)
  }
}


function onSubmit() {
  event.preventDefault()
  loadApiKey()
  nextTurn()
}

async function createImage(imgPrompt) {
  const response = await openai.createImage({
    prompt: imgPrompt,
    n: 1,
    size: '512x512',
  })
  const imageUrl = response.data.data[0].url
  scene.src = imageUrl
}


function loadGameState() {
  gameState = document.forms.story.opening.value
  scriptContentElt.innerText = gameState
}
document.getElementById('opening-select').onchange = loadGameState

controls.prompt.value = 'Ok, I\'m ready to play'
controls.submit.onclick = onSubmit
replyElt.innerText = ''
loadGameState()


let apiKey
function loadApiKey() {
  const apiKeyElt = document.getElementById('api-key')
  apiKeyElt.onchange = () => {
    // apiKeyElt.blur()
    document.getElementById('prompt').focus()
  }
  apiKey = apiKeyElt.value
  if (!(apiKey && apiKey.length > 10)) {
    console.error('Need an api-key')
    return
  }
  if (openai === undefined) {
    const configuration = new Configuration({apiKey})
    openai = new OpenAIApi(configuration)
  }
}
