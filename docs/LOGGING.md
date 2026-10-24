# Logging

Diagnostics for developers and support. For player/learning data see [TELEMETRY.md](TELEMETRY.md).

## Use it

```ts
import { getLogger } from '../core/log/logger';
const log = getLogger('storage');          // one per file/area, at module top level

log.debug('cache miss', { key });          // noisy detail, dev only
log.info('pack imported', { title });      // lifecycle milestones
log.warn('gamepad non-standard mapping');  // unexpected but handled
log.error('flush failed', err);            // something failed; pass the Error (or { error: err, ...ctx })
```

- **Message:** a short, constant, lower-case phrase (`'session started'`, not `` `session ${id} started` ``). Put variables in the data object, so entries can be grouped and searched.
- **Data:** a plain object or an `Error`. Errors are serialized with name, message, stack (12 lines) and cause, including nested `{ error: err }`.
- **Never log** names, free text typed by users, or whole content packs. Log ids and counts instead.
- `log.child('sub')` gives the namespace `ns.sub`.

## Levels and where entries go

| Level | When | In-memory ring (500) | Console | IndexedDB `logs` |
|---|---|---|---|---|
| `debug` | detail for active debugging | ✔ if enabled | dev | ✘ |
| `info` | lifecycle: app start, session start/end, imports | ✔ | dev, or prod when level ≤ info | ✔ |
| `warn` | recoverable oddities | ✔ | ✔ | ✔ |
| `error` | failures, uncaught errors, render crashes | ✔ | ✔ | ✔ |

- The default level is `debug` in dev and `info` in production. Override it with `?log=debug|info|warn|error` in the URL; the choice is remembered in `localStorage.funl.logLevel`.
- Persisted logs are batched every 2 s and capped at 5000 entries (pruned at startup).
- Console output is off under Vitest.

## Context

Every entry carries `ctx`, set by the shell: `route`, `moduleId`, `sessionId` (during a game) and `profileId`. You don't need to repeat these in messages. To add a key, use `logs.setContext({ key: value })`; to remove it, set the value to `undefined`.

## Automatically captured

- Uncaught errors and unhandled promise rejections (`app` namespace, from `installGlobalErrorHandlers`).
- React render crashes (`ui`, from `ErrorBoundary`), which also show a recovery screen.
- IndexedDB open/upgrade/blocked/terminated (`storage`).
- Telemetry flush failures, with retry state (`telemetry`).
- Gamepad connect/disconnect and non-standard mappings (`input`).

## Namespaces in use

`app` · `ui` · `input` · `storage` · `telemetry` · `content` · `data` · `math-monster` · `math-monster.journal` · `math-monster.practice` · `math-monster.hub` · `audio` · `pace`

## Getting logs from a device

Data → Diagnostics → **Download logs** saves `funl-diagnostics-<time>.json`. It contains the persisted entries, the in-memory buffer (which includes debug entries when enabled), the app version and the user agent. The same screen lists the last 20 warnings and errors.
