# Beneath the Throne — Web Playtest

Mobile-first dark fantasy RPG playtest (static PWA). No build step — vanilla ES modules served over HTTP.

## Local development

```bash
npm run dev
```

Open `http://127.0.0.1:43123` in your browser.

The opening fight walks Attack → Defend → Potion, then Cinderhook with a numbered briefing. Combat uses generated sword/block/hit sounds and looping beds (title, fights, roads, the dragon scene). Mute from the title screen or the HUD speaker; Settings can toggle music and fight sounds separately.

### Court Ledger (real-money path)

The **Court Ledger** (scales icon next to Save) sells looks and convenience only. Combat power stays earned.

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

Ko-fi or Patreon can map to **Patron of Ash**. App Store / Play Billing come later if you wrap the PWA.

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
FE.debugPlayAttackStyle('overhead')        // force a named hero swing
FE.debugPlayAttackStyle('pounce','enemy')  // force a named enemy strike
FE.debugEquipWeaponCategory('axe')         // sword, axe, spear, mace, dagger, bow, staff, shield, unarmed
FE.debugBootSlumScene()                    // jump to slum world scene
FE.debugBootLowerWard()                    // jump to lower ward scene
```

Combat attacks now cycle Mortal Kombat-style choreography per weapon: slash / overhead / rising / cross for swords, plus unique sets for axe, spear, mace, dagger, bow, staff, shield, and unarmed. Enemies have their own strike sets (skeleton, wolf, bandit, cultist, corrupted knight). Open `?debug` in combat to use the Attack Studio.

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
├── combat-animations.css # MK-style attack choreography
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
- PWA cache sync, procedural combat audio, i18n combat strings
- Ambient NPCs in slums and lower ward

## Cache version

Current: **v123** (`index.html`, `service-worker.js`, `version.json`, `redesign.css`)
