# KrizVibe RP Studio (Multi-Provider + Tavern Gallery)

KrizVibe is a polished, frontend-only roleplay chat studio with strict character prompting, provider switching, Tavern card import, and a searchable character gallery.

![KrizVibe RP Studio screenshot](browser:/tmp/codex_browser_invocations/5176ec8ead293ae7/artifacts/artifacts/final-ui.png)

## Highlights

- **Default KoboldAI/KoboldCpp** support out of the box.
- **OpenAI-compatible routing** for OpenAI, Groq, OpenRouter, and custom endpoints.
- **Strict prompt template mode**: your system prompt template is used directly (no hidden extra prompt layers).
- **Persona-first character behavior**: character persona + story are injected as core identity.
- **Direct + indirect user speech support** explicitly enforced in the template.
- **Streaming responses** for supported OpenAI-compatible APIs.
- **Generation controls** (temperature, max tokens, top_p, repetition penalty).
- **Tavern card import** from local `.json` / `.png` (tEXt + iTXt parsing).
- **Character gallery integration** using:
  - `https://kriztech.in/krpstudio/api.php?action=get_gallery&page=1&search=`
- **One-click gallery import** into active character profile.
- **Security-focused API key handling**:
  - “Save API key locally” opt-in (off by default).
  - Clear secrets button.
- **Regenerate + Edit Last User** utilities.
- **Bundle export/import** (settings + chat + memory).
- **Memory namespaced per character** to avoid cross-character contamination.

## Quick Start

1. Clone repo:
   ```bash
   git clone https://github.com/altkriz/AIChat.git
   cd AIChat
   ```
2. Open `index.html` in your browser.
3. Pick provider, set persona/story, and click **Start Session**.

## Provider Setup

- **KoboldAI/KoboldCpp (default)**
  - URL example: `http://localhost:5001/api/v1/generate`
  - API key optional.

- **OpenAI / Groq / OpenRouter / Custom OpenAI-compatible**
  - Set API URL + API key + model.
  - Enable streaming for incremental output.

## Prompt Placeholders

Use inside the strict prompt template:

- `{{char}}`
- `{{user}}`
- `{{persona}}`
- `{{story}}`
- `{{world_rules}}`
- `{{player_notes}}`
- `{{memory}}`
- `{{history}}`

## Tavern Character Sources

### Local import
- Import `.json` or `.png` Tavern cards using **AI Tavern Card Import**.

### Gallery import
- Use **Character Gallery** search and import directly from the integrated gallery API.

## Security Note

This is a pure client-side app. API calls are made directly from browser.
For production or shared environments, use a secure backend proxy.
