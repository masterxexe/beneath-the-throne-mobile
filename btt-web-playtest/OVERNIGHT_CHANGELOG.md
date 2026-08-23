# Overnight Changelog — 2026-08-23

Autonomous improvement pass while user sleeps. Commits on `main`.

## Infrastructure & PWA
- Added `version.json` for update checks
- Synced service worker cache to v108 (styles, redesign.css, main.js)
- Aligned `BUILD_VERSION` across PWA and service worker
- Removed duplicate image error handler in `index.html`
- Added `src/audioEngine.js` — WebAudio stub for combat/travel/encounter hooks

## Combat
- Distinct **cultist-acolyte** enemy sprites (violet robes, masked face)
- Enemy visual class mapping for Warden, Hunter, Bailiff, Writ Captain
- i18n for combat turn text and Target button (EN/ES)
- Shorter encounter transition (4.3s → 2.4s)
- Distinct companion sprites for healer and mage
- Full **block/hurt/defeated** composite poses for all 8 gear loadouts

## Player Art
- v80 walk cycle frames (all directions, 4 phases)
- v80 gear composite idle frames per loadout
- Player idle fallback updated to `player-idle-v80.png`

## World & Locations
- **Cinderhook Slums** cinematic world scene (v71) with market/forge/tavern/inn hotspots
- **Lower Ward** cinematic world scene (v71)
- Distinct location art: `cinderhook-slums-v18.png`, `lower-ward-v18.png`
- World scene CSS polish in `redesign.css`

## UI/UX
- Mobile HUD pill row horizontal scroll
- Combat dock visual lock state
- Town Center button i18n
- Map travel "Locked" → `tx("locked")`

## Tooling
- `scripts/polish-game-art.py` — cultist, walk cycles, composites, location art, companions
- `scripts/test-combat-debug.mjs` — Puppeteer combat verification

## Still open (future passes)
- Slum prologue remaining strings i18n (contract board, action groups)
- Mine interior cinematic scene
- Gear paper-doll SVG → painted PNG layers
- Establish camp road feature
- Full painted walk composites per armor loadout

## Pass 2 additions
- Ambient NPCs in Cinderhook Slums and Lower Ward
- Slum prologue i18n for main panel strings (EN/ES)
- Debug boot shortcuts: `FE.debugBootSlumScene()`, `FE.debugBootLowerWard()`
- README overhaul with art pipeline docs
- Extended Puppeteer test for world scenes

## Regenerate art
```bash
python3 scripts/polish-game-art.py
```

## Test combat
```bash
node scripts/test-combat-debug.mjs
```

## Pass 4 — Mine, Camp, Contracts (v109)
