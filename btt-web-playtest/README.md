# Beneath the Throne — Web Playtest

Mobile-first dark fantasy RPG playtest (static PWA). **No bundler or compile step** — vanilla ES modules served over HTTP.

**Cache version:** v130 (`2026.08.25-webmcp-55`)

---

## Install and run

From this directory (`btt-web-playtest/`):

```bash
npm install
npm run dev
```

Open **http://127.0.0.1:43123** in your browser.

| Command | What it does |
|---------|----------------|
| `npm run dev` | Serves the game on port **43123** via [`serve`](https://www.npmjs.com/package/serve) |
| `npm start` | Alias for `npm run dev` |

### Requirements

- **Node.js 18+**
- A modern browser with ES module and Service Worker support
- **Python 3** — optional; only for art regeneration scripts
- **Chrome/Chromium** — optional; only for Puppeteer QA in `scripts/`

### Debug mode

Append `?debug` to the URL. Exposes dev helpers on `window.FE` (combat layout tests, scene jumps, level-up cheats, Attack Studio).

**Title screen (`?debug`):** combat layout tests, jump to Cinderhook/Lower Ward, cultist visual test.

**Home debug panel (`?debug`):** Level Up Now, Debug Level 5/10/15/20.

**Browser console examples:**

```js
FE.debugStartEnemyVisualTest('skeleton')
FE.debugBootSlumScene()
FE.debugBootLowerWard()
FE.debugEquipWeaponCategory('axe')
```

---

## Tech stack

| Layer | Choice |
|-------|--------|
| UI | Vanilla HTML/CSS, no React/Vue |
| Modules | Native ES modules (`import`/`export`) |
| Build | **None** — edit files, refresh browser |
| PWA | `service-worker.js` + `manifest.webmanifest` |
| Audio | Web Audio procedural engine (`src/audioEngine.js`) |
| i18n | EN + ES via `src/language.js` |
| Persistence | `localStorage` (see Save system below) |
| Backend | **None** — fully client-side |

Entry point: `index.html` → `src/main.js`, which assembles `window.FE` from domain modules.

---

## Project structure

```
btt-web-playtest/
├── index.html              # Shell, boot fallback, screen containers
├── styles.css              # Core layout and UI
├── redesign.css            # Cinematic world-home / HUD redesign
├── combat-animations.css   # MK-style attack choreography
├── service-worker.js       # Offline cache (bump version with releases)
├── manifest.webmanifest    # PWA manifest
├── version.json            # Cache/build metadata
├── package.json            # Dev server + optional QA deps
├── icons/                  # PWA icons
├── assets/                 # All art (actors, towns, battlebacks, items, UI)
├── scripts/                # Puppeteer QA + Python art pipeline
└── src/                    # Game logic (43 modules)
    ├── main.js             # Boot, window.FE assembly, debug gating
    ├── state.js            # Save schema, hero/world/kingdoms, loot, XP
    ├── ui.js               # Screens, modals, HUD, navigation dock
    ├── combat.js           # Turn-based battle engine
    ├── abilities.js        # Skill definitions and effect kinds
    ├── world.js            # Map, travel, locations, chapter rails
    ├── slumPrologue.js     # Cinderhook Chapter 1 contracts + gate
    ├── lowerWard.js        # Lower Ward quests, commissions, trainers
    ├── progression.js      # Growth screen, class paths, mastery
    ├── gear.js             # Inventory, equip, sell
    ├── party.js            # Companions
    ├── town.js             # Market, inn, tavern, blacksmith services
    ├── npcRegistry.js      # NPC names, portraits, ambient lines
    ├── roadNodes.js        # Road stops, travel graph nodes
    ├── travelGraph.js      # Route finding between stops
    ├── encounterTables.js  # Random road/travel encounters
    ├── levelUp.js          # Level-up ceremony overlay
    ├── language.js         # EN/ES strings
    ├── supporterStore.js   # Court Ledger (cosmetics/convenience)
    ├── pwa.js              # Service worker registration, update checks
    └── …                   # Art/rendering helpers (portraits, scenes, audio)
```

---

## Save and game state

### Storage keys (`localStorage`)

| Key | Purpose |
|-----|---------|
| `fallenEmpireSave_1` … `_5` | JSON save slots |
| `fallenEmpireActiveSlot` | Active slot id (`"1"` default) |
| `btt_language` | `"en"` or `"es"` |
| `btt_audio_prefs` | Mute / music / SFX toggles |
| `btt_checkout_urls` | Optional Stripe Payment Link JSON (real-money path) |

### Core API (`src/state.js`)

- `createNewState(name, classId)` — fresh hero + world
- `save(slot)` / `load(slot)` — persist to localStorage
- `normalize()` — migrates old saves on load
- `state` — live in-memory singleton (set via `setState`)

### Hero shape (abbreviated)

```js
hero: {
  name, level, xp, nextXp, points, class, advancedClass,
  stats, hp, maxHp, mana, maxMana, attack, defense, …
  gold, food, ore, potions, manaPotions,
  inv: [],                    // backpack items
  gear: { weapon, chest, … }, // equipped slots
  companions: [],
  known: [], abilityLoadout: [],
  mastery: { cmAllocation, weapon, spells, … },
  commander: { level, rank, kingdom }
}
```

New games use `nextXp: 80` (first level-up tuned for Chapter 1). Older saves keep their stored `nextXp`.

### World shape (abbreviated)

```js
world: {
  region, locationId, day, month, season, threat,
  locationStates, roadStopStates, hardAreas,
  lowerWard: { entered, influence, writs, commissions, … },
  story: []
}
prologue: { … }   // Cinderhook slum contracts, gate, safety/danger
kingdoms: { … }   // Faction scaffold (thin post-Chapter-1)
```

---

## Inventory and gear

**Module:** `src/gear.js`, item generation in `src/state.js` (`makeLoot`).

- **Backpack:** `hero.inv[]` — loot from combat and rewards
- **Equipped:** `hero.gear` slots — weapon, offhand, helmet, shoulders, chest, gloves, belt, legs, boots, cloak, ring
- **Actions:** equip, unequip, equipBest, sell item/worse/all
- **Visuals:** `gearVisuals.js` + `portraitRenderer.js` composite player poses per loadout
- **Weapon types:** sword, axe, spear, mace, dagger, bow, staff, shield, unarmed — affect combat animations

Consumables on hero (not in inv): `potions`, `manaPotions`, `food`, `ore`.

---

## Combat and progression

- **Combat:** `src/combat.js` — turn queue, enemy kits, victory/defeat flows
- **Skills:** `src/abilities.js` — regex-classified effect kinds (heal, ward, burn, cleave, snare, …)
- **Classes:** 5 base (`warrior`, `rogue`, `mage`, `ranger`, `cleric`) + 10 advanced paths at level 2 (`ADVANCED_CLASSES` in `state.js`)
- **Growth:** `src/progression.js` — stat points, class fork, mastery trees, CM allocation
- **Level-up ceremony:** `src/levelUp.js` — overlay after `levelHero()` / combat victory
- **Milestone abilities:** levels 5, 10, 15, 20 (`ABILITY_MILESTONE_LEVELS`)

---

## Locations and travel

**Primary towns** (`WORLD_LOCATIONS` in `src/world.js`):

| Id | Name | Notes |
|----|------|-------|
| `ashen_slums` | Cinderhook Slum | **Start location**; Chapter 1 hub |
| `lower_ward` | Lower Ward | Unlocks after slum gate |
| `ashen_keep` | Ashen Keep | Story refuge; locked until gate opens |
| `ashen_fields` | Ashen Fields | First hunt region |
| `market_town` | First Market Town | Locked until gate |
| `old_road`, `plague_village`, … | Road hubs | Connected via travel graph |

**Road stops:** `ROAD_NODES` in `src/roadNodes.js` (camps, waystones, shrines — build/claim supported).

**Travel:** `travelGraph.js` + `world.js` — multi-stop journeys, random encounters, camp rest (`establishCamp`, `fortifyCamp`, `restAtCamp`).

**Chapter 1 rail:** `chapterOneRoadsLocked()` blocks map travel, hunt, and scout outside Cinderhook until `prologue.lowerWardGate.unlocked`.

**Regions (overworld tiers):** `REGIONS` in `state.js` — Ashen Fields → Green March → Frostmere → Storm Coast → Hollow Kingdom.

---

## Quests and story beats

### Cinderhook prologue (`src/slumPrologue.js`)

Numbered contracts in `CHAPTER_ONE_CONTRACTS`:

1. Recover Stolen Food (scavenge)
2. Bring Borin Scrap (work)
3. Clear Knife-Corner (combat)
4. Break the Dock Rat Ledger (gang combat)
5. Gate lieutenant / bribe paths → `lowerWardGate.unlocked`

Also: alley fights, gang pressure, shelter, Town & Work modal.

### Lower Ward (`src/lowerWard.js`)

- **Quest chain:** `LOWER_WARD_QUESTS` (enter ward → commission → train path → recruit Garran → tax vault → foothold)
- **Commissions:** `WARD_COMMISSIONS` (Stamp Run, Alley Writ, Bell Watch, Candle Errand)
- **Trainers:** `TRAINER_NPCS` — one per advanced class path
- **NPCs:** Orlen Voss (clerk), Old Garran (companion), bailiff encounters

### Story log

`world.story[]` — journal entries from events; initial lines from `language.js` `initialStory`.

---

## NPCs

**Registry:** `src/npcRegistry.js`

- `SERVICE_NPCS` — named vendors (Seda Vell, Borin Ashhand, Nessa Hearth, …) with portrait assets under `assets/npcs/generated/v80/`
- `NPC_LINES` — ambient rumor/gamble/investigate lines
- Scene-specific NPCs in `slumPrologue.js`, `lowerWard.js`, `worldScenes.js`

Companions: `party.js` + slum/ward companion ids (`slum_mira`, `lower_ward_garran`).

---

## External APIs and network

**There is no game backend.** All gameplay is client-side.

| Network use | Where | Purpose |
|-------------|-------|---------|
| `fetch(version.json)` | `src/pwa.js` | PWA update check (same origin) |
| Stripe Payment Links | `src/supporterStore.js` | Optional real-money checkout via `localStorage` URLs |
| `serve` (dev) | `npm run dev` | Static file hosting only |

Court Ledger purchases are **cosmetics/convenience only** — no pay-to-win combat stats.

Playtest checkout grants items locally without charging when Stripe URLs are not configured.

---

## PWA and caching

- Bump **`?v=`** query strings in `index.html` CSS links, **`CACHE_VERSION`** in `service-worker.js`, and **`version.json`** together when shipping changes.
- Current: **v130**
- Users can clear cache via boot fallback button or browser devtools.

---

## Optional scripts

```bash
# Ship-readiness audit (needs dev server + Chrome)
node scripts/ship-readiness.mjs

# Combat screenshot QA
node scripts/test-combat-debug.mjs

# Regenerate polish-pass art
python3 scripts/polish-game-art.py
```

QA scripts write to `agent-tools/` (gitignored).

---

## Art pipeline

Regenerate polish-pass art (cultist, walk cycles, composites, location tints):

```bash
python3 scripts/polish-game-art.py
```

Install AI-generated combat art from artifacts:

```bash
python3 scripts/install-combat-art.py
```

Enemy visual “kits” (rat, bailiff, knife, captain, court) are **CSS tints** on shared bandit/skeleton sprites — not separate painted assets.

---

## Codex / continued development — read this first

### What is “done” vs thin

| Area | Maturity |
|------|----------|
| Chapter 1 (Cinderhook → gate → Lower Ward foothold) | **Playable loop** with rails, contracts, commissions |
| Combat + level-up ceremony + Growth | **Solid** first-hour experience |
| Skills (starter/oath kit) | Distinct effects; many later ability names still regex-generic |
| Map travel + road camps | Works; post-gate sandbox is open but content-light |
| Kingdoms / commander ranks / REGIONS tiers 2–5 | **Scaffold only** — do not expand until Chapter 1.5 feels complete |
| Hard areas, tavern recruits, painted gear layers | Partial / data-only |
| Combat log text | Mostly English; UI strings are EN+ES |

### Architecture constraints

1. **Circular imports** exist (combat ↔ ui ↔ world ↔ slum/ward). Pattern: export functions, call at runtime — do not add top-level cross-import side effects.
2. **CRLF line endings** in several core files (`combat.js`, `state.js`, `language.js`, `ui.js`, `main.js`, `world.js`, …). Prefer content-only diffs; avoid mass reformat.
3. **`window.FE`** is the public debug/console surface. Production strips `debug*` keys unless `?debug`.
4. **No build step** — every file is loaded directly; cache-bust via query strings + service worker version.
5. **Do not git-add** `agent-tools/`.

### Safe change patterns

- **New copy:** add keys to `language.js` (EN + ES sections).
- **New location:** extend `WORLD_LOCATIONS`, `ROAD_NODES`, travel routes; wire art in `locationArt.js`.
- **New quest:** follow `CHAPTER_ONE_CONTRACTS` or `LOWER_WARD_QUESTS` patterns with `save()` after mutations.
- **New skill:** add to `abilities.js`, ensure kind regex matches effect handler in `combat.js`.
- **Cache bump:** sync `index.html` `?v=`, `service-worker.js`, `version.json`, note in README.

### Product rules (do not break)

- **No pay-to-win.** Court Ledger = looks + convenience.
- **Chapter 1 gate** is `prologue.lowerWardGate.unlocked` (gold/rep/safety **or** lieutenant) — not boss-only.
- **Ability milestones** at 5, 10, 15, 20; **class path unlock** callout at level 2.
- Tutorial copy says Map opens after the gate — code now matches.

### Known QA notes

- `scripts/ship-readiness.mjs` may report a flaky “class choice” blocker when automating title skip — manual playtest passes.
- Manifest has empty `screenshots[]` (store listing gap, not gameplay).

---

## Court Ledger (real-money path)

The **Court Ledger** (scales icon next to Save) sells looks and convenience only.

Playtest checkout grants on this save without charging a card. To take real money, paste Stripe Payment Links:

```js
localStorage.setItem("btt_checkout_urls", JSON.stringify({
  founder_pack: "https://buy.stripe.com/...",
  ash_court_pass: "https://buy.stripe.com/...",
  ember_cloak: "https://buy.stripe.com/...",
  keep_frame: "https://buy.stripe.com/...",
  ash_patron: "https://buy.stripe.com/..."
}));
```

---

## Changelog

See `OVERNIGHT_CHANGELOG.md` for the autonomous development log.

Recent highlights:
- Cinderhook Slums + Lower Ward cinematic world scenes
- Level-up ceremony with fanfare and Growth nudge
- Chapter 1 rails until Lower Ward gate; cinematic HUD vitals
- Skill identity, ward commissions, camp rest, defeat crawl-to-inn
- Distinct enemy kits via CSS; EN+ES for slum/ward copy
