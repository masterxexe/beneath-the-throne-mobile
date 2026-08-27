# Beneath the Throne

Beneath the Throne is an existing mobile-first dark-fantasy browser RPG. The playable game lives in `btt-web-playtest/` and remains a vanilla JavaScript, native ES-module PWA with no framework, bundler, backend, or second state store.

The `webmcp-challenge` branch adds a thin WebMCP adapter over the existing game systems. The branch does **not** publish the repository, configure hosting, merge into `main`, or submit a Devpost entry. There is no public live URL yet.

## WebMCP Challenge scope

The game registers exactly ten tools—seven read-only and three guarded mutations—when `document.modelContext.registerTool` or `navigator.modelContext.registerTool` is available:

| Tool | Mode | Existing source of truth |
|---|---|---|
| `get_player_status` | Read-only | Live hero state plus canonical combat-derived totals |
| `get_inventory` | Read-only | Hero backpack and existing consumable/resource counts |
| `get_equipment` | Read-only | Existing equipment slots and derived combat totals |
| `get_current_location` | Read-only | Canonical world/current-place selector |
| `get_quest_log` | Read-only | Existing Cinderhook and Lower Ward quest selectors |
| `get_available_actions` | Read-only | Existing combat, world, Cinderhook, Lower Ward, and UI availability selectors |
| `get_storyteller_options` | Read-only | Pure game-owned eligibility selector for three predefined non-combat Storyteller events |
| `use_item` | Guarded mutation | Canonical combat potion functions; only `health_potion` and `mana_potion` |
| `equip_item` | Guarded mutation | Canonical `gear.equip(id)` using an exact ID from the latest inventory read |
| `trigger_story_event` | Guarded mutation | Presents one freshly eligible predefined event using its exact one-use observation token |

`get_storyteller_options` can inspect only the game-defined `cinderhook_warning_messenger`, `tavern_suspicious_stranger`, and `market_cutpurse` events when their canonical eligibility conditions are met. Each offered event receives its own in-memory one-use token. `trigger_story_event` revalidates that exact event and context, then presents the fixed EN/ES event to the human player. It cannot choose or resolve any response.

WebMCP does not expose travel, combat commands, abilities, dialogue choices, NPC interaction choices, quest acceptance or claiming, Storyteller resolution, autonomous play, arbitrary JavaScript, or arbitrary `FE.*` execution. Browsers without WebMCP continue running the normal game without registering tools.

The adapter uses fixed schemas and routes, revalidates mutations at execution time, and returns detached JSON-safe projections. Storyteller history is a lazy, backward-compatible addition inside the existing save; there is no second save system or state store.

## Install, run, and test

Requirements: Node.js 18+ and a modern browser. Chrome or Edge is required for browser-backed QA.

```bash
cd btt-web-playtest
npm ci
npm run dev
```

Open `http://127.0.0.1:43123`.

```bash
# Complete normal-game, PWA, WebMCP, and mutation regression suite
npm run qa:webmcp

# Pure Storyteller catalog and eligibility regression suite
npm run qa:storyteller

# Build the allowlisted hackathon artifact
npm run prepare:deployment

# Rebuild and test that artifact at a nested URL path
npm run qa:public
```

Set `CHROME` or `EDGE` to the browser executable if it is not installed in a standard location.

WebMCP can be tested in the ChatGPT in-app browser, where support is available out of the box, or in Google Chrome using the WebMCP experimental flag or origin trial. These paths are documented on the [official OpenAI WebMCP Challenge page](https://openai.com/webmcp-challenge/). Service-worker and installable-PWA features require HTTPS or localhost. Other modern browsers can still play the game normally when WebMCP is unavailable.

Local developer cheats require both a loopback host and `?debug`. A public hostname ignores `?debug`, strips debug helpers and non-prefixed development helpers from `window.FE`, and does not render debug controls.

## Deployment artifact

`npm run prepare:deployment` invokes the explicit `hackathon` deployment profile and creates a provider-neutral static artifact at `btt-web-playtest/dist/public/` plus a deterministic SHA-256 manifest at `btt-web-playtest/dist/deployment-manifest.json`. The builder refuses to create a public artifact if the profile is omitted or unknown.

The artifact is allowlisted to contain only:

- Runtime HTML, CSS, manifest, service worker, and version files.
- `src/**/*.js` native browser modules.
- Runtime images under `assets/` and PWA icons under `icons/`.

It excludes QA and art-generation scripts, `agent-tools`, dependencies, package metadata, READMEs, environment files, logs, and local filesystem paths. For judge-facing hackathon builds it also omits the Court Ledger module, UI/routes, checkout configuration, mock grants, payment copy, and monetization setup while preserving the normal game and all ten WebMCP tools. The normal development source still contains the existing Court Ledger; only generated copies under `dist/public/` are transformed. A profile-specific build/cache suffix prevents a prior full-build cache from being reused.

`npm run qa:public` verifies that the source still has the development Ledger, the artifact has no Ledger/payment implementation or UI in EN/ES, its module graph is completely precached, WebMCP remains byte-for-byte unchanged, and the artifact still passes normal-game, offline-PWA, and exact-ten-tool browser tests. `dist/` is ignored and should be regenerated instead of committed.

The manual-only GitHub Pages workflow at `.github/workflows/deploy-pages.yml` runs the source and public regression suites, requires the `webmcp-challenge` branch and an explicit deployment confirmation, and uploads only `btt-web-playtest/dist/public`. It has no push trigger, does not enable Pages, and cannot deploy until an owner deliberately configures Pages and dispatches it. GitHub exposes manual-dispatch workflows only after the workflow file exists on the repository's default branch, so this branch-only preparation remains intentionally inactive.

## Challenge review lineage

GitHub review commits on `webmcp-challenge`:

| Checkpoint | Commit |
|---|---|
| Pre-WebMCP baseline / current `main` | `33ddfab87e052e01c6d49c16dcd5d36e77b6c9a2` |
| Four read-only WebMCP tools | `70acab60c2ed8b48f3cba50b06af9fb4cadd1370` |
| Six read-only WebMCP tools | `32b31d5bde2f405d2579eeb40c064e63ef70c73a` |
| Approved eight-tool checkpoint | `2425895704f1d6cb2dbf908d3eb7a65061c96b81` |
| Public-readiness cleanup | `8ea8c92925d352068e2db559add336eab20bdabe` |
| Storyteller read/eligibility checkpoint | `128e6f19d7f44b52633f85693c23e8ebe74f371e` |
| Guarded Storyteller trigger / release candidate | `ccd17872dd869e5304d304f86dd5d5536cd3da36` |

The equivalent local commits have different object IDs because the checkpoints were mirrored to GitHub: `67b0c16`, `a9e11f6`, `c2f5c8b`, and `32c8018`.

## Repository layout

| Path | Purpose |
|---|---|
| `btt-web-playtest/` | Static ES-module PWA |
| `btt-web-playtest/src/` | Gameplay, state, UI, and thin WebMCP adapter |
| `btt-web-playtest/assets/` | Artwork and item/portrait/location media |
| `btt-web-playtest/scripts/` | Local QA, artifact preparation, and art tooling |

See `btt-web-playtest/README.md` for the detailed architecture, save model, systems map, WebMCP routing, and QA notes.

## License

Unless otherwise noted, the owner-created contents of this repository—including source code, artwork, icons, narrative text, game data, and documentation—are available under the [ISC License](LICENSE). Third-party components retain their own licenses; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and [ASSET_PROVENANCE.md](ASSET_PROVENANCE.md).

This license applies only to this Beneath the Throne mobile/web repository. It does not license or grant rights to any separate Beneath the Throne Unreal Engine project, and it does not grant trademark rights or imply endorsement.
