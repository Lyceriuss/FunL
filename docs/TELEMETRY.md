# Telemetry data dictionary

Every play session produces one **session record** and a stream of **events**. They are stored in IndexedDB (`sessions`, `events`) and exported via Data → Export JSON as `{ exportedAt, profiles[], progress[], sessions[{...record, events[]}] }`. `progress` holds long-lived per-player module state (see the bottom of this page).

> Rule: if you add or change an event, update this file in the same change.

## Event envelope

| Field | Type | Meaning |
|---|---|---|
| `id` | number | auto-increment key |
| `sessionId` | string | owning session |
| `t` | number | ms since session start, 0.1 ms precision. Derived from `performance.now()`, so it is monotonic |
| `wall` | number | epoch ms, for ordering across sessions |
| `kind` | string | event type, namespaced (below) |
| `device` | `keyboard` · `gamepad` · `touch` · `mouse` · `pen` | input device responsible. For module events this is the device of the most recent action |
| `data` | object | kind-specific payload |

## Session record

| Field | Meaning |
|---|---|
| `id`, `profileId`, `moduleId` | identity |
| `config` | `{ options, settings }`: the exact preset, pack or practice topic and settings used. `options.mode` is `adventure` · `pack` · `practice`. ⚠️ Before v0.4.0, `practice` meant what is now `adventure`. From v0.5.0, practice options carry `stage` instead of `startLevel` |
| `startedAt`, `endedAt` | epoch ms. `endedAt` is missing if the tab was closed mid-game |
| `env` | `userAgent`, `screen {w,h,dpr}`, `touch`, `gamepad` (id or null), `appVersion` |
| `summary` | module-computed summary, written at the end (see below) |

## Shell events (all modules)

| kind | data | Notes |
|---|---|---|
| `session.start` | `{}` | |
| `session.end` | `reason`: `completed` · `gameover` · `quit` | |
| `input.raw` | `source`, `mapped: true`, and for pointers also `x`, `y`, `target` | Every key/button/tap that did something. `source` examples: `Key:7`, `Pad:0`, `Stick:left`, `Pointer` |
| `input.miss` | same as `input.raw`, with `mapped: false` | Unmapped key, or a tap that hit no interactive element: **misclicks** |

`target` for pointers is the element's `data-hit` id (e.g. `key-7`, `key-fire`, `pause`), else the tag or class name.

## Math Monster (`math.*`)

Times are **engine ms** (they stop while paused). `key` is a stable fact id such as `7×8`, `12÷3` or `3+6+4` (three-number sums). `lane` is 0-based. `concurrent` is the number of equations in flight at that moment. `progress` runs 0 → 1, where 1 means the equation reached the hero.

| kind | data |
|---|---|
| `math.level.start` | `level`, `name`, `hitsToDefeat`, `lanes`, `travelMs`, `encounter` (0-based; in Adventure the world of the map, 0 = levels 1–5, since v0.15), `round` (1–5), `boss`. Emitted when the round is *scheduled* (at the previous K.O.), before its intro |
| `math.problem.spawn` | `id` (equation instance, unique per session), `key`, `text`, `answer`, `level`, `travelMs` (includes the allowance), `allowanceMs` (extra time for the player's input pace), `lane`, `concurrent` |
| `math.input.start` | `at`: the player started entering an answer (first stick movement, controller button, key or tap). Input time is measured from here |
| `math.input.digit` | `digit`, `value` (input after the keypress) |
| `math.input.backspace` | `value` |
| `math.input.rejected` | `reason`: `too-long` · `empty-submit` · `no-problem` |
| `math.answer.correct` | `id`, `key`, `answer`, `responseMs` (spawn → submit), `firstInputMs` (spawn → first input movement for this answer: think time), `typingMs` (input time: first input movement → submit; from v0.10 the first movement includes stick movement), `digits`, `keystrokes`, `backspaces`, `wrongAnswers[]` (earlier wrong tries that hit this equation), `progress`, `points`, `streak`, `lane`, `concurrent`, `frontmost` (true if it was the most dangerous equation), `pushedBack` (other equations knocked back by this answer) |
| `math.answer.wrong` | `id` (of the front equation), `given`, `key`/`answer` of the **front** equation (which receives the penalty), `activeKeys[]` (all on screen, most dangerous first), `responseMs`, `typingMs` (input time), `digits` (of the given answer), `keystrokes`, `backspaces`, `progress` (after penalty) |
| `math.problem.timeout` | `id`, `key`, `answer`, `partialInput`, `wrongAnswers[]`, `lane`, `concurrent` |
| `math.life.lost` | `lives` remaining (not emitted in practice) |
| `math.lives.refill` | `lives` (now full), `restored`. Emitted when a new round starts with lives missing |
| `math.monster.defeated` | `level`, `encounter`, `round`, `boss` |
| `math.game.pause` | `reason`: `player` (pause button/key) · `hidden` (tab hidden) · `story` (befriend dialog) |
| `math.game.resume` | `{}` |
| `math.spirit.encounter` | `creatureId`, `form` (0–4), `round`, `boss`, `encounter`. Logged on the round's first equation, i.e. when the spirit is actually seen |
| `math.spirit.purified` | `creatureId`, `encounter` |
| `math.spirit.befriend` | `creatureId`, `accepted` (true = became companion) |
| `math.practice.stage.start` | Practice: `stage`, `topic`, `pace` (calm/quick), `level`, `speedFactor`, `lanes`, `companionId`, `mastery`. Player `math.*` events that follow belong to this stage (equation `id`s restart per stage) |
| `math.practice.companion` | Practice: the companion answered (or ran out of time on) **its own** equation `id` (from the companion's engine). Fields: `key`, `companionId`, `mastery`, `outcome` (right · wrong · unsure), `attempted` (false = it never got to it), `answer` (null if unsure), `correct`, `strategy` (mental-math strategy id, e.g. `ten-pair`), `slip` (slip id when wrong, e.g. `forgot-term`), `steps` (reasoning length), `thinkMs` |
| `math.practice.stage.end` | Practice: `stage`, `passed`, `playerCorrect`, `length`, `petCorrect`, `petWrong`, `petUnfinished`, `companionId`, `masteryBefore`, `masteryAfter`, `unlocked` (highest stage now unlocked). Replaces `math.practice.mastery` (v0.4.0 only) |
| `math.game.over` / `math.game.complete` | `score`, `level` |

### Forge events (`math.forge.*`)

Forge boss rounds (Adventure) and Forge practice (classroom). `id` is the puzzle instance (practice: puzzle number 1–8). Piece texts use `+ − × ÷ ( )`.

| Kind | Data |
|---|---|
| `math.forge.start` | `id`, `key` (intended solution, e.g. `(2+3)×4`), `target`, `tier` (1–4), `pieces`. Adventure adds `chargeMs` (incl.) and `allowanceMs` (extra for the player's input pace) |
| `math.forge.move` | a piece moved: `id`, `move` (pick · place · return · cancel), `piece`, `from` (pick: tray/row), `gap` (place), `row` (Adventure: the row as text; practice: its length) |
| `math.forge.check` | `id`, `key`, `status` (incomplete · invalid · wrong · right), `value` (what the row makes), `text` (the row), `error` (invalid: code such as `two-numbers`, `two-ops`, `bracket-open`, `ends-with-op`), `tries` (complete checks so far), `ms` (since the puzzle appeared). Adventure adds `charge` (0–1) |
| `math.forge.sealed` | `id`, `key`, `target`, `tier`, `tries`, `ms`. Adventure: `charge`, `chargesLost`, `points`; practice: `hinted` |
| `math.forge.charge` | Adventure: the spirit's charge filled (a life is lost; `math.life.lost` follows): `id`, `key` |
| `math.forge.tap` | touch/mouse on the board: `kind` (take · drop · stash · check), `piece` / `gap` |
| `math.forge.practice.start` | `tier` (Forge level 1–6), `length`, `passAt` (clean puzzles needed), `mastery` and `companionId` (null when practising alone) |
| `math.forge.hint` | `id`, `key`, `hint` (after 2 wrong tries) |
| `math.forge.companion` | the companion answered its puzzle `no`: `key`, `tier`, `outcome` (right · wrong), `strategy`, `slip` (`left-to-right` · `close-enough` · null), `text` (its arrangement), `claimed` (what it believes it makes), `actual`, `thinkMs` |
| `math.forge.practice.end` | `tier`, `sealed`, `clean` (within 2 tries, no hint), `passed`, `length`, `petRight`, `petWrong` (null when alone), `ms`. Since v0.13 the lesson ends when the player finishes |
| `math.forge.unlock` | `level`: a passed lesson unlocked a new Forge level |

### Math Monster session summary

| Field | Meaning |
|---|---|
| `score`, `levelReached`, `bestStreak`, `playMs` | headline numbers (`playMs` excludes pauses) |
| `correct`, `wrongAnswers`, `timeouts` | counts |
| `accuracy` | correct / (correct + wrong + timeouts), or null |
| `medianResponseMs`, `medianFirstInputMs` | over correct answers |
| `byOp` | per operator: `{ attempts, correct, medianMs }` |
| `hardestFacts[]` | up to 6 facts that were missed, answered wrong first, or slower than max(1.75 × own median, 3 s): `{ key, ms, missed }` |
| `misinputs` | `missedTaps`, `unmappedKeys`, `emptySubmits`, `backspaces` |
| `inputPace` | on the device used most: `device`, `medianInputMs`, `medianMsPerDigit`, `answers` |

Adventure sessions with Forge rounds add `summary.forge`: `{ sealed, medianMs, firstTry, byTier: { [tier]: { sealed, medianMs, medianTries } } }`. Forge workshop sessions have `summary.forgePractice`: `{ lessons: [{ tier, sealed, clean, passed, ms, petRight, petWrong }], sealed, clean, hinted, levelsPassed, medianMs, companion, puzzles: [{ key, tier, target, tries, ms, hinted }] }` and `playMs`.

Practice sessions add `summary.practice`: `{ companionId, stagesPlayed, stagesCleared, highestStage, unlocked, masteryAfter, companionCorrect, companionAnswered, stages: [{ stage, topic, pace, length, completed, passed, playerCorrect, playerWrong, playerTimeouts, petCorrect, petWrong, petUnfinished, masteryBefore, masteryAfter, score, bestStreak, playMs, level }] }`. The top-level summary fields cover all stages together.

### Input pace record (`progress` store, key `input-pace:<profileId>`)

`{ version: 1, samples: { [device]: { "1" | "2" | "3" | "4": number[] } } }`: the last 15 accepted input times (ms) per device and answer length. See docs/INPUT-PACE.md.

### Math Monster progress record (`progress` store, key `math-monster:<profileId>`)

`{ version: 1, spirits: { [creatureId]: { encountered, bestForm, purifiedAt?, mastery? } }, companion: creatureId | null, classroom?: { unlocked, forgeTier? }, adventure?: { cleared } }`. `adventure.cleared` is the furthest Adventure level (world map node) cleared (v0.15; older saves: 5 per purified spirit). `classroom.forgeUnlocked` is the highest Forge workshop level unlocked (1–6). (`classroom.forgeTier` from v0.12 is read once and mapped: 1→1, 2→2, 3→4, 4→5.) `classroom.unlocked` is the highest practice stage the player may start. `mastery` is the number of completed practice lessons (0–5).

## Maze Duel (`duel.*`)

Times are engine time from the start of the duel (pauses excluded). Cells are numbered `y × 9 + x` (`x` 0–8 left → right, `y` 0–6 top → bottom).

| Kind | Data |
|---|---|
| `duel.start` | `seed` (board + equations), `target`, `shortest` (squares in the shortest route), `rival` (easy · medium · hard) |
| `duel.problem.show` | your equation: `id`, `key`, `text`, `answer` |
| `duel.input.start` | `id`: you started entering (first stick movement, button, key or tap) |
| `duel.input.digit` / `duel.input.backspace` | `digit`, `value` (input so far) |
| `duel.answer.correct` / `duel.answer.wrong` | `id`, `key`, `text`, `answer`, `given`, `responseMs` (shown → submit), `firstInputMs` (think time), `typingMs` (input time), `digits` |
| `duel.answer.empty` | submit with nothing typed |
| `duel.mode` | `mode`: you switched build ↔ block |
| `duel.move` | a piece was played: `who` (you · rival), `kind` (build · block · back), `cell`, `x`, `y`, `value` (that side's number after the move), `tile` (e.g. `×2`, `open`, `gate`), `good` (builds: a route to the gate still exists) |
| `duel.move.denied` | `who`, `reason` (e.g. block mode without stones) |
| `duel.tap` | `cell`: a touch/mouse tap on a highlighted square |
| `duel.rival.think` | Glitch starts an equation: `id`, `key`, `strategy` (mental-math strategy id), `thinkMs` (incl. your input-pace allowance) |
| `duel.rival.answer` | `id`, `key`, `answer`, `given`, `correct`, `strategy`, `slip` (slip id when wrong), `thinkMs` |
| `duel.pause` / `duel.resume` | `reason` (player · hidden) |
| `duel.game.end` | `result` (won · lost · draw), `moves` (pieces played by both), `timeMs` |

### Maze Duel session summary

`result`, `rival`, `topic`, `board` (`seed`, `target`, `shortest`), `durationMs`, `answers`, `correct`, `wrong`, `accuracy`, `medianResponseMs`, `medianThinkMs`, `medianInputMs` (over correct answers), `you` and `glitch` (`pathLength`, `value`, `builds`, `blocks`, `backs`; Glitch also `answers`, `correct`), `wrongFacts[]` (`key`, `given`, `answer`), `device`.

### Maze Duel record (`progress` store, key `maze-duel:<profileId>`)

`{ version: 1, record: { easy | medium | hard: { won, lost, draw } }, bestWinAnswers: number | null }`: results against Glitch per difficulty, and the fewest correct answers it took to win.

## Useful derived metrics

- **Fluency per fact:** group `math.answer.correct` by `key` and look at the median `responseMs` and `firstInputMs` over sessions.
- **Hesitation vs motor time:** `firstInputMs` is think time and `typingMs` is entry time. A slow `typingMs` with many `backspaces` points to input trouble, not a maths gap.
- **Triage under pressure:** the share of `frontmost: true` when `concurrent > 1`.
- **Misclick rate:** `input.miss` (source `Pointer`) ÷ all pointer events, plus the x/y heat map.
- **Device effects:** compare the metrics above by `device`.
- **Motivation:** time and accuracy per `round`. Do children speed up as the spirit gets cuter, or near the boss? Also the share of `math.spirit.befriend` with `accepted: true`.

## Privacy

Profiles hold only a first name and an emoji avatar. No other personal data is collected. Exports (`funl-export-*.json`) are git-ignored. Treat them as children's data.
