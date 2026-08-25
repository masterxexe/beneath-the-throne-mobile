# Beneath the Throne

Mobile-first dark fantasy RPG (browser PWA). The playable game lives in **`btt-web-playtest/`**.

## Quick start

```bash
cd btt-web-playtest
npm install
npm run dev
```

Open **http://127.0.0.1:43123** in your browser.

Append **`?debug`** for developer cheats on `window.FE`.

## Repository layout

| Path | Purpose |
|------|---------|
| `btt-web-playtest/` | Full game — static ES-module PWA, no bundler |
| `btt-web-playtest/src/` | All game logic (combat, world, saves, UI) |
| `btt-web-playtest/assets/` | Art, audio hooks, item icons |
| `btt-web-playtest/scripts/` | Optional QA (Puppeteer) and art regeneration (Python) |

See **`btt-web-playtest/README.md`** for architecture, save format, systems map, and Codex handoff notes.

## Requirements

- **Node.js 18+** (for the static file server and optional QA scripts)
- **Python 3** (optional — only for regenerating art via `scripts/*.py`)
- **Chrome/Chromium** (optional — only for Puppeteer QA scripts)

There is **no production build step**. The game runs as static files over HTTP.
