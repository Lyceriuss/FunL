# Architecture

FunL is a client-only React + TypeScript single-page app built with Vite. All data lives in the browser's IndexedDB. A backend and an MCP server are planned; see the [last section](#mcp-and-backend-planned).

Contents: [Components](#1-component-overview) · [Core contracts (class diagram)](#2-core-contracts-class-diagram) · [Runtime flow (sequence)](#3-runtime-flow-one-answer-sequence-diagram) · [Navigation (state)](#4-app-navigation-state-diagram) · [Engine phases (state)](#5-engine-phases-math-monster) · [Storage (ER)](#6-storage-indexeddb-er-diagram) · [Input](#7-input-system) · [Telemetry vs logs](#8-telemetry-vs-logs) · [Adding a module](#adding-a-module) · [MCP plan](#mcp-and-backend-planned)

## 1. Component overview

```mermaid
flowchart TB
  subgraph Browser
    main[main.tsx<br/>bootstrap]
    subgraph Shell["Shell (src/App.tsx, src/screens)"]
      EB[ErrorBoundary]
      Router[Route state machine]
      Screens[Profiles · Home · Module · Results · Data]
    end
    subgraph Core["src/core"]
      Input[input<br/>InputManager + ControlScheme]
      Tele[telemetry<br/>TelemetrySession]
      Log[log<br/>LogHub + sinks]
      Mods[modules<br/>GameModule registry + settings]
      MM2[mental-math<br/>strategies · reasoning · slips]
      Aud[audio<br/>sfx · music · Sound panel]
      Pace[pace<br/>input time model · allowance]
      UI[ui<br/>Screen, ErrorBoundary]
      Store[(IndexedDB 'funl')]
    end
    subgraph Modules["src/modules"]
      MM[math-monster<br/>Engine · View · Schema]
      Next[future modules…]
    end
  end
  Devices[Keyboard · Gamepad · Touch/Mouse] --> Input
  main --> Log & Input & Shell
  Router --> Screens
  Router -- mounts --> MM
  Mods -- registry lists --> MM
  MM -- companion reasoning --> MM2
  MM -- sfx / music --> Aud
  MM -- input times / allowance --> Pace
  Shell -. menu music .-> Aud
  MM -- actions --> Input
  MM -- events --> Tele
  Input -- raw input --> Tele
  Tele --> Store
  Log --> Store
  Screens --> Store
  Shell & Core & MM -. diagnostics .-> Log
```

**Dependency rule:** `screens` and `modules` depend on `core`. `core` depends on nothing in `modules`, except `core/modules/registry.ts`, which lists them. Modules never import each other.

## 2. Core contracts (class diagram)

```mermaid
classDiagram
  direction LR

  class GameModule~Options~ {
    +id: string
    +title, subject, description, icon
    +controls: ControlScheme
    +presets: Preset~Options~[]
    +settings?: SettingDef[]
    +importPack?(raw) Options
    +presetsTitle?: string
    +Hub?(profileId, onStart)
    +Component: GameProps~Options~
  }
  class GameProps~Options~ {
    +profile: Profile
    +telemetry: TelemetrySession
    +options: Options
    +settings: Settings
    +onFinish(GameResult)
  }
  class ControlScheme {
    +id
    +keyboard: key → Action
    +gamepadButtons: index → Action
    +stickAsNav: bool
    +help: device → string[]
  }
  class InputManager {
    +attach() / detach()
    +setScheme(scheme)
    +onAction(fn) unsubscribe   «stack: newest listener only»
    +onRaw(fn) unsubscribe
    +dispatch(action, device, source)
    +lastDevice, gamepadId
  }
  class TelemetrySession {
    +id
    +record: SessionRecord
    +log(kind, data, device?)
    +captureInput(InputManager)
    +events()
    +flush()
    +end(summary, reason)
  }
  class TelemetrySink {
    <<interface>>
    +putSession(SessionRecord)
    +addEvents(TelemetryEvent[])
  }
  class LogHub {
    +level, console
    +logger(ns) Logger
    +setContext(values)
    +addSink(LogSink)
    +recent() LogEntry[]
  }
  class LogSink {
    <<interface>>
    +level
    +write(LogEntry)
  }

  GameModule --> ControlScheme
  GameModule ..> GameProps : Component receives
  GameProps --> TelemetrySession
  InputManager --> ControlScheme : active scheme
  TelemetrySession --> TelemetrySink
  TelemetrySession ..> InputManager : captures raw input
  TelemetrySink <|.. idbSink
  LogSink <|.. idbLogSink
  LogHub --> LogSink
```

Math Monster's internals follow the same pattern. See the class diagram in [modules/math-monster.md](modules/math-monster.md).

## 3. Runtime flow: one answer (sequence diagram)

```mermaid
sequenceDiagram
  autonumber
  actor Child
  participant IM as InputManager
  participant View as MathMonsterGame (React)
  participant Eng as MathMonsterEngine
  participant TS as TelemetrySession
  participant DB as IndexedDB

  Child->>IM: presses "7" (key / pad A on keypad / tap)
  IM->>TS: raw input {device, source, t, mapped}
  IM->>View: Action math.digit(7)
  View->>Eng: digit(7)
  Eng-->>View: event input.digit
  View->>TS: log("math.input.digit", …, device)
  Child->>IM: Enter / Y / tap ✓
  IM->>View: Action math.submit
  View->>Eng: submit()
  Eng->>Eng: match answer against active equations
  Eng-->>View: event answer.correct {responseMs, lane, points…}
  View->>TS: log("math.answer.correct", …)
  loop every animation frame
    View->>Eng: tick(dt)
    View->>View: render state (lanes, effects, HUD)
  end
  loop every 2 s and on end()
    TS->>DB: addEvents(batch)
  end
```

## 4. App navigation (state diagram)

```mermaid
stateDiagram-v2
  [*] --> loading
  loading --> home: last profile found
  loading --> profiles: no remembered profile
  profiles --> home: pick / create
  profiles --> data: 📊 Data
  data --> profiles: back
  home --> module: choose game
  home --> profiles: back
  module --> game: preset / worksheet (creates TelemetrySession)
  module --> home: back
  game --> results: onFinish (gameover · completed · quit) → session.end()
  results --> game: play again (new session)
  results --> module: done
```

Routes are a discriminated union in `App.tsx`. Every route change updates the log context (`route`, `moduleId`, `sessionId`).

## 5. Engine phases (Math Monster)

```mermaid
stateDiagram-v2
  [*] --> between: start() → level.start (intro)
  between --> playing: intro / K.O. delay elapsed
  playing --> playing: spawn · answer · timeout
  playing --> between: monster defeated → next level.start
  playing --> paused: pause()
  between --> paused: pause()
  paused --> playing: resume()
  paused --> between: resume()
  playing --> gameover: lives = 0
  playing --> complete: pack exhausted & nothing in flight
  gameover --> [*]
  complete --> [*]
```

## 6. Storage: IndexedDB (ER diagram)

Database `funl`, currently **version 3**. Migrations live in `core/telemetry/storage.ts` and are tested in `storage.test.ts`.

```mermaid
erDiagram
  PROFILES ||--o{ SESSIONS : plays
  PROFILES ||--o{ PROGRESS : has
  SESSIONS ||--o{ EVENTS : records
  PACKS }o--|| MODULE : "for (moduleId)"
  SESSIONS }o--|| MODULE : "of (moduleId)"

  PROFILES {
    string id PK
    string name
    string avatar
    number createdAt
  }
  SESSIONS {
    string id PK
    string profileId "index byProfile"
    string moduleId "index byModule"
    json config "options + settings used"
    number startedAt
    number endedAt
    json env "screen, touch, gamepad, UA, appVersion"
    json summary "module-computed"
  }
  EVENTS {
    number id PK "auto"
    string sessionId "index bySession"
    number t "ms since session start"
    number wall "epoch ms"
    string kind "see TELEMETRY.md"
    string device
    json data
  }
  PACKS {
    string id PK
    string moduleId "index byModule"
    string title
    json data "module format, zod-validated"
    string origin "paste, file, mcp"
    number createdAt
  }
  PROGRESS {
    string key PK "moduleId:profileId"
    string moduleId
    string profileId "index byProfile"
    json data "module format, versioned by the module"
    number updatedAt
  }
  LOGS {
    number id PK "auto"
    number t
    string level
    string ns
    string msg
    json data
    json ctx
  }
```

`MODULE` is not a store. It stands for the code-defined module referenced by `moduleId`.

Per-device conveniences go in `localStorage`: `funl.lastProfile`, `funl.settings.<moduleId>.<profileId>` and `funl.logLevel`.

## 7. Input system

- **Keyboard:** `KeyboardEvent.key` → action via the active `ControlScheme`. Auto-repeat only applies to `nav`.
- **Gamepad:** polled every frame. A button press edge → action. The left stick acts as a D-pad (when the scheme's `stickAsNav` is on), with repeat after 380 ms and then every 130 ms. Its raw position is also available as `input.stick()` (x, y, magnitude, angle) for analogue controls like the radial number dial. Assumes the standard mapping and logs a warning otherwise.
- **Touch, mouse and pen:** on-screen controls call `input.dispatch()`. A global `pointerdown` listener records every tap and whether it hit an interactive element (`[data-hit]`, a button, …). Misses become `input.miss` telemetry events.
- **Listener stack:** `onAction` delivers only to the most recent subscriber. Overlays like the pause menu capture input simply by mounting. Subscriptions, control schemes and initial menu focus are set in **layout effects**, before the first paint, so a press right after a screen appears isn't lost.
- **Frame budget:** the Gamepad API only exposes the *current* button state, polled once per frame. A press shorter than a frame is invisible, so keep menu frames cheap. SVG blur filters and looping animations are the usual culprits; use `CreatureArt lite` for static portraits. The poll loop reschedules itself before handling input, so a handler error can't stop polling.
- **Menus:** `useMenuNavigation` moves focus spatially between `[data-focusable]` elements. `[data-autofocus]` picks the initial focus.

## 8. Telemetry vs logs

| | Telemetry (`core/telemetry`) | Logs (`core/log`) |
|---|---|---|
| Question it answers | How did the child play and learn? | What did the app do, and why did it break? |
| Unit | `TelemetryEvent` within a session | `LogEntry` with level + namespace |
| Stored | `events` + `sessions` stores, always | `logs` store (info and above), memory ring buffer (everything) |
| Exported via | Data → Export JSON | Data → Download logs |
| Reference | [TELEMETRY.md](TELEMETRY.md) | [LOGGING.md](LOGGING.md) |

## Adding a module

1. Create `src/modules/<id>/` with:
   - `engine.ts`: pure logic, emits typed events, with tests in `__tests__/`.
   - `schema.ts`: zod schemas for content packs, if the module accepts content.
   - `controls.ts`: `extendScheme(baseScheme, …)`, with `help` text for every device.
   - `<Name>Game.tsx`: the view. Use `useControlScheme`, `useActions`, a `requestAnimationFrame` loop calling `engine.tick`, and forward engine events to `telemetry.log('<id>.<event>', …)`.
   - `index.ts`: exports the `GameModule` (presets, `settings`, `importPack`, `Component`).
2. Register it in `src/core/modules/registry.ts`.
3. Document it in `docs/modules/<id>.md`, add its events to `docs/TELEMETRY.md`, and update the repo map in `AGENTS.md`.

The shell provides menus, settings UI and persistence, profiles, session recording, results and data export at no extra cost. For long-lived per-player state (collections, unlocks) use `getProgress`/`saveProgress` from `core/telemetry/storage`. For a panel on the module screen, set `GameModule.Hub`. It receives `onStart(options)`, so it can launch sessions too (e.g. Math Monster's practice classroom).

## MCP and backend (planned)

To give AI assistants access, the app and an MCP server have to share data, so first:

1. **Backend sync:** a small API that implements `TelemetrySink` server-side and stores profiles, sessions, packs and logs. The browser keeps IndexedDB as an offline cache and syncs.
2. **MCP server** (`mcp/`, Node + `@modelcontextprotocol/sdk`), sharing the zod schemas from `src/modules/*/schema.ts`:

| Tool | Purpose |
|---|---|
| `list_modules` | modules, with their pack schemas (JSON Schema generated from zod) |
| `create_pack(moduleId, pack)` | validate with the module schema and store it (e.g. from a worksheet photo) |
| `grade_worksheet(profileId, items)` | record handwritten answers that the assistant read from a photo, in the same telemetry format |
| `get_progress(profileId)` | session summaries and per-fact stats (from `hardestFacts`, `byOp`), to plan practice |
