# AGENTS.md: working on FunL

This is the entry point for anyone changing this repo, human or AI agent. Read it first. Follow the links when you touch that area.

## What this is

FunL is a gamified learning web app for school-age children. Each subject is a **game module**. A shared **shell** provides input (touch, keyboard, gamepad), player profiles, menus, play-data recording (**telemetry**) and diagnostics (**logs**). Module 1 is **Math Monster**: mental arithmetic as an anime-style battle. The player purifies corrupted spirits (5 forms each, from menacing to cute) and can befriend them as companions. See [docs/lore/WORLD.md](docs/lore/WORLD.md).

We treat this like game development: every change ships with a **patch note** in [PATCHNOTES.md](PATCHNOTES.md).

Planned next: an MCP server, so an AI assistant can create content packs (e.g. from a photo of a paper worksheet) and read progress. See [docs/ARCHITECTURE.md#mcp-and-backend-planned](docs/ARCHITECTURE.md#mcp-and-backend-planned).

## Commands

| Command | Does |
|---|---|
| `npm install` | install dependencies (Node 22+) |
| `npm run dev` | dev server at http://localhost:5173 (add `?log=debug` for verbose logs, `?gallery` for the creature art gallery) |
| `npm test` | unit tests (Vitest) |
| `npm run typecheck` | `tsc -b` |
| `npm run lint` | oxlint |
| `npm run build` | typecheck + production build to `dist/` |

**Before you call a change done:** run `npm run typecheck && npm run lint && npm test`. In dev builds, browser tests can reach `window.__funl.engine` (current game engine) and `window.__funlInput` (InputManager). For UI changes, also run the app and try it with keyboard *and* touch. Try a controller too if input code changed.

## Repo map

```
src/
  main.tsx                 Bootstrap: logging → error handlers → input → React
  App.tsx                  Shell: ErrorBoundary + route state machine (profiles → home → module → game → results)
  styles.css               Global theme (dark/neon tokens on :root)
  core/                    Shared shell. Must never import from src/modules/* (except registry.ts)
    input/                 Device → action mapping, InputManager singleton, React hooks
    telemetry/             TelemetrySession (play data), IndexedDB storage + migrations
    log/                   Logger (diagnostics), IndexedDB log sink, global error capture
    modules/               GameModule contract, registry, per-player settings
    mental-math/           How people calculate: strategies, reasoning steps, notes and typical slips (docs/MENTAL-MATH.md)
    ui/                    Screen wrapper (controller menu navigation), ErrorBoundary
  modules/
    math-monster/          Module 1. Pure engine, modes (Adventure, Practice classroom), spirits, companion skill model. See docs/modules/math-monster.md
  screens/                 Shell screens: Profiles, Home, Module (setup + module Hub), Results, Data
  dev/                     Dev-only tools (e.g. ?gallery); excluded from production builds
  env.d.ts                 Build-time constants (__APP_VERSION__ from package.json)
PATCHNOTES.md              Game-style changelog: one entry per change
docs/
  ARCHITECTURE.md          Diagrams (component, class, sequence, state, ER) + design
  TELEMETRY.md             Data dictionary: every recorded event and field
  LOGGING.md               Logging conventions, levels, namespaces
  MENTAL-MATH.md           Mental-math strategy catalogue, reasoning model, slips
  DECISIONS.md             Why things are the way they are (ADR log)
  modules/math-monster.md  Module 1 internals (encounters, forms, spirits)
  lore/WORLD.md            Setting, spirits, writing rules (creature data itself lives in creatures.ts)
  examples/                Example content packs
```

## Core concepts (one line each)

- **Action**: a semantic input such as `math.digit(7)`, `nav(up)` or `pause`. Modules never read raw keys or buttons.
- **ControlScheme**: maps keyboard keys and gamepad buttons to actions, per module. Touch UI dispatches actions directly.
- **GameModule**: the contract a game implements (`core/modules/types.ts`): metadata, controls, presets, settings, an optional `importPack`, and a `Component`.
- **Engine**: a module's pure game logic with no DOM or timers. The view calls `tick(dt)`; the engine emits events.
- **TelemetrySession**: records one play session's events (player behaviour) to IndexedDB.
- **Logger**: records app diagnostics (errors, lifecycle). It is *not* play data.
- **Reasoning** (`core/mental-math`): a strategy (count on, make ten, tens and ones…) turns a problem into steps. A wrong answer comes from a marked *slip* in those steps, never a random number. Steps can carry *notes* (values written down).
- **Content pack**: zod-validated JSON content for a module, e.g. a worksheet. It is the target format for the MCP server.
- **Progress**: long-lived per-player module state (e.g. befriended spirits), in the IndexedDB `progress` store via `getProgress`/`saveProgress`.
- **Mode** (Math Monster): `adventure` (fight & befriend), `pack` (worksheet), `practice` (staged classroom: you and your companion each answer your own column; the companion is a seeded bot with a maths **mastery** of 0–5). All modes share `useMathSession`.
- **Encounter / round / form**: in Math Monster, one spirit is fought over 5 rounds, one form per round. Round 5 is the boss (the shard), and beating it purifies the spirit.

## Rules and invariants

1. **Modules are isolated.** `core/` doesn't know about specific modules, except `core/modules/registry.ts`. Modules import from `core/`, never from other modules.
2. **Game logic stays pure.** Engines have no React, DOM, `Date.now()` or `Math.random()`. Use the engine clock and the seeded RNG (`rng.ts`). Every rule change needs an engine test.
3. **Every input path goes through actions.** A new interaction must work with keyboard, touch *and* gamepad. Add it to the module's `ControlScheme` and its `help` text.
4. **Record, don't lose, data.** Player-relevant events go to `telemetry.log('<module>.<event>', data, device)`, and each event kind must be documented in [docs/TELEMETRY.md](docs/TELEMETRY.md). Never put personal data beyond the profile name or avatar into telemetry or logs.
5. **Telemetry ≠ logs.** Telemetry answers "how did the child do?". Logs answer "what did the app do / why did it break?". See [docs/LOGGING.md](docs/LOGGING.md).
6. **IndexedDB schema changes** must bump `DB_VERSION` and add an `if (oldVersion < N)` step in `core/telemetry/storage.ts`. Never edit an existing step, and add a migration test (see `storage.test.ts`).
7. **Content is validated at the boundary.** Anything imported (packs, future MCP input) is parsed with the module's zod schema before use.
8. **Times are engine time** for gameplay metrics, so they pause with the game. Use `performance.now()` for input latency and `Date.now()` only for wall-clock stamps.
9. **No secrets or play-data exports in git.** `.gitignore` covers `.env*` and `funl-export-*.json`.
10. **Keep menu frames cheap.** Controller presses are polled once per frame, so a slow frame (heavy SVG filters or animations) can swallow a press. Use `CreatureArt lite` in menus and lists.
11. **Line endings are LF** (`.gitattributes`). Scripted edits must not write CRLF (Python on Windows does this by default; use `newline='\n'`).

## Common tasks

- **Add a game module:** follow [docs/ARCHITECTURE.md#adding-a-module](docs/ARCHITECTURE.md#adding-a-module), then add `docs/modules/<id>.md` and its events to TELEMETRY.md.
- **Add a setting to a module:** add a `SettingDef` to the module's `settings` and read it from `props.settings`. The shell renders and persists it.
- **Add a telemetry event:** emit it from the engine, then document it in TELEMETRY.md.
- **Add a spirit or tweak creature art:** follow [docs/lore/WORLD.md#adding-a-spirit](docs/lore/WORLD.md#adding-a-spirit), then check every form at `/?gallery`.
- **Add a module panel** (collection, progress…): set `GameModule.Hub`. It renders on the module screen.
- **Debug a user's problem:** ask for Data → Diagnostics → "Download logs", or open the app with `?log=debug`.

## Patch notes and versions

Every change, however small, adds to [PATCHNOTES.md](PATCHNOTES.md) in the same change:

1. **Bump the version** in `package.json` (the only place it lives; the app reads it at build time as `__APP_VERSION__`):
   - **minor** for new content, features or gameplay changes. Give the update a name, e.g. `v0.3.0 · "Spirits of Lumora"`.
   - **patch** for fixes, balance tweaks, tooling or docs.
2. **Add an entry at the top** with the date and the sections that apply: ✨ New · 🎮 Gameplay · ⚖️ Balance · 🎨 Art & UI · 🐛 Fixes · 📊 Data & telemetry · 🛠️ Dev & tooling.
3. Write for players and parents first (what changed for them), then add dev notes. Mention any new telemetry events or storage migrations.

Several small changes in one session can share one patch entry.

## Keeping context fresh (docs are part of the change)

When you change behaviour, update the doc that describes it **in the same change**:

| If you change… | Update… |
|---|---|
| anything at all | `PATCHNOTES.md` + version bump |
| creatures, story, world | `src/modules/math-monster/creatures.ts` + `docs/lore/WORLD.md` |
| mental-math strategies or slips | `docs/MENTAL-MATH.md` catalogue (+ tests: unmarked calc steps must be true) |
| folders, core contracts, data flow | `AGENTS.md` repo map, `docs/ARCHITECTURE.md` diagrams |
| telemetry events or fields | `docs/TELEMETRY.md` |
| a module's rules, levels, controls | `docs/modules/<id>.md` |
| a significant design choice | add an entry to `docs/DECISIONS.md` |
| commands or setup | this file + `README.md` |
| a dependency, tool or browser API | `README.md` → "Tools and technologies" (the README has no roadmap/"Next" section) |

Diagrams are Mermaid in Markdown, so edit them as text. GitHub and VS Code (with a Mermaid extension) render them.
