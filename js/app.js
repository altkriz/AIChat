// Init external libs
if (typeof AOS !== 'undefined') AOS.init();
feather.replace();

if (typeof marked !== 'undefined') {
  marked.setOptions({
    highlight(code, lang) {
      if (typeof hljs !== 'undefined') {
        if (lang && hljs.getLanguage(lang)) {
          return hljs.highlight(code, { language: lang }).value;
        }
        return hljs.highlightAuto(code).value;
      }
      return code;
    },
    breaks: true,
    gfm: true
  });
}

/* ---------------------------
   Constants / defaults
   --------------------------- */
const STATE_KEY = 'krizrp_state_v2';
const LTM_STORAGE_KEY = 'kriz_rp_ltmemory_v1';
const DEFAULT_PROVIDER = 'kobold';

const PROVIDER_DEFAULTS = {
  kobold: {
    apiUrl: 'https://koboldai-koboldcpp-tiefighter.hf.space/api/v1/generate',
    model: '',
    needsKey: false
  },
  openai: {
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o-mini',
    needsKey: true
  },
  groq: {
    apiUrl: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'llama-3.3-70b-versatile',
    needsKey: true
  },
  openrouter: {
    apiUrl: 'https://openrouter.ai/api/v1/chat/completions',
    model: 'openai/gpt-4o-mini',
    needsKey: true
  },
  custom_openai: {
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    model: '',
    needsKey: true
  }
};

const DEFAULT_PROMPT_TEMPLATE = `You are {{char}}, a dedicated roleplay character.
Stay fully in character in first-person.
Never roleplay for {{user}}.

Character Persona:
{{persona}}

Scenario:
{{scenario}}

World Rules:
{{world_rules}}

Player Notes:
{{player_notes}}

Memory Summary:
{{memory}}

Style Rules:
- Keep responses immersive, specific, and scene-aware.
- Respect safety boundaries while staying in character.
- Avoid assistant disclaimers and OOC unless explicitly requested.`;

let longTermMemory = {
  facts: [],
  relationships: [],
  world: [],
  events: [],
  emotion: { trust: 0, affinity: 0, tension: 0, curiosity: 0 },
  metadata: { createdAt: Date.now(), lastUpdated: Date.now() }
};

let conversationHistory = [];
let currentUserName = '';
let currentCharacterName = '';
let isWaitingForResponse = false;

/* ---------------------------
   DOM refs
   --------------------------- */
const userNameInputEl = document.getElementById('user-name-input');
const characterNameInputEl = document.getElementById('character-name-input');
const charSheetEl = document.getElementById('character-sheet-input');
const playerNotesEl = document.getElementById('player-notes-input');
const worldRulesEl = document.getElementById('world-rules-input');
const promptTemplateEl = document.getElementById('prompt-template-input');

const providerSelectEl = document.getElementById('provider-select');
const apiUrlInputEl = document.getElementById('api-url-input');
const apiKeyInputEl = document.getElementById('api-key-input');
const modelInputEl = document.getElementById('model-input');
const providerHintEl = document.getElementById('provider-hint');

const userAvatarInputEl = document.getElementById('user-avatar-input');
const charAvatarInputEl = document.getElementById('char-avatar-input');
const tavernCardInputEl = document.getElementById('tavern-card-input');
const tavernCardStatusEl = document.getElementById('tavern-card-status');

const startChatButtonEl = document.getElementById('start-chat-button');
const mobileStartBtnEl = document.getElementById('mobile-start-btn');
const clearHistoryEl = document.getElementById('clear-history');
const exportBtnEl = document.getElementById('export-btn');
const resetPromptBtnEl = document.getElementById('reset-prompt-btn');

const chatboxEl = document.getElementById('chatbox');
const userInputEl = document.getElementById('user_input');
const sendBtnEl = document.getElementById('send_button');
const typingIndicatorEl = document.getElementById('typing-indicator');
const typingTextEl = document.getElementById('typing-text');
const charAvatarEl = document.getElementById('char-avatar');
const charNameDisplayEl = document.getElementById('character-name-display');
const charBioMiniEl = document.getElementById('character-bio-mini');
const persistSwitchEl = document.getElementById('persist-switch');

const toggleMemoryBtn = document.getElementById('toggle-memory');
const memoryPanel = document.getElementById('memory-panel');
const memFacts = document.getElementById('mem-facts');
const memRel = document.getElementById('mem-relationships');
const memWorld = document.getElementById('mem-world');
const memEvents = document.getElementById('mem-events');
const memEmotion = document.getElementById('mem-emotion');
const memoryClearBtn = document.getElementById('memory-clear');

/* --------------------------- */
function escapeHtml(s) {
  if (!s) return '';
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderMessageContent(text) {
  if (typeof marked !== 'undefined') {
    const rawHtml = marked.parse(text || '');
    if (typeof DOMPurify !== 'undefined') return DOMPurify.sanitize(rawHtml);
    return rawHtml;
  }
  return escapeHtml(text || '').replaceAll('\n', '<br>');
}

function mkId(prefix = 'm') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function capitalizeSentence(s) {
  if (!s) return s;
  const t = s.trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function buildStopSequences(userName, characterName) {
  const seq = [`${userName}:`, `\n${userName}:`, `${characterName}:`, `\n${characterName}:`, 'User:', '\nUser:', 'Player:', '\nPlayer:'];
  return [...new Set(seq)];
}

function sanitizeBotOutput(raw, userName, characterName) {
  if (!raw) return '(the character is silent)';
  let s = String(raw).trim();
  for (const seq of buildStopSequences(userName, characterName)) {
    const i = s.indexOf(seq);
    if (i !== -1) s = s.slice(0, i).trim();
  }
  const charNamePattern = new RegExp(`^${characterName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[:\\s,-]*`, 'i');
  s = s.replace(charNamePattern, '').trim().replace(/\n{3,}/g, '\n\n');
  if (s.length > 1400) s = `${s.slice(0, 1380)}…`;
  return s || '(the character is silent)';
}

/* ---------------------------
   Memory
   --------------------------- */
function saveLongTermMemory() {
  longTermMemory.metadata.lastUpdated = Date.now();
  localStorage.setItem(LTM_STORAGE_KEY, JSON.stringify(longTermMemory));
  updateMemoryPanel();
}

function loadLongTermMemory() {
  const raw = localStorage.getItem(LTM_STORAGE_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') longTermMemory = Object.assign(longTermMemory, parsed);
  } catch (e) {
    console.warn('Failed to load LTM', e);
  }
}

function pushFact(text) {
  if (!text?.trim()) return;
  const t = text.trim();
  if (longTermMemory.facts.some((f) => f.text.toLowerCase() === t.toLowerCase())) return;
  longTermMemory.facts.push({ id: mkId('fact'), text: t, sourceTs: Date.now() });
  saveLongTermMemory();
}

function pushWorld(text) {
  if (!text?.trim()) return;
  const t = text.trim();
  if (longTermMemory.world.some((w) => w.text.toLowerCase() === t.toLowerCase())) return;
  longTermMemory.world.push({ id: mkId('world'), text: t, sourceTs: Date.now() });
  saveLongTermMemory();
}

function pushEvent(text) {
  if (!text?.trim()) return;
  longTermMemory.events.push({ id: mkId('evt'), text: text.trim(), ts: Date.now() });
  longTermMemory.events = longTermMemory.events.slice(-250);
  saveLongTermMemory();
}

function updateRelationship(text, delta = 0.2) {
  if (!text?.trim()) return;
  if (!longTermMemory.relationships.length) {
    longTermMemory.relationships.push({ id: mkId('rel'), text: text.trim(), score: delta, sourceTs: Date.now() });
  } else {
    const rel = longTermMemory.relationships[0];
    rel.score = Math.max(-5, Math.min(5, (rel.score || 0) + delta));
    if (!rel.text.toLowerCase().includes(text.toLowerCase())) rel.text += ` | ${text.trim()}`;
    rel.sourceTs = Date.now();
  }
  saveLongTermMemory();
}

function adjustEmotion(delta = {}) {
  Object.keys(delta).forEach((k) => {
    if (k in longTermMemory.emotion) {
      longTermMemory.emotion[k] = Math.max(-5, Math.min(5, (longTermMemory.emotion[k] || 0) + Number(delta[k] || 0)));
    }
  });
  saveLongTermMemory();
}

function extractMemoriesFromUserMessage(userMsg) {
  if (!userMsg?.trim()) return;
  const text = userMsg.trim();
  [/i am ([^.,!?]{2,60})/i, /i'm ([^.,!?]{2,60})/i, /my name is ([^.,!?]{2,60})/i, /i (?:like|love) ([^.,!?]{2,60})/i].forEach((p) => {
    const m = text.match(p);
    if (m?.[0]) pushFact(capitalizeSentence(m[0]));
  });
  const world = text.match(/(in the [a-z0-9 ]{3,60}|at the [a-z0-9 ]{3,60}|on the [a-z0-9 ]{3,60})/i);
  if (world?.[0]) pushWorld(capitalizeSentence(world[0]));
  if (/(we met|we found|we discovered|remember that)/i.test(text)) pushEvent(capitalizeSentence(text));
  if (/i trust you/i.test(text)) updateRelationship('User expressed trust', 0.6);
  if (/i (?:hate|dislike|distrust) you/i.test(text)) updateRelationship('User expressed distrust', -0.6);
}

function detectMemoryFromBotOutput(text) {
  if (!text?.trim()) return;
  const lower = text.toLowerCase();
  if (/i promise|i swear|i will always|i will never/i.test(text)) pushEvent(`Promise: ${text}`);
  if (/i like you|i love you/.test(lower)) adjustEmotion({ affinity: 0.5, trust: 0.2 });
  if (/i distrust|i don't trust/.test(lower)) adjustEmotion({ trust: -0.7, tension: 0.6 });
}

function buildMemorySummary() {
  const facts = longTermMemory.facts.slice(-6).map((f) => f.text).join('; ') || '(none)';
  const world = longTermMemory.world.slice(-6).map((w) => w.text).join('; ') || '(none)';
  const events = longTermMemory.events.slice(-6).map((e) => e.text).join(' | ') || '(none)';
  const rel = longTermMemory.relationships.length ? `${longTermMemory.relationships[0].text} (score ${Number(longTermMemory.relationships[0].score).toFixed(1)})` : '(none)';
  return `Facts: ${facts}\nWorld: ${world}\nEvents: ${events}\nRelationship: ${rel}`;
}

function updateMemoryPanel() {
  if (!memFacts) return;
  memFacts.innerHTML = longTermMemory.facts.length ? longTermMemory.facts.slice(-20).map((f) => `• ${escapeHtml(f.text)}`).join('<br>') : '<i class="meta">No facts yet</i>';
  memRel.innerHTML = longTermMemory.relationships.length ? longTermMemory.relationships.map((r) => `• ${escapeHtml(r.text)} (${Number(r.score).toFixed(1)})`).join('<br>') : '<i class="meta">No relationships yet</i>';
  memWorld.innerHTML = longTermMemory.world.length ? longTermMemory.world.slice(-20).map((w) => `• ${escapeHtml(w.text)}`).join('<br>') : '<i class="meta">No lore yet</i>';
  memEvents.innerHTML = longTermMemory.events.length ? longTermMemory.events.slice(-20).map((e) => `• ${escapeHtml(e.text)}`).join('<br>') : '<i class="meta">No events yet</i>';
  memEmotion.innerHTML = `Trust ${longTermMemory.emotion.trust.toFixed(2)} | Affinity ${longTermMemory.emotion.affinity.toFixed(2)} | Tension ${longTermMemory.emotion.tension.toFixed(2)} | Curiosity ${longTermMemory.emotion.curiosity.toFixed(2)}`;
}

/* ---------------------------
   Prompt & model routing
   --------------------------- */
function renderTemplate(template, vars) {
  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) => vars[key] ?? '');
}

function buildCompiledSystemPrompt() {
  const persona = charSheetEl.value.trim();
  const scenario = worldRulesEl.value.trim();
  return renderTemplate(promptTemplateEl.value || DEFAULT_PROMPT_TEMPLATE, {
    char: currentCharacterName || 'Character',
    user: currentUserName || 'Player',
    persona,
    scenario,
    world_rules: worldRulesEl.value.trim(),
    player_notes: playerNotesEl.value.trim(),
    memory: buildMemorySummary(),
    history: conversationHistory.slice(-8).map((m) => `${m.role === 'user' ? currentUserName : currentCharacterName}: ${m.content}`).join('\n')
  });
}

function buildChatMessages() {
  const messages = [{ role: 'system', content: buildCompiledSystemPrompt() }];
  conversationHistory.slice(-12).forEach((m) => messages.push({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }));
  return messages;
}

async function requestKobold({ apiUrl, prompt, stop_sequences }) {
  const payload = {
    prompt,
    max_length: 240,
    temperature: 0.82,
    top_p: 0.92,
    rep_pen: 1.05,
    do_sample: true,
    stop_sequence: stop_sequences
  };

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`Kobold HTTP ${res.status}`);
  const json = await res.json();
  return json?.results?.[0]?.text || json?.text || '';
}

async function requestOpenAICompatible({ apiUrl, apiKey, model, provider, messages }) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`
  };
  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = window.location.origin || 'http://localhost';
    headers['X-Title'] = 'KrizVibe RP Chat';
  }

  const payload = {
    model,
    messages,
    temperature: 0.8,
    max_tokens: 500
  };

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${provider} HTTP ${res.status} ${text}`);
  }

  const json = await res.json();
  return json?.choices?.[0]?.message?.content || '';
}

async function generateRoleplayReply() {
  const provider = providerSelectEl.value;
  const apiUrl = apiUrlInputEl.value.trim();
  const apiKey = apiKeyInputEl.value.trim();
  const model = modelInputEl.value.trim();

  if (!apiUrl) throw new Error('API URL is required');

  if (provider === 'kobold') {
    const prompt = `${buildCompiledSystemPrompt()}\n\n${conversationHistory.slice(-10).map((m) => `${m.role === 'user' ? currentUserName : currentCharacterName}: ${m.content}`).join('\n')}\n${currentCharacterName}:`;
    return requestKobold({ apiUrl, prompt, stop_sequences: buildStopSequences(currentUserName, currentCharacterName) });
  }

  if (!apiKey) throw new Error('API key is required for this provider');
  if (!model) throw new Error('Model is required for this provider');

  return requestOpenAICompatible({ apiUrl, apiKey, model, provider, messages: buildChatMessages() });
}

/* ---------------------------
   UI behaviors
   --------------------------- */
function updateProviderUI(fromChange = false) {
  const config = PROVIDER_DEFAULTS[providerSelectEl.value] || PROVIDER_DEFAULTS.kobold;
  if (fromChange) {
    apiUrlInputEl.value = config.apiUrl;
    modelInputEl.value = config.model;
  }
  apiKeyInputEl.type = config.needsKey ? 'password' : 'text';
  apiKeyInputEl.placeholder = config.needsKey ? 'API Key (required)' : 'Not required for Kobold local/public';
  providerHintEl.textContent = providerSelectEl.value === 'kobold'
    ? 'Default Kobold endpoint works without key.'
    : 'OpenAI-compatible provider selected. Use API key + model.';
}

function updateCharacterUI() {
  currentUserName = userNameInputEl.value.trim() || 'Player';
  currentCharacterName = characterNameInputEl.value.trim() || 'Character';
  charNameDisplayEl.textContent = currentCharacterName;
  charBioMiniEl.textContent = (charSheetEl.value || '').slice(0, 120);

  const avatarUrl = charAvatarInputEl.value.trim();
  if (avatarUrl) {
    charAvatarEl.style.backgroundImage = `url('${escapeHtml(avatarUrl)}')`;
    charAvatarEl.style.backgroundSize = 'cover';
    charAvatarEl.textContent = '';
  } else {
    charAvatarEl.style.backgroundImage = '';
    charAvatarEl.textContent = currentCharacterName.charAt(0) || 'C';
  }
}

function appendMessageToUI(role, text) {
  const wrapper = document.createElement('div');
  wrapper.classList.add('msg-enter', 'msg-container', role === 'user' ? 'msg-user' : 'msg-bot');
  const timeLabel = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const contentHtml = renderMessageContent(text);

  if (role === 'user') {
    const avatarUrl = userAvatarInputEl.value.trim();
    wrapper.innerHTML = `
      <div class="flex justify-end items-start">
        <div class="max-w-[85%] bubble px-5 py-3 text-sm markdown-body">
          ${contentHtml}
          <div class="flex justify-end mt-1 text-[10px] opacity-70 pt-1">${timeLabel}</div>
        </div>
        ${avatarUrl ? `<div class="w-10 h-10 rounded-full bg-cover bg-center ml-3 avatar-ring" style="background-image: url('${escapeHtml(avatarUrl)}')"></div>` : ''}
      </div>`;
  } else {
    const avatarUrl = charAvatarInputEl.value.trim();
    const avatar = avatarUrl
      ? `<div class="w-10 h-10 rounded-full bg-cover bg-center shrink-0 avatar-ring" style="background-image:url('${escapeHtml(avatarUrl)}')"></div>`
      : `<div class="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold shrink-0 avatar-ring">${escapeHtml(currentCharacterName.charAt(0) || 'C')}</div>`;

    wrapper.innerHTML = `
      <div class="flex items-start gap-3">
        ${avatar}
        <div class="max-w-[85%] bubble px-5 py-3 text-sm markdown-body">
          ${contentHtml}
          <div class="mt-1 text-[10px] opacity-60 pt-1">${timeLabel}</div>
        </div>
      </div>`;
  }

  chatboxEl.appendChild(wrapper);
  chatboxEl.scrollTop = chatboxEl.scrollHeight;
  if (typeof hljs !== 'undefined') wrapper.querySelectorAll('pre code').forEach((b) => hljs.highlightElement(b));
}

function renderConversation() {
  chatboxEl.innerHTML = '';
  conversationHistory.forEach((m) => appendMessageToUI(m.role, m.content));
}

function showTypingIndicator(show, text = '') {
  if (show) {
    typingTextEl.textContent = text ? `${text} is thinking…` : 'Thinking…';
    typingIndicatorEl.classList.remove('hidden');
  } else {
    typingIndicatorEl.classList.add('hidden');
  }
}

function saveAppState() {
  if (!persistSwitchEl.checked) return;
  const payload = {
    userName: userNameInputEl.value,
    characterName: characterNameInputEl.value,
    characterSheet: charSheetEl.value,
    playerNotes: playerNotesEl.value,
    worldRules: worldRulesEl.value,
    promptTemplate: promptTemplateEl.value,
    provider: providerSelectEl.value,
    apiUrl: apiUrlInputEl.value,
    apiKey: apiKeyInputEl.value,
    model: modelInputEl.value,
    userAvatarUrl: userAvatarInputEl.value,
    charAvatarUrl: charAvatarInputEl.value,
    conversationHistory
  };
  localStorage.setItem(STATE_KEY, JSON.stringify(payload));
}

function loadAppState() {
  const raw = localStorage.getItem(STATE_KEY);
  if (!raw) {
    promptTemplateEl.value = DEFAULT_PROMPT_TEMPLATE;
    providerSelectEl.value = DEFAULT_PROVIDER;
    updateProviderUI(true);
    return;
  }

  try {
    const p = JSON.parse(raw);
    userNameInputEl.value = p.userName || '';
    characterNameInputEl.value = p.characterName || '';
    charSheetEl.value = p.characterSheet || charSheetEl.value;
    playerNotesEl.value = p.playerNotes || playerNotesEl.value;
    worldRulesEl.value = p.worldRules || worldRulesEl.value;
    promptTemplateEl.value = p.promptTemplate || DEFAULT_PROMPT_TEMPLATE;

    providerSelectEl.value = p.provider || DEFAULT_PROVIDER;
    apiUrlInputEl.value = p.apiUrl || PROVIDER_DEFAULTS[providerSelectEl.value].apiUrl;
    apiKeyInputEl.value = p.apiKey || '';
    modelInputEl.value = p.model || PROVIDER_DEFAULTS[providerSelectEl.value].model;

    userAvatarInputEl.value = p.userAvatarUrl || '';
    charAvatarInputEl.value = p.charAvatarUrl || '';
    conversationHistory = p.conversationHistory || [];

    updateProviderUI();
    updateCharacterUI();
    renderConversation();
  } catch {
    promptTemplateEl.value = DEFAULT_PROMPT_TEMPLATE;
    providerSelectEl.value = DEFAULT_PROVIDER;
    updateProviderUI(true);
  }
}

async function sendMessageFromInput() {
  const text = userInputEl.value.trim();
  if (!text || isWaitingForResponse) return;
  if (!currentCharacterName) return alert('Please click Start Session first.');

  conversationHistory.push({ role: 'user', content: text, ts: Date.now() });
  appendMessageToUI('user', text);
  userInputEl.value = '';
  userInputEl.style.height = 'auto';

  extractMemoriesFromUserMessage(text);
  saveAppState();

  isWaitingForResponse = true;
  showTypingIndicator(true, currentCharacterName);

  try {
    const raw = await generateRoleplayReply();
    const cleaned = sanitizeBotOutput(raw, currentUserName, currentCharacterName);
    conversationHistory.push({ role: 'bot', content: cleaned, ts: Date.now() });
    appendMessageToUI('bot', cleaned);
    detectMemoryFromBotOutput(cleaned);
    saveAppState();
  } catch (err) {
    const msg = `${currentCharacterName} is having trouble replying. (${err.message || 'provider request failed'})`;
    conversationHistory.push({ role: 'bot', content: msg, ts: Date.now() });
    appendMessageToUI('bot', msg);
  } finally {
    isWaitingForResponse = false;
    showTypingIndicator(false);
  }
}

/* ---------------------------
   Tavern Card Import (AI Tavern / AImaker compatible)
   --------------------------- */
async function parseJsonCardText(text) {
  const parsed = JSON.parse(text);
  const card = parsed?.data || parsed;
  return card;
}

function applyImportedCard(card) {
  const name = card.name || card.char_name || '';
  const desc = card.description || card.persona || '';
  const personality = card.personality || '';
  const scenario = card.scenario || '';
  const firstMes = card.first_mes || card.greeting || '';
  const mesExample = card.mes_example || '';
  const systemPrompt = card.system_prompt || '';

  if (name) characterNameInputEl.value = name;
  const mergedPersona = [desc, personality].filter(Boolean).join('\n\n');
  if (mergedPersona) charSheetEl.value = mergedPersona;
  if (scenario) worldRulesEl.value = scenario;

  if (systemPrompt) {
    promptTemplateEl.value = `${systemPrompt}\n\n${DEFAULT_PROMPT_TEMPLATE}`;
  }

  if (firstMes && !conversationHistory.length) {
    conversationHistory.push({ role: 'bot', content: firstMes, ts: Date.now() });
    if (mesExample) pushEvent(`Example style: ${mesExample.slice(0, 180)}`);
  }

  if (card.avatar) charAvatarInputEl.value = card.avatar;
  updateCharacterUI();
  renderConversation();
  saveAppState();
}

function extractCharaFromPngArrayBuffer(buffer) {
  const bytes = new Uint8Array(buffer);
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < signature.length; i += 1) if (bytes[i] !== signature[i]) throw new Error('Invalid PNG file');

  let offset = 8;
  while (offset < bytes.length) {
    const len = new DataView(buffer, offset, 4).getUint32(0);
    const type = String.fromCharCode(...bytes.slice(offset + 4, offset + 8));
    const chunkData = bytes.slice(offset + 8, offset + 8 + len);

    if (type === 'tEXt') {
      const text = new TextDecoder().decode(chunkData);
      const nul = text.indexOf('\0');
      if (nul > 0) {
        const keyword = text.slice(0, nul);
        const value = text.slice(nul + 1);
        if (keyword.toLowerCase() === 'chara') {
          const decoded = atob(value);
          return JSON.parse(decoded);
        }
      }
    }

    offset += 12 + len;
  }
  throw new Error('No Tavern card metadata found in PNG');
}

async function importTavernCard(file) {
  if (!file) return;
  tavernCardStatusEl.textContent = 'Importing...';

  try {
    let card;
    if (file.name.toLowerCase().endsWith('.png')) {
      const buffer = await file.arrayBuffer();
      card = extractCharaFromPngArrayBuffer(buffer);
    } else {
      const text = await file.text();
      card = await parseJsonCardText(text);
    }

    applyImportedCard(card);
    tavernCardStatusEl.textContent = `Imported: ${card.name || file.name}`;
  } catch (e) {
    tavernCardStatusEl.textContent = `Import failed: ${e.message}`;
  }
}

/* ---------------------------
   Event wiring
   --------------------------- */
const menuToggle = document.getElementById('menu-toggle');
const sidebar = document.querySelector('.sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');

function toggleSidebar() {
  sidebar?.classList.toggle('open');
  sidebarOverlay?.classList.toggle('hidden');
}

window.toggleSidebar = toggleSidebar;
menuToggle && (menuToggle.onclick = toggleSidebar);
sidebarOverlay && (sidebarOverlay.onclick = toggleSidebar);

if (userInputEl) {
  userInputEl.addEventListener('input', function onInput() {
    this.style.height = 'auto';
    this.style.height = `${this.scrollHeight}px`;
  });
}

sendBtnEl.addEventListener('click', sendMessageFromInput);
userInputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessageFromInput();
  }
});

startChatButtonEl.addEventListener('click', () => {
  updateCharacterUI();
  if (!conversationHistory.length) {
    const greeting = `Hello ${currentUserName}. I am ${currentCharacterName}. Shall we begin this roleplay?`;
    conversationHistory.push({ role: 'bot', content: greeting, ts: Date.now() });
    appendMessageToUI('bot', greeting);
  } else {
    renderConversation();
  }
  saveAppState();
});

mobileStartBtnEl?.addEventListener('click', () => startChatButtonEl.click());

clearHistoryEl.addEventListener('click', () => {
  if (!confirm('Clear conversation history?')) return;
  conversationHistory = [];
  renderConversation();
  saveAppState();
});

exportBtnEl.addEventListener('click', () => {
  const text = conversationHistory.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(currentCharacterName || 'character').replace(/\s+/g, '_')}_transcript.txt`;
  a.click();
  URL.revokeObjectURL(url);
});

providerSelectEl.addEventListener('change', () => {
  updateProviderUI(true);
  saveAppState();
});

[apiUrlInputEl, apiKeyInputEl, modelInputEl, userNameInputEl, characterNameInputEl, charSheetEl, playerNotesEl, worldRulesEl, promptTemplateEl, userAvatarInputEl, charAvatarInputEl, persistSwitchEl]
  .forEach((el) => el?.addEventListener('input', () => {
    if (el === characterNameInputEl || el === charSheetEl || el === charAvatarInputEl || el === userNameInputEl) updateCharacterUI();
    saveAppState();
  }));

resetPromptBtnEl?.addEventListener('click', () => {
  promptTemplateEl.value = DEFAULT_PROMPT_TEMPLATE;
  saveAppState();
});

tavernCardInputEl?.addEventListener('change', () => {
  const file = tavernCardInputEl.files?.[0];
  importTavernCard(file);
});

toggleMemoryBtn?.addEventListener('click', () => {
  memoryPanel.classList.toggle('hidden');
  updateMemoryPanel();
});

memoryClearBtn?.addEventListener('click', () => {
  if (!confirm('Clear all long-term memory?')) return;
  longTermMemory = {
    facts: [], relationships: [], world: [], events: [],
    emotion: { trust: 0, affinity: 0, tension: 0, curiosity: 0 },
    metadata: { createdAt: Date.now(), lastUpdated: Date.now() }
  };
  saveLongTermMemory();
});

loadLongTermMemory();
loadAppState();
updateCharacterUI();
updateMemoryPanel();
feather.replace();
