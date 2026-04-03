# Macro Doc Refinement.

AI-powered text refinement that adapts to your voice. Write once, get versions optimized for LinkedIn, X, Instagram, and Substack.

**[Try it now](https://mdr-nextjs.vercel.app)** — no sign-up, no API key required.

## What it does

Paste or type your text. Macro Doc Refinement rewrites it in real time using AI, matching the personality and platform you choose.

- **Personality Modes** — MDR Style (Severance-inspired), Professional, Academic, Casual, Warner, Gen Z
- **Platform Tabs** — Refined, LinkedIn, X/Twitter, Instagram, Substack. Each with platform-specific formatting, tone, and character limits.
- **Real-time Streaming** — see the refined text appear token by token as the AI writes
- **Style Playground** — create and test your own custom refinement styles with system prompts and few-shot examples
- **BYOM (Bring Your Own Model)** — use OpenAI, Anthropic, Google, or Grok with your own API key. Keys stay in your browser, never touch our servers.
- **MDR Easter Egg** — triple-click the title for a Severance-inspired theme

## Use it

### Web App

**https://mdr-nextjs.vercel.app**

Works in any browser. Free tier uses Gemini Flash Lite (30 requests/minute). Add your own API key in Settings for unlimited usage with your preferred model.

### Chrome Extension

The extension brings text refinement to every text field on the web — Gmail, Slack, LinkedIn, Twitter, anywhere.

**Install from source:**

```bash
cd mdr-extension
npm install
npm run build
```

Then in Chrome:
1. Go to `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `mdr-extension/dist` folder

**Features:**
- **Inline Widget** — select text on any page, click "Refine" to replace it
- **Side Panel** — full MDR experience in Chrome's side panel
- **Context Menu** — right-click selected text to refine
- **BYOM** — configure your own API key in the extension options

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Tech Stack

- **Frontend:** Next.js 15, React 19, Tailwind CSS, Geist Sans
- **State:** Zustand with localStorage persistence
- **API:** Gemini via Cloud Run proxy (free tier) + direct BYOM to OpenAI/Anthropic/Google/Grok
- **Design:** Ethereal Glass aesthetic — dark OLED background, amber accents, double-bezel glass cards
- **Extension:** Chrome MV3, Vite, React, Shadow DOM for inline widget

## Project Structure

```
.
├── app/                    # Next.js pages (/, /playground, /settings, /legal)
├── components/             # React components
├── lib/
│   ├── api.ts              # Proxy streaming API
│   ├── byom-api.ts         # Direct provider streaming (OpenAI, Anthropic, Google, Grok)
│   ├── prompt-builder.ts   # Composable prompt construction
│   ├── constants.ts        # Default profiles, models, platform metadata
│   └── stores/             # Zustand stores (text-refine, style-profiles, tone, model-config)
└── mdr-extension/          # Chrome Extension source
    ├── src/content/        # Content script + inline widget
    ├── src/sidepanel/      # Side panel React app
    ├── src/background/     # Service worker
    └── src/shared/         # Shared code from web app
```

## Security

- API keys are stored in your browser's localStorage only — never sent to our servers
- BYOM calls go directly from your browser to the AI provider
- CORS whitelist on the proxy server (not wildcard)
- Model allowlist prevents cost amplification
- No authentication, no user accounts, no tracking, no PII collected

## License

MIT
