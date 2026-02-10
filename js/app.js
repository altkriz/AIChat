
// Init external libs
if (typeof AOS !== 'undefined') AOS.init();
feather.replace();

// Configure Marked with Highlight.js
if (typeof marked !== 'undefined') {
  marked.setOptions({
    highlight: function(code, lang) {
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
   LONG-TERM MEMORY (LTM)
   --------------------------- */
const LTM_STORAGE_KEY = "kriz_rp_ltmemory_v1";
let longTermMemory = {
  facts: [],          // {id, text, sourceTs}
  relationships: [],  // {id, text, score, sourceTs}
  world: [],          // {id, text, sourceTs}
  events: [],         // {id, text, ts}
  emotion: {          // float values - -1..1 (but we use -5..5 scale internally)
    trust: 0,
    affinity: 0,
    tension: 0,
    curiosity: 0
  },
  metadata: {
    createdAt: Date.now(),
    lastUpdated: Date.now()
  }
};

function saveLongTermMemory() {
  try {
    longTermMemory.metadata.lastUpdated = Date.now();
    localStorage.setItem(LTM_STORAGE_KEY, JSON.stringify(longTermMemory));
    updateMemoryPanel();
  } catch (e) {
    console.warn("Failed to save LTM:", e);
  }
}

function loadLongTermMemory() {
  const raw = localStorage.getItem(LTM_STORAGE_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    // shallow validation
    if (parsed && typeof parsed === "object") {
      longTermMemory = Object.assign(longTermMemory, parsed);
    }
  } catch (e) {
    console.warn("Failed to load LTM:", e);
  }
}
loadLongTermMemory();

/* ---------------------------
   MEMORY UTILS
   --------------------------- */
function mkId(prefix = "m") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
}

function pushFact(text) {
  if (!text || !text.trim()) return;
  const t = text.trim();
  // avoid duplicates (simple)
  if (longTermMemory.facts.some(f => f.text.toLowerCase() === t.toLowerCase())) return;
  longTermMemory.facts.push({ id: mkId("fact"), text: t, sourceTs: Date.now() });
  saveLongTermMemory();
}

function pushWorld(text) {
  if (!text || !text.trim()) return;
  const t = text.trim();
  if (longTermMemory.world.some(w => w.text.toLowerCase() === t.toLowerCase())) return;
  longTermMemory.world.push({ id: mkId("world"), text: t, sourceTs: Date.now() });
  saveLongTermMemory();
}

function pushEvent(text) {
  if (!text || !text.trim()) return;
  const t = text.trim();
  longTermMemory.events.push({ id: mkId("evt"), text: t, ts: Date.now() });
  // keep events bounded to last 200
  if (longTermMemory.events.length > 200) longTermMemory.events.shift();
  saveLongTermMemory();
}

function updateRelationship(text, deltaScore = 0.2) {
  // Pick "primary" relationship entry (index 0) or create one
  const t = text.trim();
  if (!t) return;
  if (!longTermMemory.relationships.length) {
    longTermMemory.relationships.push({ id: mkId("rel"), text: t, score: deltaScore, sourceTs: Date.now() });
  } else {
    // update score and optionally update text
    const rel = longTermMemory.relationships[0];
    rel.score = Math.max(-5, Math.min(5, (rel.score || 0) + deltaScore));
    // if new text seems to add new info, append as short note (avoid duplicate)
    if (!rel.text.toLowerCase().includes(t.toLowerCase()) && t.length < 200) {
      rel.text = rel.text + " | " + t;
    }
    rel.sourceTs = Date.now();
  }
  saveLongTermMemory();
}

function adjustEmotion(delta = {}) {
  // delta: {trust, affinity, tension, curiosity}
  Object.keys(delta).forEach(k => {
    if (k in longTermMemory.emotion) {
      longTermMemory.emotion[k] = Math.max(-5, Math.min(5, (longTermMemory.emotion[k] || 0) + Number(delta[k] || 0)));
    }
  });
  saveLongTermMemory();
}

/* ---------------------------
   MEMORY EXTRACTION (heuristic)
   --------------------------- */
function extractMemoriesFromUserMessage(userMsg) {
  if (!userMsg || !userMsg.trim()) return;

  const text = userMsg.trim();

  // lower for checks
  const lower = text.toLowerCase();

  // direct personal facts
  const personalFactPatterns = [
    /i am ([a-z0-9 ,.'"-]+)/i,
    /i'm ([a-z0-9 ,.'"-]+)/i,
    /my name is ([a-z0-9 ,.'"-]+)/i,
    /i (?:like|love) ([a-z0-9 ,.'"-]+)/i,
    /i (?:dislike|hate|don't like) ([a-z0-9 ,.'"-]+)/i,
    /i (?:work|study) as ([a-z0-9 ,.'"-]+)/i
  ];

  for (const p of personalFactPatterns) {
    const m = text.match(p);
    if (m && m[1]) {
      pushFact(capitalizeSentence(m[0]));
    }
  }

  // memories about places/world: "in the library", "at the gate", "on the moon"
  const worldPatterns = [
    /in the ([a-z0-9 ]{3,30})/i,
    /at the ([a-z0-9 ]{3,30})/i,
    /on the ([a-z0-9 ]{3,30})/i,
    /the ([A-Z][a-zA-Z0-9]{2,40})/g
  ];
  for (const p of worldPatterns) {
    const m = text.match(p);
    if (m) {
      // if multiple matches, push each
      (Array.isArray(m) ? m : [m]).forEach(match => {
        // some matches are arrays - handle
        const capture = Array.isArray(match) ? match[1] || match[0] : match;
        if (capture && capture.length >= 3 && capture.length <= 80) {
          pushWorld(capitalizeSentence(capture));
        }
      });
    }
  }

  // event-like statements: "we met", "we discovered", "we found", "yesterday we"
  const eventPatterns = [
    /(we (?:met|discovered|found|saw|escaped|arrived|left|defeated) [a-z0-9 ,.'"-]+)/i,
    /(yesterday|today|last night|this morning)[, ]+[a-z0-9 ,.'"-]+/i,
    /remember that (.+)/i
  ];
  for (const p of eventPatterns) {
    const m = text.match(p);
    if (m && m[0]) {
      pushEvent(capitalizeSentence(m[0]));
    }
  }

  // relationship cues: "I trust you", "I don't trust you", "I like you", "I hate you"
  const relPatterns = [
    /i (trust|like|love) (you|her|him|them)/i,
    /i (?:dont|don't|do not) (trust|like|love) (you|her|him|them)/i,
    /you (?:are|seem) (nice|kind|mean|cruel|rude)/i
  ];
  for (const p of relPatterns) {
    const m = text.match(p);
    if (m) {
      if (m[1]) {
        const word = m[1].toLowerCase();
        if (["trust","like","love"].includes(word)) updateRelationship(`User expressed: ${m[0]}`, +0.6);
        else updateRelationship(`User expressed: ${m[0]}`, -0.6);
      } else {
        updateRelationship(`User said: ${m[0]}`, 0.1);
      }
    }
  }

  // emotional hints - small adjustments
  if (lower.includes("thank") || lower.includes("thanks")) adjustEmotion({ trust: 0.2, affinity: 0.2 });
  if (lower.includes("sorry")) adjustEmotion({ trust: -0.1, affinity: -0.1, tension: -0.1 });
  if (lower.includes("kill") || lower.includes("hate") || lower.includes("die")) adjustEmotion({ tension: 0.5 });

  // finally, a fallback: if user message short and seems important, add as a fact
  if (text.length > 8 && text.split(" ").length <= 6 && /[A-Za-z]/.test(text)) {
    // sometimes a short line like "I like puzzles" is a fact
    pushFact(capitalizeSentence(text));
  }
}

/* ---------------------------
   MEMORY SUMMARIZATION & PRUNING
   --------------------------- */
function summarizeLongTermMemoryIfNeeded() {
  // Keep facts limited to 120 items, world to 120, relationships 10, events 300
  if (longTermMemory.facts.length > 120) {
    // naive prune: keep newest 100
    longTermMemory.facts = longTermMemory.facts.slice(-100);
  }
  if (longTermMemory.world.length > 120) {
    longTermMemory.world = longTermMemory.world.slice(-100);
  }
  if (longTermMemory.relationships.length > 10) {
    longTermMemory.relationships = longTermMemory.relationships.slice(-10);
  }
  if (longTermMemory.events.length > 300) {
    longTermMemory.events = longTermMemory.events.slice(-250);
  }
  saveLongTermMemory();
}

/* ---------------------------
   UI - Memory Panel
   --------------------------- */
const toggleMemoryBtn = document.getElementById("toggle-memory");
const memoryPanel = document.getElementById("memory-panel");
const memFacts = document.getElementById("mem-facts");
const memRel = document.getElementById("mem-relationships");
const memWorld = document.getElementById("mem-world");
const memEvents = document.getElementById("mem-events");
const memEmotion = document.getElementById("mem-emotion");
const memoryClearBtn = document.getElementById("memory-clear");

if (toggleMemoryBtn) {
  toggleMemoryBtn.addEventListener("click", () => {
    const showing = memoryPanel.classList.contains("panel-show");
    if (showing) {
      memoryPanel.classList.remove("panel-show");
      memoryPanel.classList.add("panel-hidden");
    } else {
      memoryPanel.classList.remove("panel-hidden");
      memoryPanel.classList.add("panel-show");
      updateMemoryPanel();
    }
  });
}

if (memoryClearBtn) {
  memoryClearBtn.addEventListener("click", () => {
    if (!confirm("Clear all long-term memory? This cannot be undone.")) return;
    longTermMemory = {
      facts: [], relationships: [], world: [], events: [], emotion: { trust:0, affinity:0, tension:0, curiosity:0 },
      metadata: { createdAt: Date.now(), lastUpdated: Date.now() }
    };
    saveLongTermMemory();
    updateMemoryPanel();
  });
}

function updateMemoryPanel() {
  if (!memFacts) return;
  memFacts.innerHTML = longTermMemory.facts.length ? longTermMemory.facts.slice(-30).map(f => `• ${escapeHtml(f.text)}`).join("<br>") : "<i class='meta'>No facts yet</i>";
  memRel.innerHTML = longTermMemory.relationships.length ? longTermMemory.relationships.map(r => `• ${escapeHtml(r.text)} (score: ${Number(r.score).toFixed(1)})`).join("<br>") : "<i class='meta'>No relationships yet</i>";
  memWorld.innerHTML = longTermMemory.world.length ? longTermMemory.world.slice(-30).map(w => `• ${escapeHtml(w.text)}`).join("<br>") : "<i class='meta'>No world lore yet</i>";
  memEvents.innerHTML = longTermMemory.events.length ? longTermMemory.events.slice(-30).map(e => `• ${escapeHtml(e.text)} (${new Date(e.ts).toLocaleDateString()})`).join("<br>") : "<i class='meta'>No events yet</i>";
  memEmotion.innerHTML = `Trust: ${Number(longTermMemory.emotion.trust).toFixed(2)}, Affinity: ${Number(longTermMemory.emotion.affinity).toFixed(2)}, Tension: ${Number(longTermMemory.emotion.tension).toFixed(2)}, Curiosity: ${Number(longTermMemory.emotion.curiosity).toFixed(2)}`;
}

/* ---------------------------
   PROMPT BUILDER
   --------------------------- */
const ABSOLUTE_SYSTEM_PROMPT = `
SYSTEM: You are a roleplay engine and MUST always stay in character.
- Never reveal you are an AI, program, or assistant.
- Always speak in first-person as the character.
- Never output any user lines (e.g., "Player:", "User:").
- Follow the Character Sheet, World Rules, and Player Notes. If conflicts arise, System and World Rules take precedence.
- Avoid explicit sexual content, hate, and instructions for real-world wrongdoing. Provide safe in-character refusals if needed.
END SYSTEM.
`;

function buildMemorySummary() {
  const topFacts = longTermMemory.facts.slice(-6).map(f => f.text);
  const topWorld = longTermMemory.world.slice(-6).map(w => w.text);
  const lastEvents = longTermMemory.events.slice(-6).map(e => `${new Date(e.ts).toLocaleDateString()}: ${e.text}`);
  const rel = longTermMemory.relationships.length ? `${longTermMemory.relationships[0].text} (score=${Number(longTermMemory.relationships[0].score).toFixed(1)})` : "(no relationship data)";
  const emo = `Emotion - trust:${Number(longTermMemory.emotion.trust).toFixed(2)}, affinity:${Number(longTermMemory.emotion.affinity).toFixed(2)}, tension:${Number(longTermMemory.emotion.tension).toFixed(2)}, curiosity:${Number(longTermMemory.emotion.curiosity).toFixed(2)}`;

  return [
    "--- MEMORY SUMMARY ---",
    topFacts.length ? `Facts: ${topFacts.join("; ")}` : "Facts: (none)",
    topWorld.length ? `World: ${topWorld.join("; ")}` : "World: (none)",
    lastEvents.length ? `Recent events: ${lastEvents.join(" | ")}` : "Recent events: (none)",
    `Relationship: ${rel}`,
    emo,
    "----------------------"
  ].join("\n");
}

function buildFullPrompt({characterSheet, worldRules, playerNotes, conversationWindow, userName, characterName}) {
  const safe = s => (s||"").toString().trim();

  const parts = [];
  parts.push(ABSOLUTE_SYSTEM_PROMPT.trim());
  parts.push("\n--- CHARACTER SHEET ---");
  parts.push(`Name: ${safe(characterName) || "Character"}`);
  parts.push(safe(characterSheet) || "(no sheet)");
  parts.push("\n--- WORLD RULES ---");
  parts.push(safe(worldRules) || "(no world rules)");
  parts.push("\n--- MEMORY ---");
  parts.push(buildMemorySummary());
  parts.push("\n--- PLAYER NOTES (flavor only) ---");
  parts.push(safe(playerNotes) || "(none)");
  parts.push("\n--- RECENT DIALOGUE ---");
  if (Array.isArray(conversationWindow) && conversationWindow.length) {
    conversationWindow.forEach(m => {
      if (m.role === "user") parts.push(`${userName}: ${m.content}`);
      else parts.push(`${characterName}: ${m.content}`);
    });
  } else {
    parts.push("(no recent dialogue)");
  }
  parts.push("\n--- RESPONSE INSTRUCTIONS ---");
  parts.push(`Respond as ${characterName} in first-person. Keep responses concise (roughly 1-6 sentences). Stay in-character. Do not output ${userName}: or any user lines. End with an action or emotional beat when appropriate.`);
  parts.push(`\n${characterName}:`);

  return parts.join("\n");
}

/* ---------------------------
   CORE CHAT & UI HANDLERS
   --------------------------- */
const userNameInputEl = document.getElementById("user-name-input");
const characterNameInputEl = document.getElementById("character-name-input");
const charSheetEl = document.getElementById("character-sheet-input");
const playerNotesEl = document.getElementById("player-notes-input");
const worldRulesEl = document.getElementById("world-rules-input");

// New Settings Inputs
const apiUrlInputEl = document.getElementById("api-url-input");
const userAvatarInputEl = document.getElementById("user-avatar-input");
const charAvatarInputEl = document.getElementById("char-avatar-input");

const startChatButtonEl = document.getElementById("start-chat-button");
const clearHistoryEl = document.getElementById("clear-history");
const exportBtnEl = document.getElementById("export-btn");

const chatboxEl = document.getElementById("chatbox");
const userInputEl = document.getElementById("user_input");
const sendBtnEl = document.getElementById("send_button");
const typingIndicatorEl = document.getElementById("typing-indicator");
const typingTextEl = document.getElementById("typing-text");
const charAvatarEl = document.getElementById("char-avatar");
const charNameDisplayEl = document.getElementById("character-name-display");
const charBioMiniEl = document.getElementById("character-bio-mini");
const persistSwitchEl = document.getElementById("persist-switch");

let conversationHistory = []; // {role:'user'|'bot', content, ts}
let currentUserName = "";
let currentCharacterName = "";
let isWaitingForResponse = false;

// Default API URL
const DEFAULT_KOBOLD_API_URL = "https://koboldai-koboldcpp-tiefighter.hf.space/api/v1/generate";

// load persisted conversation if available
const STATE_KEY = "krizrp_state_v1";

function saveAppState() {
  if (!persistSwitchEl.checked) return;
  const payload = {
    userName: userNameInputEl.value,
    characterName: characterNameInputEl.value,
    characterSheet: charSheetEl.value,
    playerNotes: playerNotesEl.value,
    worldRules: worldRulesEl.value,

    // New fields
    apiUrl: apiUrlInputEl ? apiUrlInputEl.value : "",
    userAvatarUrl: userAvatarInputEl ? userAvatarInputEl.value : "",
    charAvatarUrl: charAvatarInputEl ? charAvatarInputEl.value : "",

    conversationHistory,
    createdAt: Date.now()
  };
  localStorage.setItem(STATE_KEY, JSON.stringify(payload));
}

function loadAppState() {
  const raw = localStorage.getItem(STATE_KEY);
  if (!raw) return;
  try {
    const p = JSON.parse(raw);
    userNameInputEl.value = p.userName || "";
    characterNameInputEl.value = p.characterName || "";
    charSheetEl.value = p.characterSheet || charSheetEl.value;
    playerNotesEl.value = p.playerNotes || playerNotesEl.value;
    worldRulesEl.value = p.worldRules || worldRulesEl.value;

    // Load new fields
    if (apiUrlInputEl) apiUrlInputEl.value = p.apiUrl || DEFAULT_KOBOLD_API_URL;
    if (userAvatarInputEl) userAvatarInputEl.value = p.userAvatarUrl || "";
    if (charAvatarInputEl) charAvatarInputEl.value = p.charAvatarUrl || "";

    conversationHistory = p.conversationHistory || [];
    currentUserName = p.userName || "";
    currentCharacterName = p.characterName || "";
    updateCharacterUI();
    renderConversation();
  } catch (e) {
    console.warn("Failed to load app state", e);
  }
}

// Auto-resize textarea
if (userInputEl) {
  userInputEl.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.style.scrollHeight) + 'px';
  });
}

// Mobile sidebar toggle
const menuToggle = document.getElementById("menu-toggle");
const sidebar = document.querySelector(".sidebar");
const sidebarOverlay = document.getElementById("sidebar-overlay");

function toggleSidebar() {
  if (sidebar && sidebarOverlay) {
    sidebar.classList.toggle("open");
    sidebarOverlay.classList.toggle("hidden"); // Use hidden class for overlay
  }
}

// Event listeners handled in HTML (onclick) or here, but not both.
// Cleaned up to avoid double-firing if HTML has onclick attributes.
if (menuToggle) {
  menuToggle.onclick = toggleSidebar;
}
if (sidebarOverlay) {
  sidebarOverlay.onclick = toggleSidebar;
}


loadAppState();
updateMemoryPanel();

/* helper: simple HTML escape for displayed messages */
function escapeHtml(s) {
  if (!s) return "";
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'", "&#39;")
    .replaceAll("\n","<br>");
}

function renderMessageContent(text) {
  if (typeof marked !== 'undefined') {
    const rawHtml = marked.parse(text);
    // Sanitize with DOMPurify if available
    if (typeof DOMPurify !== 'undefined') {
      return DOMPurify.sanitize(rawHtml);
    }
    return rawHtml;
  }
  return escapeHtml(text);
}

function appendMessageToUI(role, text) {
  const wrapper = document.createElement("div");
  wrapper.classList.add("msg-enter", "msg-container"); // Added msg-container
  const timeLabel = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});

  const contentHtml = renderMessageContent(text);

  if (role === "user") {
    wrapper.classList.add("msg-user");
    const avatarUrl = userAvatarInputEl && userAvatarInputEl.value.trim();
    const avatarHtml = avatarUrl
      ? `<div class="w-10 h-10 rounded-full bg-cover bg-center ml-3 avatar-ring flex-shrink-0" style="background-image: url('${escapeHtml(avatarUrl)}')"></div>`
      : ""; // No fallback for user in this design

    wrapper.innerHTML = `
      <div class="flex justify-end items-start">
        <div class="max-w-[85%] bubble px-5 py-3 text-sm markdown-body">
          ${contentHtml}
          <div class="flex justify-end mt-1 text-[10px] opacity-70 pt-1">${timeLabel}</div>
        </div>
        ${avatarHtml}
      </div>
    `;
  } else {
    wrapper.classList.add("msg-bot");
    // Bot
    const avatarUrl = charAvatarInputEl && charAvatarInputEl.value.trim();
    // Use avatar url or default fallback
    let avatarEl = "";
    if (avatarUrl) {
      avatarEl = `<div class="w-10 h-10 rounded-full bg-cover bg-center shrink-0 avatar-ring" style="background-image: url('${escapeHtml(avatarUrl)}')"></div>`;
    } else {
      avatarEl = `<div class="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold shrink-0 avatar-ring">
          ${escapeHtml(currentCharacterName.charAt(0) || "C")}
        </div>`;
    }

    wrapper.innerHTML = `
      <div class="flex items-start gap-3">
        ${avatarEl}
        <div class="max-w-[85%] bubble px-5 py-3 text-sm markdown-body">
          ${contentHtml}
          <div class="mt-1 text-[10px] opacity-60 pt-1">${timeLabel}</div>
        </div>
      </div>
    `;
  }
  chatboxEl.appendChild(wrapper);
  chatboxEl.scrollTop = chatboxEl.scrollHeight;

  // Highlight new code blocks
  if (typeof hljs !== 'undefined') {
    wrapper.querySelectorAll('pre code').forEach((block) => {
      hljs.highlightElement(block);
    });
  }
}

/* render full conversation */
function renderConversation() {
  chatboxEl.innerHTML = "";
  (conversationHistory || []).forEach(m => appendMessageToUI(m.role, m.content));
}

/* update name and mini-bio */
function updateCharacterUI() {
  currentUserName = userNameInputEl.value.trim() || "Player";
  currentCharacterName = characterNameInputEl.value.trim() || "Character";
  charNameDisplayEl.textContent = currentCharacterName;

  // Update main avatar if set
  if (charAvatarInputEl && charAvatarInputEl.value.trim()) {
    charAvatarEl.style.backgroundImage = `url('${escapeHtml(charAvatarInputEl.value.trim())}')`;
    charAvatarEl.style.backgroundSize = 'cover';
    charAvatarEl.textContent = '';
  } else {
    charAvatarEl.style.backgroundImage = '';
    charAvatarEl.textContent = currentCharacterName.charAt(0) || "C";
  }

  charBioMiniEl.textContent = (charSheetEl.value || "").slice(0,120);
}

/* clear history */
clearHistoryEl.addEventListener("click", () => {
  if (!confirm("Clear conversation history?")) return;
  conversationHistory = [];
  renderConversation();
  saveAppState();
});

/* start/resume chat */
startChatButtonEl.addEventListener("click", () => {
  updateCharacterUI();
  // If no conversation, seed with greeting
  if (!conversationHistory.length) {
    const greeting = `Hello ${currentUserName}. I am ${currentCharacterName}. Shall we continue the story?`;
    conversationHistory.push({ role: "bot", content: greeting, ts: Date.now() });
    appendMessageToUI("bot", greeting);
    saveAppState();
  } else {
    renderConversation();
  }
});

/* export transcript */
exportBtnEl.addEventListener("click", () => {
  const text = conversationHistory.map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n");
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(currentCharacterName || "character")}_transcript.txt`;
  a.click();
  URL.revokeObjectURL(url);
});

/* send message handlers */
sendBtnEl.addEventListener("click", () => sendMessageFromInput());
userInputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessageFromInput();
  }
});

async function sendMessageFromInput() {
  const text = userInputEl.value.trim();
  if (!text) return;
  if (isWaitingForResponse) return;
  if (!currentCharacterName) {
    alert("Please start the chat and set a character name.");
    return;
  }

  // UI + history
  conversationHistory.push({ role: "user", content: text, ts: Date.now() });
  appendMessageToUI("user", text);
  userInputEl.value = "";
  // Reset height
  userInputEl.style.height = 'auto';

  saveAppState();

  // Extract memories heuristically
  try {
    extractMemoriesFromUserMessage(text);
    summarizeLongTermMemoryIfNeeded();
  } catch (e) {
    console.warn("Memory extraction failed", e);
  }

  // Build prompt and call model
  isWaitingForResponse = true;
  showTypingIndicator(true, currentCharacterName);

  try {
    // provide last 8 messages as window
    const windowMsgs = conversationHistory.slice(-8);
    const prompt = buildFullPrompt({
      characterSheet: charSheetEl.value,
      worldRules: worldRulesEl.value,
      playerNotes: playerNotesEl.value,
      conversationWindow: windowMsgs,
      userName: currentUserName,
      characterName: currentCharacterName
    });

    // Build stop sequences
    const stopSeq = buildStopSequences(currentUserName, currentCharacterName);

    // Get configured API URL
    const customApiUrl = apiUrlInputEl && apiUrlInputEl.value.trim()
      ? apiUrlInputEl.value.trim()
      : DEFAULT_KOBOLD_API_URL;

    // Call model (Kobold-like)
    const raw = await getKoboldResponse({
      apiUrl: customApiUrl,
      prompt,
      max_length: 220,
      temperature: 0.78,
      stop_sequences: stopSeq
    });

    const cleaned = sanitizeBotOutput(raw, currentUserName, currentCharacterName);
    // push and display
    conversationHistory.push({ role: "bot", content: cleaned, ts: Date.now() });
    appendMessageToUI("bot", cleaned);

    // optional: detect memory-worthy lines in bot output (character promises, discoveries)
    detectMemoryFromBotOutput(cleaned);

    saveAppState();
    summarizeLongTermMemoryIfNeeded();
  } catch (err) {
    console.error("Generation error", err);
    const fallback = `${currentCharacterName} is having trouble responding right now. (Check API URL or connection)`;
    conversationHistory.push({ role: "bot", content: fallback, ts: Date.now() });
    appendMessageToUI("bot", fallback);
  } finally {
    isWaitingForResponse = false;
    showTypingIndicator(false);
  }
}

/* small helper: show/hide typing indicator */
function showTypingIndicator(show, text = "") {
  if (show) {
    typingTextEl.textContent = text ? `${text} is thinking…` : "Thinking…";
    typingIndicatorEl.classList.remove("hidden");
  } else {
    typingIndicatorEl.classList.add("hidden");
  }
}

/* ---------------------------
   STOP SEQUENCE BUILDER
   --------------------------- */
function buildStopSequences(userName, characterName) {
  const seq = [
    `${userName}:`,
    `\n${userName}:`,
    `${characterName}:`,
    `\n${characterName}:`,
    "User:",
    "\nUser:",
    "Player:",
    "\nPlayer:",
    "Bot:",
    "\nBot:"
  ];
  return [...new Set(seq)];
}

/* ---------------------------
   MODEL CALL (Kobold-like endpoint)
   --------------------------- */

async function getKoboldResponse({ apiUrl, prompt, max_length = 150, temperature = 0.8, stop_sequences = [] }) {
  const payload = {
    prompt,
    max_length,
    temperature,
    top_p: 0.9,
    rep_pen: 1.05,
    do_sample: true,
    stop_sequence: stop_sequences
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000); // 25s timeout

  try {
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} ${res.statusText} ${txt}`);
    }
    const json = await res.json();

    // Handle multiple possible shapes
    if (json && json.results && Array.isArray(json.results) && json.results[0] && json.results[0].text) {
      return json.results[0].text;
    }
    if (json && typeof json.text === "string") return json.text;
    // fallback
    return JSON.stringify(json);
  } catch (err) {
    clearTimeout(timeout);
    console.error("API error:", err);
    throw err;
  }
}

/* ---------------------------
   SANITIZE BOT OUTPUT
   --------------------------- */
function sanitizeBotOutput(raw, userName, characterName) {
  if (!raw) return "(the character is silent)";
  let s = String(raw).trim();

  // truncate at first explicit stop sequence
  const stops = buildStopSequences(userName, characterName);
  for (const seq of stops) {
    const idx = s.indexOf(seq);
    if (idx !== -1) s = s.substring(0, idx).trim();
  }

  // remove if model repeated the character name at start
  const charNamePattern = new RegExp("^" + escapeRegExp(characterName) + "[:\\s,-]*", "i");
  s = s.replace(charNamePattern, "").trim();

  // remove excessive newlines
  s = s.replace(/\n{3,}/g, "\n\n");

  // safety: limit length
  if (s.length > 1200) s = s.slice(0, 1180) + "…";

  // final guard
  if (!s) s = "(the character is silent)";

  return s;
}

/* ---------------------------
   DETECT MEMORY FROM BOT OUTPUT
   --------------------------- */
function detectMemoryFromBotOutput(text) {
  if (!text || !text.trim()) return;
  const lower = text.toLowerCase();

  // if bot makes promises or statements about relationships
  if (/i will (never|always|promise|swear)/i.test(text) || /i promise to/i.test(text)) {
    pushEvent(`Promise: ${text}`);
    updateRelationship(`Character promised: ${text}`, +0.8);
  }

  // if bot reveals location/world facts
  const worldMatch = text.match(/(the [A-Z][a-zA-Z0-9 ]{2,40}|in the [a-z ]{3,60}|at the [a-z ]{3,60})/i);
  if (worldMatch) {
    pushWorld(capitalizeSentence(worldMatch[0]));
  }

  // if bot mentions discovery/event
  if (/(we discovered|we found|we escaped|we defeated|we arrived)/i.test(text)) {
    pushEvent(capitalizeSentence(text));
  }

  // minor emotion nudges when bot expresses feelings
  if (lower.includes("i like you") || lower.includes("i love you")) adjustEmotion({ affinity: 0.6, trust: 0.3 });
  if (lower.includes("i distrust") || lower.includes("i don't trust")) adjustEmotion({ trust: -0.8, tension: 0.6 });

  saveLongTermMemory();
}

/* ---------------------------
   UTILITIES
   --------------------------- */
function capitalizeSentence(s) {
  if (!s) return s;
  const t = s.trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
