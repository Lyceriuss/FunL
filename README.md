# FunL

Learning through games for school-age kids. It's a web app that works with **touch, keyboard and game controllers**, and it records detailed play data (speed, accuracy, misclicks) for later analysis.

**Module 1: Math Monster** has two modes:
- **Adventure:** the moon-fox brothers Nyx and Myx have been corrupted by the Static. Your swordswoman answers the equations they throw at her, and round by round the spirit turns from menacing to cute. Break the last shard in the boss round to purify a spirit, then befriend it as your companion.
- **Practice classroom:** you and your companion sit side by side, each with your own column of equations on the chalkboard. You both answer at your own pace. Your companion thinks out loud: its thought bubble shows real mental-math strategies step by step (count on, make ten, tens and ones…). When it's wrong, you can see where its reasoning slipped. It earns maths stars as you practise together. Pass a stage (9/12) and the next, harder one starts automatically; otherwise try again.

## Current build

**v0.10.0 · "Your Pace"** (2026-10-24). Full history in [PATCHNOTES.md](PATCHNOTES.md).

| | |
|---|---|
| **Playable** | Adventure (10 stages + endless, 5-round spirit encounters with boss rounds, 5 lives refilled every round, up to 4 equations at once with knockback on correct answers), practice classroom (staged ladder of 9 topics × 2 paces), Spirit Journal, worksheet import, data export and diagnostics |
| **Characters** | Hero: anime swordswoman. Spirits: Nyx (little brother) and Myx (big brother), 5 forms each |
| **Input** | Touch/mouse on-screen keypad · keyboard · **Xbox-style controller with a radial number dial** (left stick points, A types, X deletes, Y sends). Every menu works with only a controller (on-screen keyboard for names) |
| **Pacing** | Learns each player's input speed per device and answer length (measured from the first stick movement, key or tap) and gives every equation matching extra time |
| **Sound** | Synthesised effects (10 moments × 3–4 moods) and 5 generative music loops for Menus / Adventure / Boss / Classroom, chosen in the 🔊 Sound panel (menu and pause) |
| **Companion brain** | 30 mental-math strategies with typical slips, maths mastery 0–5 ★ |
| **Progress** | Saved per player in the browser; resettable from the Math Monster screen ("Reset progress") |
| **Tests** | 71 unit/property tests in 11 files (`npm test`), all passing |
| **Bundle** (production) | JS 466 kB (143 kB gzipped) · CSS 46 kB (11 kB gzipped) |
| **Runs on** | Current Chromium-based browsers (Edge, Chrome), tested on desktop, tablet and phone sizes in portrait and landscape |

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173   (?log=debug verbose logs, ?gallery character art)
npm test             # unit tests
npm run typecheck && npm run lint
npm run build        # production build → dist/
```

Requires Node 22+.

## Tools and technologies

Versions are the ones installed for the current build (ranges are in `package.json`, exact versions in `package-lock.json`).

### Language and runtime
| Tool | Version | What it is | How we use it |
|---|---|---|---|
| **TypeScript** | 6.0.3 | JavaScript with static types | All app and test code. Strict settings (`noUnusedLocals`, `erasableSyntaxOnly`, `verbatimModuleSyntax`) in `tsconfig.app.json` |
| **Node.js** + **npm** | 22.12 / 10.9 | JavaScript runtime and package manager | Runs the dev server, build, tests and lint |

### App framework and build
| Tool | Version | What it is | How we use it |
|---|---|---|---|
| **React** (+ react-dom) | 19.3.1 | UI component library | All screens and game views. Games re-render every animation frame from a pure engine's state. `StrictMode` is on in dev |
| **Vite** + `@vitejs/plugin-react` | 8.3.4 / 6.1.2 | Dev server and bundler | Instant reload in dev and an optimised build in `dist/`. Also injects `__APP_VERSION__` from `package.json` (`vite.config.ts`) |

### Libraries
| Tool | Version | What it is | How we use it |
|---|---|---|---|
| **idb** | 8.0.4 | Small promise wrapper around IndexedDB | Talks to the browser database (`src/core/telemetry/storage.ts`) |
| **zod** | 4.6.7 | Schema validation | Validates content packs (e.g. worksheets) before they reach a game (`src/modules/math-monster/schema.ts`) |

### Browser platform APIs (no extra libraries)
| API | How we use it |
|---|---|
| **IndexedDB** | Profiles, sessions, telemetry events, content packs, per-player progress and diagnostics logs. Versioned step-by-step migrations (schema v3) |
| **localStorage** | Small per-device conveniences: last profile, per-player settings, log level |
| **Gamepad API** | Controller support: buttons and the analogue left stick (radial dial angle), polled every animation frame (`src/core/input/InputManager.ts`) |
| **Pointer Events** | Touch, mouse and pen input, plus misclick detection (taps that hit nothing) |
| **Keyboard Events** | Keyboard play and menu navigation |
| **requestAnimationFrame** | Game loops and gamepad polling |
| **Web Audio API** | All sound and music, synthesised live (oscillators, filtered noise, envelopes) with a look-ahead music scheduler (`src/core/audio`). No audio files |
| **SVG + CSS animations** | All art is code: the heroine, and procedurally drawn spirits (`Creature.tsx`). No image files |
| **Google Fonts** | The *Chakra Petch* typeface (loaded in `index.html`) |

### Testing and quality
| Tool | Version | What it is | How we use it |
|---|---|---|---|
| **Vitest** | 5.0.5 | Test runner (Vite-native, Jest-compatible) | Unit and property tests: game engine, problem generation, mental-math strategies, companion skill model, classroom stages, radial dial, telemetry, logging, storage migrations |
| **fake-indexeddb** | 6.2.6 | In-memory IndexedDB for Node | Lets storage and migration tests run outside a browser |
| **oxlint** | 1.88.0 | Fast linter (Rust) | Code quality, plus React rules (`.oxlintrc.json`, `npm run lint`) |
| **tsc** | 6.0.3 | TypeScript compiler | Type-checking (`npm run typecheck`). Vite does the actual compiling |
| **Playwright (`playwright-core`)** + Microsoft Edge | – | Browser automation | Used *ad hoc*, outside the project's dependencies, to play through flows in a real headless browser (keyboard, touch, simulated Xbox controller incl. the analogue stick) and take screenshots. In dev builds, tests can inspect `window.__funl.engine` and `window.__funlInput` |

### Project infrastructure and docs
| Tool | What it is | How we use it |
|---|---|---|
| **Git** + `.gitattributes` | Version control | LF line endings are enforced, and play-data exports and secrets are git-ignored |
| **Markdown + Mermaid** | Text docs and text-based diagrams | Architecture/UML diagrams in `docs/`, rendered by GitHub and VS Code |
| **VS Code** | Editor | Recommended extensions in `.vscode/extensions.json`: Mermaid preview, oxc (lint), Vitest explorer |
| **AI coding agents** | e.g. Claude Code | Work from `AGENTS.md` / `CLAUDE.md`. Every change is recorded in `PATCHNOTES.md` |

### In-house building blocks (in `src/core/`)
| Part | Purpose |
|---|---|
| Input system | Turns keyboard, gamepad (buttons + analogue stick) and touch into the same *actions*, with a control scheme per game |
| Telemetry | Records every play session's events for analysis |
| Logger | App diagnostics with levels, namespaces, persistence and error capture |
| Module registry | The contract every learning game implements, plus per-player settings and progress (save / reset) |
| Input pace | Learns how long each player needs to *enter* an answer per device and length, and gives equations matching extra time (`src/core/pace`, see [docs/INPUT-PACE.md](docs/INPUT-PACE.md)) |
| Audio engine | Sound effects per game moment and generative music per mood, with a library to audition and choose from (`src/core/audio`, see [docs/AUDIO.md](docs/AUDIO.md)) |
| Mental-math engine | How people actually calculate: 30 strategies (count on, make ten, tens and ones, columns…) that turn a problem into reasoning steps and notes, plus the typical slips that lead to wrong answers (`src/core/mental-math`, see [docs/MENTAL-MATH.md](docs/MENTAL-MATH.md)) |

## Documentation

| Doc | For |
|---|---|
| [AGENTS.md](AGENTS.md) | **Start here.** Repo map, rules, commands, how to keep docs current (people and AI agents) |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | UML/Mermaid diagrams: components, contracts, runtime sequence, navigation, storage ER |
| [docs/TELEMETRY.md](docs/TELEMETRY.md) | Data dictionary of every recorded event and summary field |
| [docs/LOGGING.md](docs/LOGGING.md) | Diagnostics logging: levels, namespaces, getting logs from a device |
| [docs/MENTAL-MATH.md](docs/MENTAL-MATH.md) | How the app models mental calculation: strategies, reasoning steps, notes, slips |
| [docs/AUDIO.md](docs/AUDIO.md) | Sound effects and music: slots, moods, how to add a sound |
| [docs/INPUT-PACE.md](docs/INPUT-PACE.md) | How input time is measured and how equations get extra time for each player's pace |
| [docs/modules/math-monster.md](docs/modules/math-monster.md) | Math Monster: modes, rules, the classroom and companion model, controls, packs |
| [docs/lore/WORLD.md](docs/lore/WORLD.md) | The world of Lumora, the spirits, writing rules |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Why things are the way they are |
| [PATCHNOTES.md](PATCHNOTES.md) | What changed in each version (game-style patch notes) |
