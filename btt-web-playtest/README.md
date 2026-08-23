# Beneath the Throne — Web Playtest

Mobile-first dark fantasy RPG playtest (static PWA). No build step — vanilla ES modules served over HTTP.

## Local development

```bash
npm run dev
```

Open `http://127.0.0.1:43123` in your browser.

### Debug mode

Append `?debug` to the URL for dev cheats exposed on `window.FE`.

## Project layout

```
btt-web-playtest/
├── index.html
├── styles.css
├── manifest.webmanifest
├── icons/
├── assets/
└── src/
```

## Note on assets

The uploaded zip contains source code only. Copy `assets/` and `icons/` from your full local build (or the deployed site) for art/sprites to load in dev.
