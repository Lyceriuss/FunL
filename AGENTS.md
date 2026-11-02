# AGENTS.md: working on FunL

This is the entry point for anyone changing this repo, human or AI agent. Read it first. Follow the links when you touch that area.

## What this is

FunL is a gamified learning web app for school-age children. Each subject is a **game module**. A shared **shell** provides input (touch, keyboard, gamepad), player profiles, menus, play-data recording (**telemetry**) and diagnostics (**logs**). Module 1 is **Math Monster**: mental arithmetic as an anime-style battle. The player purifies corrupted spirits (5 forms each, from menacing to cute; boss rounds are **forge puzzles** on the order of operations) and can befriend them as companions. See [docs/lore/WORLD.md](docs/lore/WORLD.md).

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
| `npm run diagrams` | draw every Mermaid diagram in `docs/` as an SVG in `docs/diagrams/` and collect them in `docs/DIAGRAMS.md` + the README's "How it fits together" (run after editing a diagram; needs Edge or Chrome; `npm test` fails while anything is stale) |

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
    audio/                 Synthesised sound effects + generative music by mood, settings, Sound panel (docs/AUDIO.md)
    pace/                  Input pace: time to enter an answer per player/device/length → extra time per equation (docs/INPUT-PACE.md)
    math/                  Shared maths: problems + generators, level rules, pack schemas (zod), seeded RNG, difficulty,
                           expressions with order of operations (expression.ts) and Forge puzzles (forge.ts, docs/FORGE.md)
    ui/                    Screen wrapper (controller menu navigation), ErrorBoundary, and the game UI kit:
                           number-entry/ (keypad, radial dial, NumberDock), forge/ (ForgeBoardView, forgeControls),
                           PathMap (world-map style node path), PauseMenu, Hero, ThinkBubble, useFlip, game.css
  modules/
    math-monster/          Pure engine (incl. Forge boss rounds), modes (Adventure, Practice classroom, Forge practice, Custom challenges), spirits, companion skill model. See docs/modules/math-monster.md
    maze-duel/             Race Glitch through a number maze: board generator, DuelEngine, rival planner. See docs/modules/maze-duel.md
  screens/                 Shell screens: Profiles, Home, Module (mode cards, mode pages, settings bar), Results, Data, Sound
  dev/                     Dev-only tools (e.g. ?gallery); excluded from production builds
scripts/
  diagrams.mjs             `npm run diagrams`: draws the docs' Mermaid diagrams as SVGs, writes docs/DIAGRAMS.md + README section
  env.d.ts                 Build-time constants (__APP_VERSION__ from package.json)
PATCHNOTES.md              Game-style changelog: one entry per change
docs/
  DIAGRAMS.md, diagrams/   Generated: every diagram from the docs as SVG images on one page (don't edit by hand)
  ARCHITECTURE.md          Diagrams (component, class, sequence, state, ER) + design
  TELEMETRY.md             Data dictionary: every recorded event and field
  LOGGING.md               Logging conventions, levels, namespaces
  MENTAL-MATH.md           Mental-math strategy catalogue, reasoning model, slips
  AUDIO.md                 Sound/music slots, moods, adding sounds
  INPUT-PACE.md            Input-time measurement and the per-equation allowance algorithm
  FORGE.md                 Forge puzzles (order of operations): rules, levels, traps, board, controls, thinkers
  DECISIONS.md             Why things are the way they are (ADR log)
  modules/math-monster.md  Math Monster internals (encounters, forms, spirits)
  modules/maze-duel.md     Maze Duel rules, board generation, Glitch
  lore/WORLD.md            Setting, spirits, writing rules (creature data itself lives in creatures.ts)
  examples/                Example content packs
```

## Core concepts (one line each)

- **Action**: a semantic input such as `math.digit(7)`, `nav(up)` or `pause`. Modules never read raw keys or buttons.
- **ControlScheme**: maps keyboard keys and gamepad buttons to actions, per module. Touch UI dispatches actions directly. Analogue input (e.g. Math Monster's radial dial) reads `input.stick()`; set `stickAsNav: false` when a module uses the stick itself.
- **GameModule**: the contract a game implements (`core/modules/types.ts`): metadata, controls, presets, settings, an optional `importPack`, and a `Component`. Optional `modes` (big cards on the module screen, each with its own panel, settings and presets; a panel can open sub-pages, `pages` + `openPage`) and `extras` (pages in the settings bar); without modes the module screen is one page with `Hub`.
- **Engine**: a module's pure game logic with no DOM or timers. The view calls `tick(dt)`; the engine emits events.
- **TelemetrySession**: records one play session's events (player behaviour) to IndexedDB.
- **Logger**: records app diagnostics (errors, lifecycle). It is *not* play data.
- **Reasoning** (`core/mental-math`): a strategy (count on, make ten, tens and ones…) turns a problem into steps. A wrong answer comes from a marked *slip* in those steps, never a random number. Steps can carry *notes* (values written down).
- **Input time vs think time**: `firstInputMs` = think time (equation shown → first input movement). `typingMs` = input time (first movement → answer). Games add `InputPace.allowance()` to each equation's travel time.
- **Content pack**: zod-validated JSON content for a module, e.g. a worksheet. It is the target format for the MCP server.
- **Progress**: long-lived per-player module state (e.g. befriended spirits), in the IndexedDB `progress` store via `getProgress`/`saveProgress`.
- **Mode** (Math Monster): `adventure` (fight & befriend; boss rounds are Forge rounds), `pack` (worksheet), `practice` (staged classroom: you and your companion each answer your own column; the companion is a seeded bot with a maths **mastery** of 0–5), `forge` (Forge workshop: one lesson at a level of its own 6-level ladder, alone or with the companion, `ForgePractice`), `challenge` (one stage of a **custom challenge**, played through one of the others). The equation modes share `useMathSession`.
- **Custom challenge** (Math Monster): 2–10 stages (battle, boss fight, Forge lesson, classroom lesson, each at a chosen difficulty) that a grown-up builds for a player, played in order on a PathMap. Pure model + zod schema in `challenges.ts`, stored per player under its own progress key.
- **Forge puzzle** (`core/math/forge`): make the target using **every** piece (numbers, signs, brackets); the challenge is the order of operations. Board state is pure (`forgeTake/Drop/Nav/Primary/Secondary/Check…`); games render it with `ForgeBoardView`.
- **Duel / piece / stone** (Maze Duel): each right answer is a *piece*: build one square, drop a *stone* next to the rival, or step back. Paths carry a number changed by operator squares; the gate needs exactly its target.
- **Encounter / round / form**: in Math Monster, one spirit is fought over 5 rounds, one form per round. Round 5 is the boss (the shard), and beating it purifies the spirit.
- **World map** (Math Monster Adventure): levels 1–5 are World 1 (Nyx), 6–10 World 2 (Myx), 11+ Endless; each level is a node, opened by clearing the one before (world gates are always open). Rules in `worldMap.ts`, drawn with `core/ui/PathMap`.

## Rules and invariants

1. **Modules are isolated.** `core/` doesn't know about specific modules, except `core/modules/registry.ts`. Modules import from `core/`, never from other modules.
2. **Game logic stays pure.** Engines have no React, DOM, `Date.now()` or `Math.random()`. Use the engine clock and the seeded RNG (`core/math/rng.ts`). Every rule change needs an engine test.
3. **Every input path goes through actions.** A new interaction must work with keyboard, touch *and* gamepad. Add it to the module's `ControlScheme` and its `help` text.
4. **Record, don't lose, data.** Player-relevant events go to `telemetry.log('<module>.<event>', data, device)`, and each event kind must be documented in [docs/TELEMETRY.md](docs/TELEMETRY.md). Never put personal data beyond the profile name or avatar into telemetry or logs.
5. **Telemetry ≠ logs.** Telemetry answers "how did the child do?". Logs answer "what did the app do / why did it break?". See [docs/LOGGING.md](docs/LOGGING.md).
6. **IndexedDB schema changes** must bump `DB_VERSION` and add an `if (oldVersion < N)` step in `core/telemetry/storage.ts`. Never edit an existing step, and add a migration test (see `storage.test.ts`).
7. **Content is validated at the boundary.** Anything imported (packs, future MCP input) is parsed with the module's zod schema before use.
8. **Times are engine time** for gameplay metrics, so they pause with the game. Use `performance.now()` for input latency and `Date.now()` only for wall-clock stamps.
9. **No secrets or play-data exports in git.** `.gitignore` covers `.env*` and `funl-export-*.json`.
10. **Keep menu frames cheap.** Controller presses are polled once per frame, so a slow frame (heavy SVG filters or animations) can swallow a press. Use `CreatureArt lite` in menus and lists.
11. **Line endings are LF** (`.gitattributes`). Scripted edits must not write CRLF (Python on Windows does this by default; use `newline='\n'`).
12. **Menus must work with only a controller.** Every interactive element is `data-focusable`. No `window.confirm/prompt` (use `ConfirmButton`), and no text entry without `OnScreenKeyboard`.
13. **Sound goes through `audio`.** Use `audio.sfx(slot)` / `audio.music(slot)`. Add new moments as slots with mood-tagged variants in `core/audio/library.ts`, and keep "wrong" sounds gentle.
14. **Share through `core/`, never between modules.** Number entry, the pause menu, the heroine, thought bubbles and maths problems live in `core/`. If a second module needs something from a module, move it into `core/` first.

## Common tasks

- **Add a game module:** follow [docs/ARCHITECTURE.md#adding-a-module](docs/ARCHITECTURE.md#adding-a-module), then add `docs/modules/<id>.md` and its events to TELEMETRY.md.
- **Add a setting to a module:** add a `SettingDef` to the module's `settings` and read it from `props.settings`. The shell renders and persists it.
- **Add a telemetry event:** emit it from the engine, then document it in TELEMETRY.md.
- **Add a spirit or tweak creature art:** follow [docs/lore/WORLD.md#adding-a-spirit](docs/lore/WORLD.md#adding-a-spirit), then check every form at `/?gallery`.
- **Add a module page** (collection, progress…): add an `extras` entry (settings bar), a mode `Panel`, or a sub-page of a mode (`pages` + `openPage`); for a one-page module, set `GameModule.Hub`.
- **Show progress as a map of levels:** use `core/ui/PathMap` (regions of nodes, a details panel, A to play).
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

Diagrams are Mermaid in Markdown, so edit them as text. Edit a diagram in its source doc, then run `npm run diagrams`: it draws only new or changed diagrams into `docs/diagrams/*.svg` (each stamped with a hash of its source), refreshes `docs/DIAGRAMS.md` and the README section, and lists any diagram that doesn't parse. `npm test` fails until you do. `--force` redraws everything (e.g. after changing the look in the script).
