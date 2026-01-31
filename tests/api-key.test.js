import { expect, test } from 'bun:test'
import {
  apiKeyCookieName,
  getApiKey,
  setupApiKeyInput,
  writeCookie,
} from '../api-key.js'
import { altQuery } from '../openai.js'

function createDomStubs() {
  const listeners = new Map()
  const apiKeyInput = {
    value: '',
    addEventListener: (event, handler) => {
      listeners.set(event, handler)
    },
  }
  const prompt = {
    focused: false,
    focus: () => {
      prompt.focused = true
    },
  }
  const doc = {
    cookie: '',
    getElementById: (id) => {
      if (id === 'api-key') {
        return apiKeyInput
      }
      if (id === 'prompt') {
        return prompt
      }
      return null
    },
  }
  const location = { protocol: 'https:' }
  return {
    apiKeyInput,
    doc,
    location,
    listeners,
    prompt,
  }
}

test('hydrates API key from cookie and uses it for requests', async () => {
  const { apiKeyInput, doc, location, listeners } = createDomStubs()
  const apiKeyValue = 'sk-test-key-1234567890'
  writeCookie(apiKeyCookieName, apiKeyValue, doc, location)

  setupApiKeyInput({ inputElt: apiKeyInput, doc, location })

  expect(apiKeyInput.value).toBe(apiKeyValue)
  expect(getApiKey()).toBe(apiKeyValue)

  const calls = []
  const fetchImpl = async (url, options) => {
    calls.push({ url, options })
    return {
      json: async () => ({
        output: [
          {
            content: [{ type: 'output_text', text: 'ok' }],
          },
        ],
      }),
    }
  }

  const result = await altQuery({ input: 'hello' }, { fetchImpl })
  expect(result).toBe('ok')
  expect(calls[0]?.options?.headers?.Authorization).toBe(`Bearer ${apiKeyValue}`)

  apiKeyInput.value = 'sk-new-key-1234567890'
  listeners.get('input')?.()
  expect(doc.cookie.includes('sk-new-key-1234567890')).toBe(true)
})
