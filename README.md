# FunL

Learning through games for school-age kids. It's a web app that works with **touch, keyboard and game controllers**, and it records detailed play data (speed, accuracy, misclicks) for later analysis.

**Module 1: Math Monster** has two modes:
- **Adventure:** the moon-fox brothers Nyx and Myx have been corrupted by the Static. Answer the equations they throw at you, and round by round they turn from menacing to cute. Break the last shard in the boss round to purify a spirit, then befriend it as your companion.
- **Practice classroom:** you and your companion sit side by side, each with your own column of equations on the chalkboard. You both answer at your own pace. Your companion thinks out loud: its thought bubble shows real mental-math strategies step by step (count on, make ten, tens and ones…). When it's wrong, you can see where its reasoning slipped. It earns maths stars as you practise together. Pass a stage (9/12) and the next, harder one starts automatically; otherwise try again.

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173   (?log=debug verbose logs, ?gallery creature art)
npm test             # unit tests
npm run typecheck && npm run lint
npm run build        # production build → dist/
```

Requires Node 22+.

## Tools and technologies

### Language and runtime
| Tool | What it is | How we use it |
|---|---|---|
| **TypeScript** (~6.0) | JavaScript with static types | All app and test code. Strict settings (`noUnusedLocals`, `erasableSyntaxOnly`, `verbatimModuleSyntax`) in `tsconfig.app.json` |
| **Node.js** (22+) and **npm** | JavaScript runtime and package manager | Runs the dev server, build, tests and lint. Dependencies are pinned in `package-lock.json` |

### App framework and build
| Tool | What it is | How we use it |
|---|---|---|
| **React 19** | UI component library | All screens and game views. Games re-render every animation frame from a pure engine's state. `StrictMode` is on in dev |
| **Vite 8** + `@vitejs/plugin-react` | Dev server and bundler | Instant reload in dev and an optimised build in `dist/`. Also injects `__APP_VERSION__` from `package.json` (see `vite.config.ts`) |

### Libraries
| Tool | What it is | How we use it |
|---|---|---|
| **idb** | Small promise wrapper around IndexedDB | Talks to the browser database (`src/core/telemetry/storage.ts`) |
| **zod** | Schema validation | Validates content packs (e.g. worksheets) before they reach a game (`src/modules/math-monster/schema.ts`) |

### Browser platform APIs (no extra libraries)
| API | How we use it |
|---|---|
| **IndexedDB** | Stores profiles, sessions, telemetry events, content packs, per-player progress and diagnostics logs. The schema is versioned with step-by-step migrations |
| **localStorage** | Small per-device conveniences: last profile, per-player settings, log level |
| **Gamepad API** | Controller support, polled every animation frame (`src/core/input/InputManager.ts`) |
| **Pointer Events** | Touch, mouse and pen input, plus misclick detection (taps that hit nothing) |
| **Keyboard Events** | Keyboard play and menu navigation |
| **requestAnimationFrame** | Game loops and gamepad polling |
| **SVG + CSS animations** | All art is code: the hero, and procedurally drawn creatures (`Creature.tsx`). No image files |
| **Google Fonts** | The *Chakra Petch* typeface (loaded in `index.html`) |

### Testing and quality
| Tool | What it is | How we use it |
|---|---|---|
| **Vitest** | Test runner (Vite-native, Jest-compatible) | Unit tests for engines, problem generation, the companion's skill model, the classroom stages, telemetry, logging and storage migrations (`npm test`) |
| **fake-indexeddb** | In-memory IndexedDB for Node | Lets storage and migration tests run outside a browser |
| **oxlint** | Fast linter (Rust) | Code quality, plus React rules (`.oxlintrc.json`, `npm run lint`) |
| **tsc** | TypeScript compiler | Type-checking (`npm run typecheck`). Vite does the actual compiling |
| **Playwright (`playwright-core`)** + Microsoft Edge | Browser automation | Used *ad hoc*, outside the project's dependencies, to play through flows in a real headless browser (keyboard, touch, simulated gamepad) and take screenshots. In dev builds, tests can inspect `window.__funl.engine` and `window.__funlInput` |

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
| Input system | Turns keyboard, gamepad and touch into the same *actions*, with a control scheme per game |
| Telemetry | Records every play session's events for analysis |
| Logger | App diagnostics with levels, namespaces, persistence and error capture |
| Module registry | The contract every learning game implements, plus per-player settings and progress |
| Mental-math engine | How people actually calculate: 30 strategies (count on, make ten, tens and ones, columns…) that turn a problem into reasoning steps and notes, plus the typical slips that lead to wrong answers (`src/core/mental-math`, see [docs/MENTAL-MATH.md](docs/MENTAL-MATH.md)) |

## Documentation

| Doc | For |
|---|---|
| [AGENTS.md](AGENTS.md) | **Start here.** Repo map, rules, commands, how to keep docs current (people and AI agents) |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | UML/Mermaid diagrams: components, contracts, runtime sequence, navigation, storage ER |
| [docs/TELEMETRY.md](docs/TELEMETRY.md) | Data dictionary of every recorded event and summary field |
| [docs/LOGGING.md](docs/LOGGING.md) | Diagnostics logging: levels, namespaces, getting logs from a device |
| [docs/MENTAL-MATH.md](docs/MENTAL-MATH.md) | How the app models mental calculation: strategies, reasoning steps, notes, slips |
| [docs/modules/math-monster.md](docs/modules/math-monster.md) | Math Monster: modes, rules, the classroom and companion model, controls, packs |
| [docs/lore/WORLD.md](docs/lore/WORLD.md) | The world of Lumora, the spirits, writing rules |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Why things are the way they are |
| [PATCHNOTES.md](PATCHNOTES.md) | What changed in each version (game-style patch notes) |

## Status

- ✅ Shell: profiles, menus with controller navigation, per-player settings, results, data export, diagnostics
- ✅ Math Monster, Adventure: 10 stages + endless, 1–4 lanes, 5 speeds, worksheet packs
- ✅ Spirits: the moon-fox brothers Nyx & Myx (5 forms each), boss rounds, purification, befriend + companion, Spirit Journal
- ✅ Practice classroom: separate columns for you and your companion, asynchronous answers, staged difficulty with auto-advance and retries, companion maths mastery (0–5 stars)
- ✅ Mental-math reasoning: the companion's thought bubble works through real strategies step by step (with notes), and its mistakes come from visible slips in its reasoning
