# KrizVibe Chat — Multi-Provider Roleplay Client

KrizVibe is a fully client-side roleplay chat app (HTML/CSS/JS) with:

- **Default KoboldAI/KoboldCpp support** (works out of the box).
- **OpenAI-compatible provider routing** for **OpenAI**, **Groq**, **OpenRouter**, and custom OpenAI-style endpoints.
- **Custom prompt template system** with placeholders for persona, memory, world rules, and user/character names.
- **AI Tavern card import** (`.json` and `.png` metadata cards) compatible with cards exported by AImaker-style tools.
- Built-in long-term memory, markdown rendering, sanitized output, and transcript export.

## Features

- Multi-provider config in the sidebar:
  - Provider selector
  - API URL
  - API key
  - Model
- Prompt template editor with reset button.
- Character card import system:
  - Load `.json` Tavern card files
  - Load `.png` cards with `tEXt/chara` metadata
- Persistent chat + settings via localStorage.
- Responsive UI for desktop and mobile.

## Quick Start

1. Clone and open:
   ```bash
   git clone https://github.com/altkriz/AIChat.git
   cd AIChat
   ```
2. Open `index.html` in your browser.
3. Set persona and start chatting.

## Provider Setup

### 1) KoboldAI/KoboldCpp (Default)
- Select **KoboldAI / KoboldCpp (default)**.
- Keep default API URL or set your local endpoint, e.g.:
  - `http://localhost:5001/api/v1/generate`
- API key/model are optional.

### 2) OpenAI
- Provider: **OpenAI**
- API URL: `https://api.openai.com/v1/chat/completions`
- Set API key + model (e.g. `gpt-4o-mini`).

### 3) Groq
- Provider: **Groq**
- API URL: `https://api.groq.com/openai/v1/chat/completions`
- Set Groq API key + model.

### 4) OpenRouter
- Provider: **OpenRouter**
- API URL: `https://openrouter.ai/api/v1/chat/completions`
- Set OpenRouter key + model slug.

### 5) Custom OpenAI-Compatible
- Provider: **Custom OpenAI-Compatible**
- Use your own OpenAI-like endpoint with API key + model.

## Prompt Template Placeholders

Use these in the custom prompt template:

- `{{char}}`
- `{{user}}`
- `{{persona}}`
- `{{scenario}}`
- `{{world_rules}}`
- `{{player_notes}}`
- `{{memory}}`
- `{{history}}`

## AI Tavern Card Import

Use **AI Tavern Card Import** in the sidebar and choose:
- `.json` card files
- `.png` card files containing embedded `chara` metadata

Imported fields (when present):
- Name
- Description/personality
- Scenario/world text
- First message
- System prompt
- Avatar URL (if provided as URL)

## Notes

- This project is frontend-only; API keys are entered in-browser and stored in localStorage if auto-save is enabled.
- For sensitive deployments, use a backend proxy and avoid exposing private endpoints/keys directly to users.
