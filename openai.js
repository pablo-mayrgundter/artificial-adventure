import { getApiKey } from './api-key.js'

const DEFAULT_PARAMS = {
  model: "gpt-4o-mini",
  temperature: 0.8,
  max_output_tokens: 512,
  top_p: 1,
  frequency_penalty: 0.25,
  presence_penalty: 0.25,
}

function getAuthHeader() {
  const apiKey = getApiKey()
  if (!(apiKey && apiKey.length > 10)) {
    throw new Error('Need an api-key')
  }
  return `Bearer ${apiKey}`
}

function resolveFetch(fetchImpl) {
  if (fetchImpl) {
    return fetchImpl
  }
  if (typeof fetch === 'undefined') {
    throw new Error('Fetch is not available')
  }
  return fetch
}

function resolveAlert(alertImpl) {
  if (alertImpl) {
    return alertImpl
  }
  if (typeof alert === 'undefined') {
    return () => {}
  }
  return alert
}

async function createImage(imgPrompt, imageElt, { fetchImpl, alertImpl } = {}) {
  const resolvedFetch = resolveFetch(fetchImpl)
  const resolvedAlert = resolveAlert(alertImpl)
  const requestOptions = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': getAuthHeader(),
    },
    body: JSON.stringify({
      prompt: imgPrompt,
      n: 1,
      size: '512x512',
      response_format: 'b64_json',
    })
  }
  const response = await resolvedFetch('https://api.openai.com/v1/images/generations', requestOptions)
  const data = await response.json()
  if (data.error) {
    resolvedAlert(`${data.error.message} (openai.com)`)
    throw new Error(data.error.message)
  }
  const imageB64 = data.data[0].b64_json
  // TODO: use last image as prior for next.
  const imageUrl = `data:image/png;base64, ${imageB64}`
  imageElt.src = imageUrl
}

// https://platform.openai.com/docs/api-reference/responses/create
// https://stackoverflow.com/questions/72326140/openai-api-refused-to-set-unsafe-header-user-agent
async function altQuery(params = {}, { fetchImpl, alertImpl } = {}) {
  const resolvedFetch = resolveFetch(fetchImpl)
  const resolvedAlert = resolveAlert(alertImpl)
  const params_ = { ...DEFAULT_PARAMS, ...params }
  const requestOptions = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': getAuthHeader(),
    },
    body: JSON.stringify(params_)
  }
  const response = await resolvedFetch('https://api.openai.com/v1/responses', requestOptions)
  const data = await response.json()
  if (data.error) {
    resolvedAlert(`${data.error.message} (openai.com)`)
    throw new Error(data.error.message)
  }
  const output = data.output?.[0]?.content?.find((item) => item.type === 'output_text')
  if (!output?.text) {
    throw new Error('No output text returned from OpenAI.')
  }
  return output.text
}

export {
  DEFAULT_PARAMS,
  altQuery,
  createImage,
}
