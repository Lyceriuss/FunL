# Decision log

Short records of significant choices: why we did it and what we gave up. Add new entries at the bottom. Don't rewrite old ones; supersede them instead.

Format: **ID · date · title**, then Decision / Why / Trade-offs.

---

**D1 · 2026-10-16 · Web app (Vite + React + TypeScript)**
- Decision: a browser SPA, installable as a PWA later.
- Why: the browser natively supports touch, keyboard and the Gamepad API, and it runs on tablets, PCs and TVs with no app-store step.
- Trade-offs: no native performance or store presence. It can be wrapped later (Capacitor/Tauri) if needed.

**D2 · 2026-10-16 · Input as semantic actions with per-module control schemes**
- Decision: devices map to actions through a `ControlScheme`. Touch UI dispatches the same actions.
- Why: every game works on every device, and each module still gets bespoke bindings.
- Trade-offs: a module must think about all three devices for each interaction (on purpose).

**D3 · 2026-10-16 · Pure engines, view separate**
- Decision: game rules live in DOM-free classes driven by `tick(dt)`, with a seeded RNG and engine-time clocks.
- Why: testable, deterministic and reproducible from a session's `config`. Timings exclude pauses.
- Trade-offs: the view must derive animations from state (`effects`) instead of imperative calls.

**D4 · 2026-10-16 · Record everything locally in IndexedDB**
- Decision: a `TelemetrySession` logs raw input plus semantic game events and batches writes to IndexedDB. `TelemetrySink` is an interface.
- Why: data is needed for later analysis (speed, misclicks, per-fact fluency), and offline works by default.
- Trade-offs: data is per device until a backend sync exists (see the ARCHITECTURE MCP plan).

**D5 · 2026-10-16 · zod-validated content packs as the MCP target**
- Decision: modules accept JSON packs validated by their own zod schema.
- Why: one boundary for anything external (paste, file, future MCP from worksheet photos). The schemas can produce JSON Schema for tool definitions.

**D6 · 2026-10-16 · Multiple equations in lanes; answer hits whatever it solves**
- Decision: 1–4 simultaneous equations, no explicit targeting.
- Why: the user asked for several at once. Answer-matching needs no extra input and works the same on every device. Telemetry records `frontmost` and `concurrent` to study triage.
- Trade-offs: two equations with the same answer are ambiguous, so the most dangerous one wins.

**D7 · 2026-10-16 · Older-kid anime aesthetic**
- Decision: a dark neon battlefield, cel-shaded SVG characters and angled HUD panels. Chakra Petch font.
- Why: feedback that the first, bright, young-child style was too babyish. Kids want what older kids like.
- Trade-offs: hand-made SVG limits art quality. Commissioned or generated sprites can replace `Art.tsx` without engine changes. The font loads from Google Fonts and needs to be self-hosted for offline use.

**D8 · 2026-10-19 · Separate diagnostics logging from telemetry**
- Decision: `core/log` with levels, namespaces, context, a ring buffer, an IndexedDB sink (info and above), global error capture and an ErrorBoundary.
- Why: play data and app health have different audiences, lifetimes and privacy needs. Before this, storage failures were silently dropped.
- Trade-offs: two similar-looking systems. [ARCHITECTURE §8](ARCHITECTURE.md#8-telemetry-vs-logs) explains when to use which.

**D9 · 2026-10-19 · Docs-as-context (AGENTS.md + Mermaid)**
- Decision: AGENTS.md is the single entry point, CLAUDE.md imports it, diagrams are Mermaid in Markdown, and docs are updated in the same change as code.
- Why: humans and AI agents both need durable context, and text diagrams stay diffable and editable.

**D10 · 2026-10-19 · Spirits: 5-round encounters, boss = shard, befriend after purification**
- Decision: each creature is fought over 5 rounds (forms 0–4, menacing → cute). Round 5 is a boss in the cutest form still carrying a Static shard, and breaking it purifies the spirit, which can then be befriended as a companion.
- Why: the user wants creatures that turn cuter as you beat them, a final boss round that makes them cuter still, and the option to befriend one for the journey. The story ("you are freeing them, not hurting them") is kind and motivating for children.
- Trade-offs: the true form appears in battle (round 5) before purification. The shard crown and boss ring keep it visibly "not free yet". Encounters are layered over the existing difficulty curve (5 levels each) rather than replacing it, so difficulty and story stay independent.

**D11 · 2026-10-19 · Procedural creature art**
- Decision: one parametric SVG renderer (`Creature.tsx`), where `form` drives every feature and each species adds its own parts.
- Why: 5 spirits × 5 forms = 25 designs. Procedural art keeps them consistent, cheap to iterate (`?gallery`) and easy to extend. The user accepted lower-fidelity art while the gameplay loop matures.
- Trade-offs: less character than hand-drawn art. The `CreatureArt` component boundary lets illustrated sprites replace it later without engine or view changes.

**D12 · 2026-10-19 · Patch notes and a single version source**
- Decision: `PATCHNOTES.md` (game-style, named minor updates) is updated with every change. `package.json` is the only version source, injected as `__APP_VERSION__`.
- Why: the user wants a running history "like video game development", and agents need it as context. A single version source stops logs, telemetry and notes from drifting apart.

**D13 · 2026-10-19 · Focus on two spirits: the moon-fox brothers**
- Decision: the active roster is Nyx (little brother) and Myx (big brother). The other three are moved to `SHELVED_CREATURES`, not deleted.
- Why: the user liked the first creature and wants depth over breadth. A sibling pair gives a stronger story hook (Myx went looking for Nyx).
- Trade-offs: an encounter cycle is now 2 spirits long, so rematches come sooner.

**D14 · 2026-10-19 · Practice mode with an imperfect companion**
- Decision: a classroom mode (unlocked by befriending) where the companion answers the same equations using a seeded skill model. Mastery = completed 12-question lessons, capped at 5, at which point it is perfect at Normal speed with Auto lanes.
- Why: gives the befriended spirit a purpose, and turns practice into "teaching your friend", which motivates without lives or game over. Making the companion a believable learner (mistakes, 😢) makes the child's own mistakes feel normal.
- Detail: whether the companion *finishes* comes from the model (think time vs. the equation's travel time), but its answer is *shown* shortly after the player's (0.4–1.3 s). Waiting for the full modelled think time (up to about 12 s) made the companion's bubble lag far behind the player's.
- Trade-offs: mastery is global per companion, not per topic. Per-topic mastery is a possible later refinement.

**D15 · 2026-10-19 · Classroom v2: separate columns, asynchronous companion, staged difficulty**
- Decision: the companion gets its own equation stream (a second engine, ticked in the same frame loop) and answers on its own clock via `answerFor`. The board splits into two columns. Practice is a ladder of 12-equation stages (pass at 9/12) that auto-advances on a pass and offers retries.
- Why: the user wanted the player and companion decoupled, two floating columns, and a classroom that lets you try again and raises difficulty automatically. A second engine reuses all the lane, timing and telemetry logic, so there is no separate bot simulation to maintain.
- Trade-offs: a stage ends only when both columns are done, so a fast player may wait briefly for the companion ("Waiting for Nyx…"). Mastery still rises per finished stage, pass or fail, so 5 stages (~5 lessons) master the companion. The lanes setting is ignored in practice (the stage decides). Supersedes D14's "answer shortly after the player" reveal rule.

**D16 · 2026-10-19 · Mental-math reasoning as a core module**
- Decision: `core/mental-math` models calculation as strategies → reasoning steps (with notes), each with typical slips. The companion's answers (and mistakes) come from it, and its bubble shows the steps.
- Why: the goal is to teach *how* to calculate (3 + 6 + 4 as 6 + 4 = 10, + 3), and the practice classroom is where children watch it happen. Wrong answers must be reproduced with the wrong logic, so mistakes are slips inside a strategy, not random numbers. It's in core because hints, other modules and the MCP/worksheet tooling (diagnosing which misconception a child's written answer shows) will reuse it.
- Design: correctness is still decided by the calibrated mastery model (so ★5 stays perfect), while *how* it is right or wrong comes from `think()`. Strategy choice is tiered by proficiency (counting → facts → fluent), so the companion visibly matures. Steps are structured (`calc` with terms and result), which makes them testable: unmarked calculations must be true.
- Trade-offs: the companion now works on one equation at a time and rests to let the bubble be read, so it finishes fewer equations in quick 2-lane stages. Labels are English-only for now.

**D17 · 2026-10-19 · Radial dial for controllers**
- Decision: with a controller, numbers are entered on a radial dial (0–9 in a circle). The left stick points, the D-pad turns, A types, X deletes, Y sends. The stick is taken off menu-style navigation in-game.
- Why: moving a cursor around a 3×4 keypad with a D-pad took many presses per digit. Pointing the stick at a number is one motion. User request: "a 360 select number with joystick".
- Trade-offs: the input layer now exposes analogue state (`stick()`), not only discrete actions, so a module can read the stick directly. Stick movement itself isn't logged as telemetry (button presses are).

**D18 · 2026-10-19 · Player-resettable progress**
- Decision: "Reset progress" on the module screen deletes the module's progress record (befriended spirits, companion, mastery, classroom stages), with an in-page two-step confirm. Sessions and telemetry are kept.
- Why: the user wants to replay Adventure from the start and see practice locked again. The play history stays useful for analysis.

**D19 · 2026-10-19 · Knockback on correct answers**
- Decision: a correct answer pushes all other in-flight equations back by 0.18 of the lane, as a short slide during which they don't advance.
- Why: in multi-lane play, one slow moment could snowball into losing several lives. Rewarding each correct answer with breathing room lets children recover ("claw your way back") and makes speed feel powerful.
- Trade-offs: multi-lane play is easier overall. The amount is one engine option (`knockback`) if it needs tuning, and wrong answers still push the front equation forward.

**D20 · 2026-10-19 · More lives, refilled per round; gentler boss**
- Decision: 5 lives, refilled at every new round. Boss rounds get 1.3× HP and no extra lane.
- Why: feedback that lives didn't refresh between stages and the final round was too hard for a child. Each round should be a fresh, winnable challenge. The boss's drama comes from the shard, music and HP, not from extra lanes.

**D21 · 2026-10-19 · Synthesised, mood-tagged sound library with a chooser**
- Decision: all audio is generated with Web Audio (no files). Every game moment is a slot with several mood-tagged variants, music is a set of generative loops per place, and a Sound panel (menu + pause) lets adults audition and choose.
- Why: the goal is to use sound to shape emotion, and the right choices need trying by feel. Synthesis keeps the build small and avoids licensing. Gentle defaults keep mistakes from feeling punishing.
- Trade-offs: synthesised sounds are simpler than produced audio, but the slot/variant model means recorded sounds can be added as variants later. Browsers only start audio after a user gesture, and a controller press alone may not count, so the first sound may wait for a tap or key press.

**D22 · 2026-10-19 · Controller-only menus as a rule**
- Decision: every menu must be completable with only a controller. Hence an on-screen keyboard for names, in-page confirms instead of `window.confirm`, and a strong gamepad focus style. An automated controller-only playthrough covers the full flow.

**D23 · 2026-10-24 · Separate input time from think time; adapt travel time to input pace**
- Decision: measure input time from the first input movement (controller stick, any button, key or tap) to the answer. Learn a per-player model per device and answer length (median of recent answers, outliers rejected, device defaults first). Add `(expected − keyboard default) × 1.25` (0–8 s) to each equation's travel time.
- Why: on some devices, especially the controller dial, entering the answer took longer than thinking of it, and equations were lost to slow *input*. The curve was tuned for keyboard, so keyboard players stay the same and others get exactly what they need.
- Trade-offs: the allowance is based on the device in use when an equation appears (switching device mid-equation isn't re-timed). Only slower-than-keyboard input is compensated; a fast typist doesn't get less time. The Speed setting is the way to make it harder.

**D24 · 2026-10-24 · Maze Duel: two mirrored mazes that meet only at the gate**
- Decision: the board is mirror-symmetric with a solid middle column (only the gate is open), so each side has its own maze. Interaction is the race itself plus stones (3 each), which may not seal a side off completely or go next to the gate. A duel that reaches 140 pieces is a draw.
- Why: with a shared middle, both sides often needed the same corridor into the gate. Since "you may not seal the other side off" forbade either from taking it, AI-against-AI simulations ended in standoffs (5 of 30 boards). Separate mazes remove that whole class of deadlock. A 30-board AI-against-AI test now finishes every duel.
- Trade-offs: paths can't block each other directly; only stones interfere. Other ways to interfere (e.g. twisting an operator square on the rival's side) can be added later as new piece types.

**D25 · 2026-10-24 · Shared game pieces live in `core/`**
- Decision: before Maze Duel, number entry (keypad, dial, dock), the pause menu, the heroine, the thought bubble and the maths problem code moved from `math-monster` into `core/math` and `core/ui`. Modules use them from there.
- Why: modules must not import each other (rule 1), and copying code would let the two games drift apart (e.g. the controller dial behaving differently).
- Trade-offs: the shared CSS keeps its `mm-` class names to avoid touching every Math Monster view; new shared pieces use neutral names (`think-bubble`).

**D26 · 2026-10-24 · Rivals and companions think with the same brain, at the player's pace**
- Decision: Glitch's answers come from `core/mental-math` `think()` (proficiency by difficulty), shown step by step in the shared thought bubble. Its think time also gets the player's input-pace allowance.
- Why: children learn from seeing *how* someone calculates and where the reasoning slips. The allowance keeps the race about maths, not about whether you're on a controller dial or a keyboard.
- Trade-offs: on Hard, Glitch can still be faster than a young child. Easy is the default.

**D27 · 2026-10-24 · Forge puzzles: use every piece, prefer puzzles with a trap**
- Decision: a Forge puzzle gives a target and a set of pieces, and **all** pieces must be used, so the only question is the order (and where the brackets go). From level 2 on, the generator prefers puzzles with a *trap*: an arrangement that makes the target when read left to right with no rules, but not with the real order of operations. Every puzzle must have at least two different results across arrangements.
- Why: the order of operations is only learned when ignoring it gives a believable wrong answer. "Use every piece" keeps one clear goal and makes checking simple, and traps are exactly what the companion's left-to-right slip falls into, so children see the mistake made and explained.
- Trade-offs: a few puzzles have several solutions (any is accepted). The search over arrangements costs about 1–2 ms per puzzle.

**D28 · 2026-10-24 · The Forge lives in the Adventure (boss rounds) and the classroom, not in a separate module**
- Decision: forge puzzles are a boss-round type in Math Monster's Adventure (3 seals break the shard, a gentle charge bar costs a life but never the puzzle) and a classroom practice mode. Maze Duel stays as a separate module for now. The puzzle itself is a core kit, so other games can bring it into a shared adventure later.
- Why: the user wants one overarching adventure with each kind of maths encountered there and practised in the classroom, rather than separate games side by side.
- Trade-offs: the Adventure engine now has two round types. Forge rounds don't use the speed setting's lanes, only its pace (the charge time is divided by the speed setting).

**D29 · 2026-10-24 · Menu navigation ranks by edge distance, row/column first**
- Decision: `moveFocus` picks, among items whose centre lies in the pressed direction, those in the same row (left/right) or column (up/down) first, ranked by the gap between edges.
- Why: ranking by centres skipped wide cards right below a small one (the classroom "Continue" and "Forge practice" cards) and sent "right" along the top bar into the content.

**D30 · 2026-11-02 · The Forge workshop has its own ladder of levels to unlock**
- Decision: Forge practice is a ladder of 6 levels, separate from the equation classroom stages. A lesson is 8 puzzles at one level; 6 clean puzzles (within 2 tries, no hint) pass it and unlock the next level. It replaces v0.12's adaptive tier, which changed level inside a lesson. Open to everyone; the companion joins when there is one. The lesson ends when the child finishes.
- Why: the user wants to "progress on both separately" with visible unlocks, and to reach the Forge in practice before having a companion. A fixed level per lesson makes progress clear and lets children replay a level they like.
- Trade-offs: no automatic step down within a lesson; a struggling child replays the level (hints still help). Old saves are mapped onto the new levels.

**D31 · 2026-11-02 · The Game map draws the docs' diagrams in the app**
- Decision: an in-app 🗺️ Game map renders the Mermaid diagrams from `docs/` (imported as raw Markdown) with Mermaid 11, loaded only when the screen opens (`React.lazy` + dynamic import).
- Why: the user wants to understand the game's structure from inside the app. Reading the docs keeps one source of truth, so the map can't drift from the documentation.
- Trade-offs: Mermaid is large (≈1.5 MB of lazily loaded chunks) and brings KaTeX, which `npm audit` flags as low severity; only our own diagrams are rendered, with Mermaid's strict security level.

**D32 · 2026-11-02 · The UML viewer is a dev tool, not part of the game (replaces D31)**
- Decision: the diagram browser is a standalone Vite page in `tools/uml/` (`npm run uml`, port 5174) that renders every Mermaid block in `docs/`. The in-game Game map from v0.13 is removed; Mermaid is a dev dependency only.
- Why: the user wanted a tool for people working on the game, outside the game itself. Keeping it out of the app also keeps Mermaid (and its KaTeX audit warning) out of the game bundle.
- Trade-offs: children and parents don't see the diagrams; the viewer needs the repo and `npm install`.

**D33 · 2026-11-02 · Module screens: mode cards + a settings bar**
- Decision: the module contract gains optional `modes` and `extras`. Math Monster opens on two big cards (Adventure, Practice); each mode shows only its own settings and starting points; journal, progress, worksheets and controls sit in a settings bar. B goes up one page; the page is remembered per tab so "Done" after a game returns to it.
- Why: the single long page (settings, presets, classroom, forge, journal, progress, worksheets, controls) was cluttered, especially with a controller.
- Trade-offs: one more press to start a game. Settings shared by several modes (e.g. Input time help) appear only where they matter most (Adventure) but still apply everywhere.

**D34 · 2026-11-02 · Diagrams are collected into the README and docs/DIAGRAMS.md (replaces D32)**
- Decision: no diagram viewer at all, in or outside the game. `scripts/diagrams.mjs` (`npm run diagrams`) draws every Mermaid block in `docs/` as an SVG in `docs/diagrams/` (Mermaid in headless Edge/Chrome via `playwright-core`, plain SVG text, dark background) and writes `docs/DIAGRAMS.md` (grouped by doc, contents list, kind labels, link back to the source heading) plus the big-picture image and a list of all diagrams in the README between markers.
- Why: the user wanted the diagrams in or close to the README, in the viewer's grouped format, not as something to load or run. Images, unlike Mermaid blocks, show in VS Code's built-in preview without an extension (and on GitHub).
- Trade-offs: generated SVGs are committed (~0.8 MB) and must be regenerated after a diagram edit; each SVG carries a hash of its source, so a unit test catches stale images without a browser. Drawing needs Edge or Chrome installed. Not using `@mermaid-js/mermaid-cli`, which downloads its own Chromium.

**D35 · 2026-11-02 · Adventure world map, fixed worlds, Practice blocks**
- Decision: Adventure opens on a node map (a classic console world map in layout, not art): World 1 = levels 1–5 with Nyx, World 2 = 6–10 with Myx, then Endless. Nodes open one by one as levels are cleared (`adventure.cleared` in progress), but every world's first node is always open. Encounters are aligned to worlds (`encounterOrigin: 1`), so a world always has the same spirit and its boss on round 5. Practice opens on two blocks (Classroom, Forge workshop) that each open their own page with a stage/level map. The map component is shared (`core/ui/PathMap`), and mode panels gained sub-pages.
- Why: players couldn't tell where they were in the adventure, and the Practice page mixed two ladders with chips and long texts. A map shows progress and the next step at a glance, and the D-pad moves along it naturally.
- Trade-offs: levels inside a world are now locked until reached (before, presets could start at levels 1, 5, 6 or 8); world gates keep skipping ahead possible. Old saves get world credit only for purified spirits. In Adventure, `encounter` in telemetry means the world, not the count since the session's start. The details panel's ▶ Play is for touch and mouse only (controller players press A on the node), so it is not `data-focusable`.

**D36 · 2026-11-02 · Custom challenges reuse the existing games**
- Decision: a third Math Monster mode, **Custom**, where a grown-up builds a challenge of 2–10 stages per player. Each stage is a battle, a boss fight, a Forge lesson or a classroom lesson at a chosen difficulty, played through the existing game views (`ChallengeGame` wraps them and records the result). It is stored as its own zod-validated progress record (`math-monster.challenges`) and played on the shared PathMap.
- Why: the user wanted to give a child "a challenge to overcome for the day" without changing Adventure. Reusing the games keeps one implementation per game type (and the new engine option `endLevel` is the only rule change). A schema-checked record is also what a future MCP tool can write.
- Trade-offs: a challenge lives inside Math Monster, so Maze Duel can't be a stage (modules stay isolated). Fights in a challenge have no story effects (no purifying or befriending), while Forge and classroom lessons still unlock their ladders. Stages always open in order. A challenge is saved per player and isn't copied to other players. A classroom stage needs a companion.
