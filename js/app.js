if (typeof marked !== 'undefined') {
  marked.setOptions({
    highlight(code, lang) {
      if (typeof hljs !== 'undefined') {
        if (lang && hljs.getLanguage(lang)) return hljs.highlight(code, { language: lang }).value;
        return hljs.highlightAuto(code).value;
      }
      return code;
    },
    breaks: true,
    gfm: true
  });
}

const STATE_KEY = 'krizrp_state_v4';
const DEFAULT_PROVIDER = 'kobold';
const GALLERY_BASE_URL = 'https://kriztech.in/krpstudio/api.php?action=get_gallery';

const PROVIDER_DEFAULTS = {
  kobold: { apiUrl: 'https://koboldai-koboldcpp-tiefighter.hf.space/api/v1/generate', model: '', needsKey: false },
  openai: { apiUrl: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o-mini', needsKey: true },
  groq: { apiUrl: 'https://api.groq.com/openai/v1/chat/completions', model: 'llama-3.3-70b-versatile', needsKey: true },
  openrouter: { apiUrl: 'https://openrouter.ai/api/v1/chat/completions', model: 'openai/gpt-4o-mini', needsKey: true },
  custom_openai: { apiUrl: 'https://api.openai.com/v1/chat/completions', model: '', needsKey: true }
};

const DEFAULT_PROMPT_TEMPLATE = `You are {{char}}.
You are not an assistant. You are this character's true self from this story world.
Never break character. Never narrate as "AI".
Treat the Character Persona and Story as your own identity and lived reality.

Character Persona:
{{persona}}

Character Story / World:
{{story}}

World Rules:
{{world_rules}}

Player Notes:
{{player_notes}}

Memory:
{{memory}}

Recent Dialogue:
{{history}}

Response rules:
- Reply as {{char}} in immersive first-person roleplay.
- Do NOT write lines for {{user}}.
- Accept both direct and indirect user input naturally.
- Keep continuity with memory and story.
- If content is unsafe, refuse in-character while preserving roleplay tone.`;

const dom = {
  userName: document.getElementById('user-name-input'),
  charName: document.getElementById('character-name-input'),
  userAvatar: document.getElementById('user-avatar-input'),
  charAvatarInput: document.getElementById('char-avatar-input'),
  persona: document.getElementById('character-sheet-input'),
  worldRules: document.getElementById('world-rules-input'),
  playerNotes: document.getElementById('player-notes-input'),
  promptTemplate: document.getElementById('prompt-template-input'),

  provider: document.getElementById('provider-select'),
  apiUrl: document.getElementById('api-url-input'),
  apiKey: document.getElementById('api-key-input'),
  model: document.getElementById('model-input'),
  providerHint: document.getElementById('provider-hint'),
  providerTestBtn: document.getElementById('provider-test-btn'),
  clearSecretsBtn: document.getElementById('clear-secrets-btn'),
  persistApiKey: document.getElementById('persist-api-key-switch'),

  temp: document.getElementById('temperature-input'),
  maxTokens: document.getElementById('max-tokens-input'),
  topP: document.getElementById('top-p-input'),
  repPen: document.getElementById('rep-pen-input'),
  streaming: document.getElementById('streaming-switch'),

  tavernInput: document.getElementById('tavern-card-input'),
  tavernStatus: document.getElementById('tavern-card-status'),

  gallerySearch: document.getElementById('gallery-search-input'),
  gallerySearchBtn: document.getElementById('gallery-search-btn'),
  galleryList: document.getElementById('gallery-list'),
  galleryMeta: document.getElementById('gallery-meta'),
  galleryPrevBtn: document.getElementById('gallery-prev-btn'),
  galleryNextBtn: document.getElementById('gallery-next-btn'),

  persist: document.getElementById('persist-switch'),
  bundleExportBtn: document.getElementById('bundle-export-btn'),
  bundleImportBtn: document.getElementById('bundle-import-btn'),
  bundleImportInput: document.getElementById('bundle-import-input'),

  startBtn: document.getElementById('start-chat-button'),
  mobileStartBtn: document.getElementById('mobile-start-btn'),
  regenerateBtn: document.getElementById('regenerate-btn'),
  mobileRegenerateBtn: document.getElementById('mobile-regenerate-btn'),
  editLastUserBtn: document.getElementById('edit-last-user-btn'),
  resetPromptBtn: document.getElementById('reset-prompt-btn'),

  clearHistory: document.getElementById('clear-history'),
  exportTxt: document.getElementById('export-btn'),

  chatbox: document.getElementById('chatbox'),
  userInput: document.getElementById('user_input'),
  sendBtn: document.getElementById('send_button'),
  typing: document.getElementById('typing-indicator'),
  typingText: document.getElementById('typing-text'),

  charAvatar: document.getElementById('char-avatar'),
  charDisplayName: document.getElementById('character-name-display'),
  charMiniBio: document.getElementById('character-bio-mini'),

  memToggle: document.getElementById('toggle-memory'),
  memPanel: document.getElementById('memory-panel'),
  memEmotion: document.getElementById('mem-emotion'),
  memFacts: document.getElementById('mem-facts'),
  memRel: document.getElementById('mem-relationships'),
  memWorld: document.getElementById('mem-world'),
  memEvents: document.getElementById('mem-events'),
  memClear: document.getElementById('memory-clear')
};

let history = [];
let currentUserName = 'Player';
let currentCharacterName = 'Character';
let waiting = false;
let currentLtmKey = '';
let ltm = createBlankMemory();
let galleryPage = 1;

function createBlankMemory() {
  return {
    facts: [],
    relationships: [],
    world: [],
    events: [],
    emotion: { trust: 0, affinity: 0, tension: 0, curiosity: 0 },
    metadata: { createdAt: Date.now(), lastUpdated: Date.now() }
  };
}

function escapeHtml(s) {
  return String(s || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function mkId(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function characterScopedLtmKey(name) {
  const slug = (name || 'character').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return `kriz_ltm_${slug || 'character'}`;
}

function setCharacterMemoryScope(name) {
  currentLtmKey = characterScopedLtmKey(name);
  const raw = localStorage.getItem(currentLtmKey);
  if (!raw) {
    ltm = createBlankMemory();
  } else {
    try {
      ltm = Object.assign(createBlankMemory(), JSON.parse(raw));
    } catch {
      ltm = createBlankMemory();
    }
  }
  updateMemoryPanel();
}

function saveLtm() {
  if (!currentLtmKey) return;
  ltm.metadata.lastUpdated = Date.now();
  localStorage.setItem(currentLtmKey, JSON.stringify(ltm));
  updateMemoryPanel();
}

function pushMemory(list, text, max = 120) {
  if (!text?.trim()) return;
  const t = text.trim();
  if (ltm[list].some((x) => (x.text || '').toLowerCase() === t.toLowerCase())) return;
  ltm[list].push({ id: mkId(list), text: t, ts: Date.now() });
  if (ltm[list].length > max) ltm[list] = ltm[list].slice(-Math.floor(max * 0.8));
  saveLtm();
}

function memoryFromUser(msg) {
  if (!msg?.trim()) return;
  const text = msg.trim();
  [/i am ([^.!?]{2,60})/i, /i'm ([^.!?]{2,60})/i, /my name is ([^.!?]{2,60})/i].forEach((p) => {
    const m = text.match(p);
    if (m?.[0]) pushMemory('facts', m[0]);
  });
  const world = text.match(/(in the [a-z0-9 ]{3,80}|at the [a-z0-9 ]{3,80}|on the [a-z0-9 ]{3,80})/i);
  if (world?.[0]) pushMemory('world', world[0]);
  if (/(we met|we found|we discovered|remember this|last time)/i.test(text)) pushMemory('events', text, 220);
}

function memoryFromBot(msg) {
  if (!msg?.trim()) return;
  if (/i promise|i swear|i will always|i will never/i.test(msg)) pushMemory('events', `Promise: ${msg}`, 220);
}

function buildMemorySummary() {
  const facts = ltm.facts.slice(-6).map((x) => x.text).join('; ') || '(none)';
  const world = ltm.world.slice(-6).map((x) => x.text).join('; ') || '(none)';
  const events = ltm.events.slice(-6).map((x) => x.text).join(' | ') || '(none)';
  const rel = ltm.relationships[0]?.text || '(none)';
  return `Facts: ${facts}\nWorld: ${world}\nEvents: ${events}\nRelationship: ${rel}`;
}

function updateMemoryPanel() {
  dom.memEmotion.textContent = `trust ${ltm.emotion.trust.toFixed(2)} | affinity ${ltm.emotion.affinity.toFixed(2)} | tension ${ltm.emotion.tension.toFixed(2)} | curiosity ${ltm.emotion.curiosity.toFixed(2)}`;
  dom.memFacts.innerHTML = ltm.facts.length ? ltm.facts.slice(-20).map((f) => `• ${escapeHtml(f.text)}`).join('<br>') : '<i>No facts yet</i>';
  dom.memRel.innerHTML = ltm.relationships.length ? ltm.relationships.slice(-10).map((f) => `• ${escapeHtml(f.text)}`).join('<br>') : '<i>No relationships yet</i>';
  dom.memWorld.innerHTML = ltm.world.length ? ltm.world.slice(-20).map((f) => `• ${escapeHtml(f.text)}`).join('<br>') : '<i>No lore yet</i>';
  dom.memEvents.innerHTML = ltm.events.length ? ltm.events.slice(-20).map((f) => `• ${escapeHtml(f.text)}`).join('<br>') : '<i>No events yet</i>';
}

function renderTemplate(template, vars) {
  return String(template || '').replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) => vars[key] ?? '');
}

function buildCompiledPrompt() {
  const conversationText = history.slice(-12).map((m) => `${m.role === 'user' ? currentUserName : currentCharacterName}: ${m.content}`).join('\n');
  return renderTemplate(dom.promptTemplate.value || DEFAULT_PROMPT_TEMPLATE, {
    char: currentCharacterName,
    user: currentUserName,
    persona: dom.persona.value.trim(),
    story: dom.worldRules.value.trim(),
    world_rules: dom.worldRules.value.trim(),
    player_notes: dom.playerNotes.value.trim(),
    memory: buildMemorySummary(),
    history: conversationText
  });
}

function buildStops() {
  return [...new Set([`${currentUserName}:`, `${currentCharacterName}:`, '\nUser:', '\nPlayer:', '\nAssistant:'])];
}

function sanitizeBotOutput(raw) {
  let s = String(raw || '').trim();
  if (!s) return '(the character is silent)';
  for (const seq of buildStops()) {
    const idx = s.indexOf(seq);
    if (idx > -1) s = s.slice(0, idx).trim();
  }
  const p = new RegExp(`^${currentCharacterName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[:\\s-]*`, 'i');
  s = s.replace(p, '').trim();
  if (s.length > 2400) s = `${s.slice(0, 2360)}…`;
  return s || '(the character is silent)';
}

function renderMd(text) {
  if (typeof marked !== 'undefined') {
    const html = marked.parse(text || '');
    return typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(html) : html;
  }
  return escapeHtml(text).replaceAll('\n', '<br>');
}

function appendMessage(role, text, replaceId = null) {
  let wrapper;
  if (replaceId) {
    wrapper = document.getElementById(replaceId);
    if (!wrapper) wrapper = document.createElement('div');
    wrapper.innerHTML = '';
  } else {
    wrapper = document.createElement('div');
    wrapper.classList.add('msg-container', 'msg-enter', role === 'user' ? 'msg-user' : 'msg-bot');
    wrapper.id = mkId('msg');
  }

  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const body = renderMd(text);

  if (role === 'user') {
    const uAvatar = dom.userAvatar.value.trim();
    wrapper.innerHTML = `<div class="flex justify-end items-start"><div class="max-w-[85%] bubble px-5 py-3 text-sm markdown-body">${body}<div class="flex justify-end mt-1 text-[10px] opacity-70 pt-1">${time}</div></div>${uAvatar ? `<div class="w-10 h-10 rounded-full bg-cover bg-center ml-3 avatar-ring" style="background-image:url('${escapeHtml(uAvatar)}')"></div>` : ''}</div>`;
  } else {
    const cAvatar = dom.charAvatarInput.value.trim();
    const avatar = cAvatar ? `<div class="w-10 h-10 rounded-full bg-cover bg-center shrink-0 avatar-ring" style="background-image:url('${escapeHtml(cAvatar)}')"></div>` : `<div class="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold shrink-0 avatar-ring">${escapeHtml(currentCharacterName.charAt(0) || 'C')}</div>`;
    wrapper.innerHTML = `<div class="flex items-start gap-3">${avatar}<div class="max-w-[88%] bubble px-5 py-3 text-sm markdown-body">${body}<div class="mt-1 text-[10px] opacity-60 pt-1">${time}</div></div></div>`;
  }

  if (!replaceId) dom.chatbox.appendChild(wrapper);
  dom.chatbox.scrollTop = dom.chatbox.scrollHeight;
  wrapper.querySelectorAll('pre code').forEach((b) => typeof hljs !== 'undefined' && hljs.highlightElement(b));
  return wrapper.id;
}

function renderConversation() {
  dom.chatbox.innerHTML = '';
  history.forEach((m) => appendMessage(m.role, m.content));
}

function setTyping(show, text = '') {
  if (show) {
    dom.typingText.textContent = text ? `${text} is thinking…` : 'Thinking…';
    dom.typing.classList.remove('hidden');
  } else {
    dom.typing.classList.add('hidden');
  }
}

function updateProviderUi(useDefaults = false) {
  const cfg = PROVIDER_DEFAULTS[dom.provider.value] || PROVIDER_DEFAULTS.kobold;
  if (useDefaults) {
    dom.apiUrl.value = cfg.apiUrl;
    dom.model.value = cfg.model;
  }
  dom.apiKey.type = cfg.needsKey ? 'password' : 'text';
  dom.apiKey.placeholder = cfg.needsKey ? 'API key required' : 'Optional for Kobold';
  dom.providerHint.textContent = dom.provider.value === 'kobold' ? 'Kobold default works without key. Great for local/quick RP.' : 'OpenAI-compatible endpoint selected. Provide API key and model.';
}

function updateCharacterUi() {
  currentUserName = dom.userName.value.trim() || 'Player';
  currentCharacterName = dom.charName.value.trim() || 'Character';
  dom.charDisplayName.textContent = currentCharacterName;
  dom.charMiniBio.textContent = (dom.persona.value || '').slice(0, 140);
  const avatarUrl = dom.charAvatarInput.value.trim();
  if (avatarUrl) {
    dom.charAvatar.style.backgroundImage = `url('${escapeHtml(avatarUrl)}')`;
    dom.charAvatar.textContent = '';
  } else {
    dom.charAvatar.style.backgroundImage = '';
    dom.charAvatar.textContent = currentCharacterName.charAt(0) || 'C';
  }
  setCharacterMemoryScope(currentCharacterName);
}

function saveState() {
  if (!dom.persist.checked) return;
  const payload = {
    settings: {
      userName: dom.userName.value,
      charName: dom.charName.value,
      userAvatar: dom.userAvatar.value,
      charAvatar: dom.charAvatarInput.value,
      persona: dom.persona.value,
      worldRules: dom.worldRules.value,
      playerNotes: dom.playerNotes.value,
      promptTemplate: dom.promptTemplate.value,
      provider: dom.provider.value,
      apiUrl: dom.apiUrl.value,
      model: dom.model.value,
      persistApiKey: dom.persistApiKey.checked,
      apiKey: dom.persistApiKey.checked ? dom.apiKey.value : '',
      generation: {
        temperature: dom.temp.value,
        maxTokens: dom.maxTokens.value,
        topP: dom.topP.value,
        repPen: dom.repPen.value,
        streaming: dom.streaming.checked
      }
    },
    history
  };
  localStorage.setItem(STATE_KEY, JSON.stringify(payload));
}

function loadState() {
  const raw = localStorage.getItem(STATE_KEY);
  dom.promptTemplate.value = DEFAULT_PROMPT_TEMPLATE;
  dom.provider.value = DEFAULT_PROVIDER;
  updateProviderUi(true);
  if (!raw) return;
  try {
    const p = JSON.parse(raw);
    const s = p.settings || {};
    dom.userName.value = s.userName || '';
    dom.charName.value = s.charName || '';
    dom.userAvatar.value = s.userAvatar || '';
    dom.charAvatarInput.value = s.charAvatar || '';
    dom.persona.value = s.persona || dom.persona.value;
    dom.worldRules.value = s.worldRules || dom.worldRules.value;
    dom.playerNotes.value = s.playerNotes || dom.playerNotes.value;
    dom.promptTemplate.value = s.promptTemplate || DEFAULT_PROMPT_TEMPLATE;

    dom.provider.value = s.provider || DEFAULT_PROVIDER;
    dom.apiUrl.value = s.apiUrl || (PROVIDER_DEFAULTS[dom.provider.value]?.apiUrl || PROVIDER_DEFAULTS.kobold.apiUrl);
    dom.model.value = s.model || (PROVIDER_DEFAULTS[dom.provider.value]?.model || '');
    dom.persistApiKey.checked = Boolean(s.persistApiKey);
    dom.apiKey.value = s.persistApiKey ? (s.apiKey || '') : '';

    if (s.generation) {
      dom.temp.value = s.generation.temperature || dom.temp.value;
      dom.maxTokens.value = s.generation.maxTokens || dom.maxTokens.value;
      dom.topP.value = s.generation.topP || dom.topP.value;
      dom.repPen.value = s.generation.repPen || dom.repPen.value;
      dom.streaming.checked = s.generation.streaming !== false;
    }

    history = Array.isArray(p.history) ? p.history : [];
  } catch {
    // no-op
  }
}

async function fetchWithTimeout(url, options = {}, ms = 35000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timeout);
  }
}

function getGenConfig() {
  return {
    temperature: Number(dom.temp.value || 0.8),
    maxTokens: Number(dom.maxTokens.value || 500),
    topP: Number(dom.topP.value || 0.92),
    repPen: Number(dom.repPen.value || 1.05)
  };
}

async function requestKobold({ apiUrl, prompt }) {
  const g = getGenConfig();
  const payload = {
    prompt,
    max_length: g.maxTokens,
    temperature: g.temperature,
    top_p: g.topP,
    rep_pen: g.repPen,
    do_sample: true,
    stop_sequence: buildStops()
  };
  const res = await fetchWithTimeout(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }, 45000);
  if (!res.ok) throw new Error(`Kobold HTTP ${res.status}`);
  const json = await res.json();
  return json?.results?.[0]?.text || json?.text || '';
}

function buildOpenAiHeaders(provider, apiKey) {
  const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` };
  if (provider === 'openrouter') {
    h['HTTP-Referer'] = window.location.origin || 'http://localhost';
    h['X-Title'] = 'KrizVibe RP Studio';
  }
  return h;
}

function buildOpenAiMessages() {
  return [{ role: 'system', content: buildCompiledPrompt() }].concat(history.slice(-14).map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content })));
}

async function requestOpenAiCompatibleStreaming({ apiUrl, headers, payload, onDelta }) {
  payload.stream = true;
  const res = await fetchWithTimeout(apiUrl, { method: 'POST', headers, body: JSON.stringify(payload) }, 60000);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() || '';
    for (const line of lines) {
      const l = line.trim();
      if (!l.startsWith('data:')) continue;
      const data = l.slice(5).trim();
      if (data === '[DONE]') return;
      try {
        const json = JSON.parse(data);
        const delta = json?.choices?.[0]?.delta?.content || '';
        if (delta) onDelta(delta);
      } catch {
        // ignore parse chunk
      }
    }
  }
}

async function requestOpenAiCompatible({ apiUrl, provider, apiKey, model, stream, onDelta }) {
  const g = getGenConfig();
  const headers = buildOpenAiHeaders(provider, apiKey);
  const payload = { model, messages: buildOpenAiMessages(), temperature: g.temperature, max_tokens: g.maxTokens, top_p: g.topP };
  if (stream) {
    let txt = '';
    await requestOpenAiCompatibleStreaming({ apiUrl, headers, payload, onDelta: (d) => { txt += d; onDelta?.(txt); } });
    return txt;
  }
  const res = await fetchWithTimeout(apiUrl, { method: 'POST', headers, body: JSON.stringify(payload) }, 60000);
  if (!res.ok) throw new Error(`${provider} HTTP ${res.status}`);
  const json = await res.json();
  return json?.choices?.[0]?.message?.content || '';
}

async function generateReply(streamHook = null) {
  const provider = dom.provider.value;
  const apiUrl = dom.apiUrl.value.trim();
  const apiKey = dom.apiKey.value.trim();
  const model = dom.model.value.trim();
  if (!apiUrl) throw new Error('API URL missing');

  if (provider === 'kobold') {
    const prompt = `${buildCompiledPrompt()}\n\n${history.slice(-12).map((m) => `${m.role === 'user' ? currentUserName : currentCharacterName}: ${m.content}`).join('\n')}\n${currentCharacterName}:`;
    return requestKobold({ apiUrl, prompt });
  }
  if (!apiKey) throw new Error('API key missing');
  if (!model) throw new Error('Model missing');
  return requestOpenAiCompatible({ apiUrl, provider, apiKey, model, stream: dom.streaming.checked, onDelta: streamHook });
}

async function testProvider() {
  dom.providerTestBtn.textContent = 'Testing...';
  try {
    if (dom.provider.value === 'kobold') {
      await requestKobold({ apiUrl: dom.apiUrl.value.trim(), prompt: 'KrizVibe test prompt\nCharacter:' });
    } else {
      await requestOpenAiCompatible({
        apiUrl: dom.apiUrl.value.trim(),
        provider: dom.provider.value,
        apiKey: dom.apiKey.value.trim(),
        model: dom.model.value.trim(),
        stream: false
      });
    }
    dom.providerHint.textContent = 'Connection test passed ✅';
  } catch (e) {
    dom.providerHint.textContent = `Connection failed: ${e.message}`;
  } finally {
    dom.providerTestBtn.textContent = 'Test Connection';
  }
}

async function sendMessage({ regenerate = false } = {}) {
  if (waiting) return;
  const text = dom.userInput.value.trim();

  if (!regenerate) {
    if (!text) return;
    history.push({ role: 'user', content: text, ts: Date.now() });
    appendMessage('user', text);
    memoryFromUser(text);
    dom.userInput.value = '';
    dom.userInput.style.height = 'auto';
  }

  waiting = true;
  setTyping(true, currentCharacterName);

  let streamMsgId = null;
  let streamText = '';

  try {
    if (dom.streaming.checked && dom.provider.value !== 'kobold') {
      streamMsgId = appendMessage('bot', '');
    }
    const raw = await generateReply((partial) => {
      streamText = partial;
      if (streamMsgId) appendMessage('bot', sanitizeBotOutput(partial), streamMsgId);
    });

    const clean = sanitizeBotOutput(raw || streamText);
    if (streamMsgId) appendMessage('bot', clean, streamMsgId);
    else appendMessage('bot', clean);

    if (history.length && history[history.length - 1].role === 'bot' && regenerate) {
      history[history.length - 1].content = clean;
      history[history.length - 1].ts = Date.now();
    } else {
      history.push({ role: 'bot', content: clean, ts: Date.now() });
    }

    memoryFromBot(clean);
    saveState();
  } catch (e) {
    const errText = `${currentCharacterName} could not respond. (${e.message})`;
    appendMessage('bot', errText);
    history.push({ role: 'bot', content: errText, ts: Date.now() });
  } finally {
    waiting = false;
    setTyping(false);
    saveState();
  }
}

function regenerateLast() {
  const lastUser = [...history].reverse().find((m) => m.role === 'user');
  if (!lastUser) return;
  if (history.length && history[history.length - 1].role === 'bot') history.pop();
  renderConversation();
  sendMessage({ regenerate: true });
}

function editLastUser() {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (history[i].role === 'user') {
      dom.userInput.value = history[i].content;
      history = history.slice(0, i);
      if (history.length && history[history.length - 1].role === 'bot') history.pop();
      renderConversation();
      saveState();
      dom.userInput.focus();
      return;
    }
  }
}

function applyImportedCard(card) {
  const c = card?.data || card;
  if (!c) return;
  const name = c.name || c.char_name || c.title || '';
  const description = c.description || c.persona || c.tagline || '';
  const personality = c.personality || '';
  const scenario = c.scenario || c.story || '';
  const firstMes = c.first_mes || c.greeting || '';
  const systemPrompt = c.system_prompt || '';

  if (name) dom.charName.value = name;
  const persona = [description, personality].filter(Boolean).join('\n\n');
  if (persona) dom.persona.value = persona;
  if (scenario) dom.worldRules.value = scenario;

  if (systemPrompt) {
    dom.promptTemplate.value = systemPrompt;
  }

  if (c.avatar_url) dom.charAvatarInput.value = c.avatar_url;

  updateCharacterUi();

  if (firstMes && !history.length) {
    history.push({ role: 'bot', content: firstMes, ts: Date.now() });
    renderConversation();
  }

  dom.tavernStatus.textContent = `Imported ${name || 'character'} successfully.`;
  saveState();
}

function readNullTextChunk(decoded) {
  const nul = decoded.indexOf('\0');
  if (nul < 1) return null;
  return { keyword: decoded.slice(0, nul), value: decoded.slice(nul + 1) };
}

function extractCardFromPng(buffer) {
  const bytes = new Uint8Array(buffer);
  const dv = new DataView(buffer);
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < sig.length; i += 1) if (bytes[i] !== sig[i]) throw new Error('Invalid PNG');

  let offset = 8;
  while (offset < bytes.length) {
    const len = dv.getUint32(offset);
    const type = String.fromCharCode(...bytes.slice(offset + 4, offset + 8));
    const chunk = bytes.slice(offset + 8, offset + 8 + len);

    if (type === 'tEXt') {
      const decoded = new TextDecoder().decode(chunk);
      const kv = readNullTextChunk(decoded);
      if (kv && kv.keyword.toLowerCase() === 'chara') return JSON.parse(atob(kv.value));
    }

    if (type === 'iTXt') {
      const decoded = new TextDecoder().decode(chunk);
      if (decoded.startsWith('chara\0')) {
        const parts = decoded.split('\0');
        const maybe = parts[parts.length - 1];
        try {
          return JSON.parse(atob(maybe));
        } catch {
          // ignore invalid base64
        }
      }
    }

    if (type === 'zTXt') {
      throw new Error('zTXt compressed cards are not supported yet. Please export JSON or standard PNG card.');
    }

    offset += len + 12;
  }
  throw new Error('No Tavern card metadata found');
}

async function importTavernFile(file) {
  if (!file) return;
  dom.tavernStatus.textContent = 'Importing card...';
  try {
    let card;
    if (file.name.toLowerCase().endsWith('.png')) {
      card = extractCardFromPng(await file.arrayBuffer());
    } else {
      card = JSON.parse(await file.text());
    }
    applyImportedCard(card);
  } catch (e) {
    dom.tavernStatus.textContent = `Import failed: ${e.message}`;
  }
}

function galleryCardToLocalCard(node) {
  return {
    name: node.name,
    description: node.description || node.tagline || '',
    scenario: `Tags: ${(node.topics || []).join(', ')}`,
    greeting: `*${node.name} notices you.* ${node.tagline || 'Ready to start roleplay.'}`,
    avatar_url: node.avatar_url || ''
  };
}

function renderGallery(nodes = []) {
  dom.galleryList.innerHTML = nodes.map((n) => {
    const topics = (n.topics || []).slice(0, 4).join(', ');
    return `<div class="gallery-item"><div class="flex items-start justify-between gap-2"><div><h4>${escapeHtml(n.name)}</h4><p class="text-[11px] text-slate-500 mt-1">⭐ ${n.starCount || 0} • ${escapeHtml(topics)}</p><p class="text-xs text-slate-600 mt-1 line-clamp-3">${escapeHtml((n.tagline || n.description || '').slice(0, 220))}</p></div><button class="sub-btn !px-2 !py-1 text-xs" data-import-id="${n.id}">Import</button></div></div>`;
  }).join('') || '<p class="text-xs text-slate-500">No characters found.</p>';

  dom.galleryList.querySelectorAll('[data-import-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = Number(btn.getAttribute('data-import-id'));
      const node = nodes.find((x) => x.id === id);
      if (!node) return;
      applyImportedCard(galleryCardToLocalCard(node));
      dom.tavernStatus.textContent = `Imported from gallery: ${node.name}`;
    });
  });
}

async function loadGallery(page = 1, search = '') {
  dom.galleryMeta.textContent = 'Loading...';
  const url = `${GALLERY_BASE_URL}&page=${encodeURIComponent(page)}&search=${encodeURIComponent(search)}`;
  try {
    const res = await fetchWithTimeout(url, {}, 25000);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const data = json?.data || {};
    const nodes = data.nodes || [];
    renderGallery(nodes);
    dom.galleryMeta.textContent = `Page ${data.page || page} • ${data.count || nodes.length} results`;
    galleryPage = data.page || page;
  } catch (e) {
    dom.galleryMeta.textContent = `Gallery unavailable: ${e.message}`;
    renderGallery([]);
  }
}

function exportBundle() {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: {
      userName: dom.userName.value,
      charName: dom.charName.value,
      userAvatar: dom.userAvatar.value,
      charAvatar: dom.charAvatarInput.value,
      persona: dom.persona.value,
      worldRules: dom.worldRules.value,
      playerNotes: dom.playerNotes.value,
      promptTemplate: dom.promptTemplate.value,
      provider: dom.provider.value,
      apiUrl: dom.apiUrl.value,
      model: dom.model.value,
      generation: {
        temperature: dom.temp.value,
        maxTokens: dom.maxTokens.value,
        topP: dom.topP.value,
        repPen: dom.repPen.value,
        streaming: dom.streaming.checked
      }
    },
    history,
    memory: ltm
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${(currentCharacterName || 'character').replace(/\s+/g, '_')}_bundle.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function importBundle(file) {
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const s = data.settings || {};
    dom.userName.value = s.userName || '';
    dom.charName.value = s.charName || '';
    dom.userAvatar.value = s.userAvatar || '';
    dom.charAvatarInput.value = s.charAvatar || '';
    dom.persona.value = s.persona || '';
    dom.worldRules.value = s.worldRules || '';
    dom.playerNotes.value = s.playerNotes || '';
    dom.promptTemplate.value = s.promptTemplate || DEFAULT_PROMPT_TEMPLATE;
    dom.provider.value = s.provider || DEFAULT_PROVIDER;
    dom.apiUrl.value = s.apiUrl || PROVIDER_DEFAULTS[dom.provider.value].apiUrl;
    dom.model.value = s.model || PROVIDER_DEFAULTS[dom.provider.value].model;

    if (s.generation) {
      dom.temp.value = s.generation.temperature || dom.temp.value;
      dom.maxTokens.value = s.generation.maxTokens || dom.maxTokens.value;
      dom.topP.value = s.generation.topP || dom.topP.value;
      dom.repPen.value = s.generation.repPen || dom.repPen.value;
      dom.streaming.checked = s.generation.streaming !== false;
    }

    history = Array.isArray(data.history) ? data.history : [];
    ltm = Object.assign(createBlankMemory(), data.memory || createBlankMemory());

    updateProviderUi();
    updateCharacterUi();
    renderConversation();
    saveLtm();
    saveState();
  } catch (e) {
    alert(`Bundle import failed: ${e.message}`);
  }
}

function clearSecrets() {
  dom.apiKey.value = '';
  dom.persistApiKey.checked = false;
  saveState();
}

function startSession() {
  updateCharacterUi();
  if (!history.length) {
    const greeting = `Hello ${currentUserName}. I am ${currentCharacterName}. Shall we begin our story?`;
    history.push({ role: 'bot', content: greeting, ts: Date.now() });
    appendMessage('bot', greeting);
  } else {
    renderConversation();
  }
  saveState();
}

function init() {
  feather.replace();

  loadState();
  updateProviderUi();
  updateCharacterUi();
  renderConversation();
  loadGallery(1, '');

  dom.userInput.addEventListener('input', function onInput() {
    this.style.height = 'auto';
    this.style.height = `${this.scrollHeight}px`;
  });

  document.getElementById('menu-toggle').onclick = () => {
    document.querySelector('.sidebar')?.classList.toggle('open');
    document.getElementById('sidebar-overlay')?.classList.toggle('hidden');
  };
  window.toggleSidebar = document.getElementById('menu-toggle').onclick;
  document.getElementById('sidebar-overlay').onclick = window.toggleSidebar;

  dom.provider.addEventListener('change', () => { updateProviderUi(true); saveState(); });
  dom.providerTestBtn.addEventListener('click', testProvider);
  dom.clearSecretsBtn.addEventListener('click', clearSecrets);
  dom.resetPromptBtn.addEventListener('click', () => { dom.promptTemplate.value = DEFAULT_PROMPT_TEMPLATE; saveState(); });
  dom.startBtn.addEventListener('click', startSession);
  dom.mobileStartBtn.addEventListener('click', startSession);
  dom.sendBtn.addEventListener('click', () => sendMessage());
  dom.userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  dom.regenerateBtn.addEventListener('click', regenerateLast);
  dom.mobileRegenerateBtn.addEventListener('click', regenerateLast);
  dom.editLastUserBtn.addEventListener('click', editLastUser);
  dom.memToggle.addEventListener('click', () => dom.memPanel.classList.toggle('hidden'));
  dom.memClear.addEventListener('click', () => {
    if (!confirm('Reset character memory?')) return;
    ltm = createBlankMemory();
    saveLtm();
  });

  dom.clearHistory.addEventListener('click', () => {
    if (!confirm('Clear chat history?')) return;
    history = [];
    renderConversation();
    saveState();
  });

  dom.exportTxt.addEventListener('click', () => {
    const txt = history.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
    const blob = new Blob([txt], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(currentCharacterName || 'chat').replace(/\s+/g, '_')}_transcript.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  dom.bundleExportBtn.addEventListener('click', exportBundle);
  dom.bundleImportBtn.addEventListener('click', () => dom.bundleImportInput.click());
  dom.bundleImportInput.addEventListener('change', () => importBundle(dom.bundleImportInput.files?.[0]));

  dom.tavernInput.addEventListener('change', () => importTavernFile(dom.tavernInput.files?.[0]));

  dom.gallerySearchBtn.addEventListener('click', () => loadGallery(1, dom.gallerySearch.value.trim()));
  dom.gallerySearch.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') loadGallery(1, dom.gallerySearch.value.trim());
  });
  dom.galleryPrevBtn.addEventListener('click', () => loadGallery(Math.max(1, galleryPage - 1), dom.gallerySearch.value.trim()));
  dom.galleryNextBtn.addEventListener('click', () => loadGallery(galleryPage + 1, dom.gallerySearch.value.trim()));

  [
    dom.userName, dom.charName, dom.userAvatar, dom.charAvatarInput, dom.persona, dom.worldRules, dom.playerNotes,
    dom.promptTemplate, dom.apiUrl, dom.apiKey, dom.model, dom.persist, dom.persistApiKey, dom.temp, dom.maxTokens,
    dom.topP, dom.repPen, dom.streaming
  ].forEach((el) => el.addEventListener('input', () => {
    if (el === dom.charName || el === dom.persona || el === dom.charAvatarInput || el === dom.userName) updateCharacterUi();
    saveState();
  }));
}

init();
