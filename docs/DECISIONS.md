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

