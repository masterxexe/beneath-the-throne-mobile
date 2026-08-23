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
- **Mine interior scene** with painted `mine-cut-v20.png` art, foreman NPC, ore vein hotspot
- **Establish Camp** on buildable road stops (costs gold/ore, advances 1 day)
- **Fortify Camp** upgrade (basic → fortified art, costs gold/ore/food, 2 days)
- Full **slum contract board i18n** (EN/ES) for all Chapter 1 contracts
- Debug shortcut: `FE.debugBootRoadStop('broken_road')` for camp testing
- Asset audit: 99 refs, 0 missing

## Pass 5 — Visual polish (v110)
- **HUD vital micro-bars** for HP/Mana with critical pulse; core vs extra pill tiers
- **Screen crossfade** transitions between dock tabs
- **Cinematic combat header** strip (round pill + turn order)
- **Interior entry staging** with painted backdrop before scene reveal
- **Map mood overlays** tied to current location (ember, ash, storm, fog, gold)
- **Hotspot breathe** animation on world/interior hotspots
- Class-based **UI theme tint** (imperial, holy, corrupted, nature, royal)

## Pass 6 — Combat choreography (v113)
- Player attacks cycle unique swings per weapon (sword, axe, spear, mace, dagger, bow, staff, shield, unarmed)
- Enemy strikes cycle per visual class (skeleton, wolf, bandit, cultist, corrupted knight)
- Mortal Kombat-style timing: anticipation, lunge, slash arcs, afterimages, camera shake, move-name banners
- Debug Attack Studio (`?debug`) to preview every swing and swap weapons
- New stylesheet `combat-animations.css` loaded after `styles.css` / `redesign.css` so motion wins over the old 8px nudge
