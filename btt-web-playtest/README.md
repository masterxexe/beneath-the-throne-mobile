# Beneath the Throne — Web Playtest

Mobile-first dark fantasy RPG playtest (static PWA). No build step — vanilla ES modules served over HTTP.

## Local development

```bash
npm run dev
```

Open `http://127.0.0.1:43123` in your browser.

### Debug mode

Append `?debug` to the URL for dev cheats exposed on `window.FE`.

Useful debug commands in the browser console:

```js
FE.debugStartEnemyVisualTest('skeleton')  // test enemy pose cycling
FE.debugTriggerCombatPose('attack')       // test player attack animation
FE.debugEnemyVisualAssets()               // inspect enemy art registry
```

## Project layout

```
btt-web-playtest/
├── index.html
├── styles.css
├── redesign.css
├── manifest.webmanifest
├── icons/
├── assets/
│   ├── actors/generated/v80/     # enemy + companion combat sprites
│   ├── npcs/generated/v80/       # NPC portrait busts
│   ├── portraits/player/poses/   # player combat pose frames
│   ├── battlebacks/generated/    # combat scene backgrounds
│   ├── towns/generated/          # world location art
│   └── ...
├── scripts/
│   ├── install-combat-art.py     # install AI-generated art from artifacts
│   └── generate-combat-art.py    # legacy procedural fallback (deprecated)
└── src/
```

## Art assets

Combat art uses the **Ash Court** palette — gritty painted dark fantasy with gold/ember accents. Assets are versioned (`v80` is the current production-quality set).

### Asset categories

| Category | Location | Poses |
|----------|----------|-------|
| Enemies | `assets/actors/generated/v80/` | idle, attack, hurt + defeated in `portraits/enemies/` |
| Player combat | `assets/portraits/player/poses/base/` | slash, thrust, block, hurt, cast, defeated |
| NPCs | `assets/npcs/generated/v80/` | portrait busts |
| Battlebacks | `assets/battlebacks/generated/` | scene backgrounds (verified valid) |
| World scenes | `assets/towns/generated/`, `ministops/`, `worldstates/` | location art (verified valid) |

### Regenerating combat art

1. Generate new images via Cursor `GenerateImage` (or place PNGs in `/opt/cursor/artifacts/assets/`)
2. Name files following the convention: `{entity}-{pose}-v80.png`
3. Run the install script:

```bash
python3 scripts/install-combat-art.py
```

This normalizes sizes, generates defeated enemy poses, refreshes composite frames, and writes to `assets/`.

4. Update references in `src/enemyVisuals.js`, `src/gearVisuals.js`, `src/npcRegistry.js` if version changes
5. Bump cache version (`?v=`) in `index.html`

### What still needs manual upload

- **Gear composite idle frames** (`composites/*/idle-v38.png`) — still use older layered gear art; combat poses updated to v80
- **Walk cycle frames** — traversal poses still derived from idle crop; dedicated walk art would improve overworld
- **Paper-doll SVG gear layers** — functional placeholders for inventory UI

## Note on assets

The uploaded zip may contain source code only. This repo includes the full `assets/` tree with v80 painted combat art.
