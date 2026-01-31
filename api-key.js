let apiKey = ''
const apiKeyCookieName = 'openai_api_key'

function resolveDocument(doc) {
  if (doc) {
    return doc
  }
  if (typeof document === 'undefined') {
    return undefined
  }
  return document
}

function resolveLocation(location) {
  if (location) {
    return location
  }
  if (typeof window === 'undefined') {
    return undefined
  }
  return window.location
}

function readCookie(name, doc) {
  const resolvedDoc = resolveDocument(doc)
  if (!resolvedDoc || typeof resolvedDoc.cookie !== 'string') {
    return ''
  }
  const cookie = resolvedDoc.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`))
  if (!cookie) {
    return ''
  }
  return decodeURIComponent(cookie.split('=')[1] || '')
}

function writeCookie(name, value, doc, location) {
  const resolvedDoc = resolveDocument(doc)
  if (!resolvedDoc) {
    return
  }
  const resolvedLocation = resolveLocation(location)
  const maxAge = 60 * 60 * 24 * 365
  const secure = resolvedLocation?.protocol === 'https:' ? '; secure' : ''
  resolvedDoc.cookie = `${name}=${encodeURIComponent(value)}; max-age=${maxAge}; path=/; samesite=strict${secure}`
}

function applyApiKey(value, { persist = false, doc, location } = {}) {
  apiKey = value
  if (persist) {
    writeCookie(apiKeyCookieName, value, doc, location)
  }
}

function loadApiKey({ inputElt, doc, location } = {}) {
  const resolvedDoc = resolveDocument(doc)
  const resolvedInput = inputElt ?? resolvedDoc?.getElementById?.('api-key')
  const inputValue = resolvedInput?.value ?? ''
  if (inputValue) {
    applyApiKey(inputValue, { persist: true, doc: resolvedDoc, location })
  } else {
    const storedApiKey = readCookie(apiKeyCookieName, resolvedDoc)
    if (storedApiKey) {
      applyApiKey(storedApiKey, { persist: false })
    }
  }
  if (!(apiKey && apiKey.length > 10)) {
    console.error('Need an api-key')
  }
  return apiKey
}

function setupApiKeyInput({ inputElt, promptElt, doc, location } = {}) {
  const resolvedDoc = resolveDocument(doc)
  const resolvedInput = inputElt ?? resolvedDoc?.getElementById?.('api-key')
  const resolvedPrompt = promptElt ?? resolvedDoc?.getElementById?.('prompt')
  if (!resolvedInput) {
    return
  }
  const storedApiKey = readCookie(apiKeyCookieName, resolvedDoc)
  if (storedApiKey) {
    resolvedInput.value = storedApiKey
    applyApiKey(storedApiKey)
  }
  resolvedInput.addEventListener('input', () => {
    loadApiKey({ inputElt: resolvedInput, doc: resolvedDoc, location })
    resolvedPrompt?.focus?.()
  })
}

function getApiKey() {
  return apiKey
}

export {
  apiKeyCookieName,
  applyApiKey,
  getApiKey,
  loadApiKey,
  readCookie,
  setupApiKeyInput,
  writeCookie,
}
