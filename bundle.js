(() => {
  // api-key.js
  var apiKey = "";
  var apiKeyCookieName = "openai_api_key";
  function resolveDocument(doc) {
    if (doc) {
      return doc;
    }
    if (typeof document === "undefined") {
      return void 0;
    }
    return document;
  }
  function resolveLocation(location) {
    if (location) {
      return location;
    }
    if (typeof window === "undefined") {
      return void 0;
    }
    return window.location;
  }
  function readCookie(name, doc) {
    const resolvedDoc = resolveDocument(doc);
    if (!resolvedDoc || typeof resolvedDoc.cookie !== "string") {
      return "";
    }
    const cookie = resolvedDoc.cookie.split("; ").find((row) => row.startsWith(`${name}=`));
    if (!cookie) {
      return "";
    }
    return decodeURIComponent(cookie.split("=")[1] || "");
  }
  function writeCookie(name, value, doc, location) {
    const resolvedDoc = resolveDocument(doc);
    if (!resolvedDoc) {
      return;
    }
    const resolvedLocation = resolveLocation(location);
    const maxAge = 60 * 60 * 24 * 365;
    const secure = resolvedLocation?.protocol === "https:" ? "; secure" : "";
    resolvedDoc.cookie = `${name}=${encodeURIComponent(value)}; max-age=${maxAge}; path=/; samesite=strict${secure}`;
  }
  function applyApiKey(value, { persist = false, doc, location } = {}) {
    apiKey = value;
    if (persist) {
      writeCookie(apiKeyCookieName, value, doc, location);
    }
  }
  function loadApiKey({ inputElt, doc, location } = {}) {
    const resolvedDoc = resolveDocument(doc);
    const resolvedInput = inputElt ?? resolvedDoc?.getElementById?.("api-key");
    const inputValue = resolvedInput?.value ?? "";
    if (inputValue) {
      applyApiKey(inputValue, { persist: true, doc: resolvedDoc, location });
    } else {
      const storedApiKey = readCookie(apiKeyCookieName, resolvedDoc);
      if (storedApiKey) {
        applyApiKey(storedApiKey, { persist: false });
      }
    }
    if (!(apiKey && apiKey.length > 10)) {
      console.error("Need an api-key");
    }
    return apiKey;
  }
  function setupApiKeyInput({ inputElt, promptElt, doc, location } = {}) {
    const resolvedDoc = resolveDocument(doc);
    const resolvedInput = inputElt ?? resolvedDoc?.getElementById?.("api-key");
    const resolvedPrompt = promptElt ?? resolvedDoc?.getElementById?.("prompt");
    if (!resolvedInput) {
      return;
    }
    const storedApiKey = readCookie(apiKeyCookieName, resolvedDoc);
    if (storedApiKey) {
      resolvedInput.value = storedApiKey;
      applyApiKey(storedApiKey);
    }
    resolvedInput.addEventListener("input", () => {
      loadApiKey({ inputElt: resolvedInput, doc: resolvedDoc, location });
      resolvedPrompt?.focus?.();
    });
  }
  function getApiKey() {
    return apiKey;
  }

  // openai.js
  var DEFAULT_PARAMS = {
    model: "gpt-4o-mini",
    temperature: 0.8,
    max_output_tokens: 512,
    top_p: 1,
    frequency_penalty: 0.25,
    presence_penalty: 0.25
  };
  function getAuthHeader() {
    const apiKey2 = getApiKey();
    if (!(apiKey2 && apiKey2.length > 10)) {
      throw new Error("Need an api-key");
    }
    return `Bearer ${apiKey2}`;
  }
  function resolveFetch(fetchImpl) {
    if (fetchImpl) {
      return fetchImpl;
    }
    if (typeof fetch === "undefined") {
      throw new Error("Fetch is not available");
    }
    return fetch;
  }
  function resolveAlert(alertImpl) {
    if (alertImpl) {
      return alertImpl;
    }
    if (typeof alert === "undefined") {
      return () => {
      };
    }
    return alert;
  }
  async function createImage(imgPrompt, imageElt, { fetchImpl, alertImpl } = {}) {
    const resolvedFetch = resolveFetch(fetchImpl);
    const resolvedAlert = resolveAlert(alertImpl);
    const requestOptions = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": getAuthHeader()
      },
      body: JSON.stringify({
        prompt: imgPrompt,
        n: 1,
        size: "512x512",
        response_format: "b64_json"
      })
    };
    const response = await resolvedFetch("https://api.openai.com/v1/images/generations", requestOptions);
    const data = await response.json();
    if (data.error) {
      resolvedAlert(`${data.error.message} (openai.com)`);
      throw new Error(data.error.message);
    }
    const imageB64 = data.data[0].b64_json;
    const imageUrl = `data:image/png;base64, ${imageB64}`;
    imageElt.src = imageUrl;
  }
  async function altQuery(params = {}, { fetchImpl, alertImpl } = {}) {
    const resolvedFetch = resolveFetch(fetchImpl);
    const resolvedAlert = resolveAlert(alertImpl);
    const params_ = { ...DEFAULT_PARAMS, ...params };
    const requestOptions = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": getAuthHeader()
      },
      body: JSON.stringify(params_)
    };
    const response = await resolvedFetch("https://api.openai.com/v1/responses", requestOptions);
    const data = await response.json();
    if (data.error) {
      resolvedAlert(`${data.error.message} (openai.com)`);
      throw new Error(data.error.message);
    }
    const output = data.output?.[0]?.content?.find((item) => item.type === "output_text");
    if (!output?.text) {
      throw new Error("No output text returned from OpenAI.");
    }
    return output.text;
  }

  // index.js
  var controls = document.forms.controls;
  var replyElt = document.getElementById("reply-content");
  var historyLogElt = document.getElementById("history-log");
  var promptGamePrefix = "You are a text-based adventure game, similar to Zork.  You describe where I am and what is around me. After that, present me short numbered list of choices for what I may do next.  Then I make a choice, and you respond by telling me what happens next, and then prompt me to make my next decision, and so on.";
  var gameState;
  async function sendPrompt(prompt) {
    const req = {
      input: prompt
    };
    let reply = await altQuery(req);
    reply = reply.replace(/\s+/, "");
    return reply;
  }
  async function nextTurn() {
    gameState += replyElt.innerText;
    const humanPlay = controls.prompt.value;
    controls.prompt.value = "";
    gameState += `

 Your play: ${humanPlay}
 Game: `;
    const reply = await sendPrompt(promptGamePrefix + gameState);
    replyElt.innerText = reply;
    const match = reply.match(/(^.*\.)([^.]+\s*\n\s*1.*)/m);
    const logEntry = addLogEntry({
      humanPlay,
      reply
    });
    const imagePrompt = match && match.length > 1 && typeof match[1] === "string" ? match[1] : reply;
    createImage(imagePrompt, logEntry.image);
    historyLogElt.scrollTo(0, historyLogElt.scrollHeight);
  }
  function onSubmit() {
    event.preventDefault();
    loadApiKey();
    nextTurn();
  }
  function loadGameState() {
    gameState = document.forms.story.opening.value;
    historyLogElt.innerHTML = "";
    addLogEntry({
      humanPlay: "Game start",
      reply: gameState,
      imageUrl: "opening-scene.png"
    });
  }
  document.getElementById("opening-select").onchange = loadGameState;
  controls.prompt.value = "Ok, I'm ready to play";
  controls.submit.onclick = onSubmit;
  replyElt.innerText = "";
  setupApiKeyInput();
  loadGameState();
  function addLogEntry({ humanPlay, reply, imageUrl }) {
    const entry = document.createElement("div");
    entry.className = "log-entry";
    const image = document.createElement("img");
    image.alt = "AI rendering of game scene";
    image.src = imageUrl || "";
    const text = document.createElement("div");
    text.className = "log-text";
    text.innerText = `Your play: ${humanPlay}

Game: ${reply}`;
    entry.appendChild(image);
    entry.appendChild(text);
    historyLogElt.appendChild(entry);
    return { entry, image, text };
  }
})();
