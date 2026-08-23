# Beneath the Throne — Web Playtest

Mobile-first dark fantasy RPG playtest (static PWA). No build step — vanilla ES modules served over HTTP.

## Local development

```bash
npm run dev
```

Open `http://127.0.0.1:43123` in your browser.

### Debug mode

Append `?debug` to the URL for dev cheats exposed on `window.FE`.

**Title screen debug buttons** (when `?debug`):
- Combat layout tests (1v1, 1v2, 2v3)
- Jump to Cinderhook Slums or Lower Ward cinematic scenes
- Cultist enemy visual test

**Browser console:**

```js
FE.debugStartEnemyVisualTest('skeleton')  // enemy pose cycling
FE.debugStartEnemyVisualTest('cultist')    // distinct cultist sprites
FE.debugTriggerCombatPose('attack')        // player attack animation
FE.debugBootSlumScene()                    // jump to slum world scene
FE.debugBootLowerWard()                    // jump to lower ward scene
```

## Art pipeline

Regenerate polish-pass art (cultist, walk cycles, composites, location tints):

```bash
python3 scripts/polish-game-art.py
```

Install AI-generated combat art from artifacts:

```bash
python3 scripts/install-combat-art.py
```

Verify combat with Puppeteer screenshots:

```bash
node scripts/test-combat-debug.mjs
```

## Project layout

```
btt-web-playtest/
├── index.html
├── styles.css
├── redesign.css          # Ash Court visual overlay
├── version.json          # PWA update version
├── OVERNIGHT_CHANGELOG.md
├── manifest.webmanifest
├── icons/
├── assets/
│   ├── actors/generated/v80/     # enemy + companion combat sprites
│   ├── npcs/generated/v80/       # NPC portrait busts
│   ├── portraits/player/poses/   # player combat + walk poses (v80)
│   ├── portraits/player/composites/  # per-loadout gear composites
│   ├── battlebacks/generated/    # combat scene backgrounds
│   ├── towns/generated/          # world location art + v71 scenes
│   └── ...
└── src/
```

## Overnight improvements (latest)

See `OVERNIGHT_CHANGELOG.md` for the full autonomous pass log.

Highlights:
- Cinderhook Slums + Lower Ward cinematic world scenes
- Distinct cultist enemy, companion healer/mage sprites
- v80 walk cycles and full gear composite poses
- PWA cache sync, WebAudio stub, i18n combat strings
- Ambient NPCs in slums and lower ward

## Cache version

Current: **v109** (`index.html`, `service-worker.js`, `version.json`)
