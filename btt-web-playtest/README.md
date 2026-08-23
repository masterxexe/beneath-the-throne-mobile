# Beneath the Throne — Web Playtest

Mobile-first dark fantasy RPG playtest (static PWA). No build step — vanilla ES modules served over HTTP.

## Local development

```bash
npm run dev
```

Open `http://127.0.0.1:43123` in your browser. Use mobile viewport or a phone on the same network for the intended experience (portrait).

### Debug mode

Append `?debug` to the URL for dev cheats exposed on `window.FE`.

## Project layout

```
btt-web-playtest/
├── index.html
├── styles.css
├── manifest.webmanifest
├── icons/
├── assets/          # sprites, backdrops, UI art
└── src/
    ├── main.js
    ├── state.js
    ├── combat.js
    ├── town.js
    ├── ui.js
    └── …
```

## Syncing from your machine

Copy your Desktop folder contents into this directory (or upload a zip in the Cursor chat). The cloud agent cannot read `c:\Users\NEREYDA\Desktop\btt-web-playtest` directly.

## Deploy

Static upload to any host (e.g. `hillbillyai.com/games/beneath-the-throne/game/`). Bump cache-bust query params on `styles.css` and `main.js` when shipping a new build.
