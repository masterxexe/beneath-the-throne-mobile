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

## Pass 8 — Combat sprite framing (v115)
- Knocked out studio-black plates behind player and enemy combat sprites so they no longer sit on a black icon
- Combat frames no longer clip heads, weapons, or feet (`overflow: visible`, `object-fit: contain`)
- Softened the battlefield ground blob so it reads as a shadow, not a black rectangle

## Pass 9 — Usable world map (v116)
- Map nodes inspect first, then travel; locked and distant places explain why they are closed
- Road chips list every connected town from where you stand
- Pan/zoom the painted map and center on the player; Cinderhook cluster labels no longer sit on top of each other
- Keep and Market Town now have return roads to the slums and Lower Ward

## Pass 10 — Map visual clarity (v117)
- You / Open road / Locked are color-coded on pins, with a key on the map
- Locked towns show a lock mark; far towns fade; gold roads are the ones you can take now
- Road-stop dots and roaming labels stay quiet until you are traveling
- The side panel uses one Here / Open / Locked / Far stamp instead of stacked status text

## Pass 11 — Court Ledger (v118)
- Real-money shop: Founder Writ, Ash Court Pass, ember cloak, keep frame, Patron of Ash tip
- Playtest checkout grants looks on the save; Stripe Payment Links can be pasted later
- Optional once-a-day Court Crier stand-in for rewarded ads
- Extra save beds 4–5 with the pass or founder writ; no combat power for sale

## Pass 12 — Ship-readiness (v119)
- Load Game on the title screen no longer crashes when no save exists
- Debug cheats stay off `window.FE` unless `?debug` is in the URL
- PWA icons are real 192 and 512 assets, with a separate maskable 512
- Privacy Policy and Terms of Use pages, linked from the title screen

## Pass 13 — Tutorial and audio (v120)
- Opening fight is a 3-step lesson: Attack, then Defend, then Potion, with only the current button unlocked
- Cinderhook briefing is a numbered list that matches the real button names
- Procedural fight SFX (swings, hits, block, potions, magic) and looping beds for title, combat, road, and the dragon scene
- Mute on the title screen, Settings music/SFX toggles, and a HUD speaker that remembers the choice

## Pass 14 — UI chrome (v121)
- Double gold frames, inner rims, and corner ticks on panels, cards, modals, and HUD
- Stronger button/meter/input metal edges and keyboard focus rings
- Combat target outline and dock/tab chrome match the Ash Court line

## Pass 15 — Tutorial actors (v122)
- Opening fight uses the paper-doll combat poses (slash, block, hurt) against the skeleton actor kit
- Lesson help is a modal, Skip asks first, Potion starts you wounded so healing is visible, Barrier is labeled Barrier
- Guidance sits above the field instead of covering the fighters
- World, interior, slum, and Lower Ward NPCs idle on full-body sprites; party roster shows companion actors
- Kael and the dragon breathe and flinch on each showcase beat

## Pass 16 — Opening flow (v123)
- A service-worker update no longer reloads the page during the title/tutorial, which was dumping players back to New Game after the skeleton
- First Victory auto-continues into Kael's stand after a short beat
