# FunL patch notes

Game-style changelog. **Every change gets an entry here**, newest on top (see AGENTS.md → "Patch notes & versions").

Version scheme (`package.json` is the only source; the app reads it at build time):
- **minor** (0.x.0): new content, features or gameplay changes, with a named update
- **patch** (0.x.y): fixes, balance tweaks, tooling or docs

Sections, used when relevant: ✨ New · 🎮 Gameplay · ⚖️ Balance · 🎨 Art & UI · 🐛 Fixes · 📊 Data & telemetry · 🛠️ Dev & tooling.

---

## v0.13.0 · "Workshop & Map" (2026-11-02)

The Forge gets its own place to practise, with levels to unlock, a timer where you're working, and a new map that shows how the whole game fits together.

✨ **New: Forge workshop (practice)**
- A **Forge workshop** section on the Math Monster screen, open to everyone. Practise alone, or (once you've befriended a spirit) with your companion forging next to you.
- **Its own ladder of 6 levels**, separate from the classroom stages: Plus & minus → × before + → **÷ joins in** (new) → Brackets → Four numbers → **Master forger** (new: four numbers with brackets).
- A lesson is 8 puzzles at one level. Forge **6 cleanly** (within 2 tries, no hint) to **pass and unlock the next level**. Unlocked levels can always be replayed.
- After a lesson: **Next level / Play this level again / Done**, fully controller-friendly.
- The lesson ends when you finish; you no longer wait for your companion to finish its puzzles.

✨ **New: 🗺️ Game map**
- A new button on the home screen. It shows the game's structure as UML and flow diagrams: what you can play and what unlocks what ("The game at a glance"), plus how the code fits together (components, classes, screens, the engines, storage, the Forge board). Pick a diagram with the controller or mouse and zoom in.
- The diagrams are drawn live from the project docs, so the map and the docs always match.

🎮 **Gameplay**
- **Timer in the equation bar:** the time left now sits inside the row you're building in. In Adventure it's a countdown to the spirit's attack (orange when it gets low, red at the end). In practice it's a calm stopwatch.
- New setting **Forge time: Relaxed / Normal / Quick** (1.5× / 1× / 0.7× the time) for the Adventure's forge rounds.
- Adventure boss rounds use the new levels: one step up per spirit encounter (level 1 at stage 5, 2 at stage 10, 3 (÷) at 15, 4 (brackets) at 20, 5 at 25, 6 from 30).

🐛 **Fixes**
- All menu screens checked with a controller (every button reachable with the D-pad from where focus starts): profiles, home, Game map, Sound, Data, both module screens, pause, lesson end, results.

📊 **Data & telemetry**
- Forge practice: `math.forge.practice.start` adds `passAt` (`mastery`/`companionId` null when alone); `math.forge.practice.end` now has `tier`, `clean`, `passed` (and companion counts null when alone); new `math.forge.unlock` (`level`). `math.forge.tier` is gone (levels no longer change within a lesson). Summary `forgePractice` now lists lessons. Progress: `classroom.forgeUnlocked` (1–6); v0.12 saves are carried over.

🛠️ **Dev & tooling**
- New dependency **Mermaid 11.17.2** (diagram renderer), loaded only when the Game map opens. `core/ui/uml` (`UmlGraph`, `diagramsIn`), `screens/GameMapScreen` (lazy-loaded with the docs it reads).
- Forge tiers 1–6 in `core/math/forge` (`FORGE_MAX_TIER`); `ForgeBoardView` `timer` prop; `ForgePractice` is now one fixed-level lesson (`PASS_CLEAN`, `CLEAN_TRIES`, solo when `mastery` is null); `forgeUnlockedOf` / `recordForgeLesson`.
- New diagrams: "The game at a glance" (ARCHITECTURE.md), the Forge board (FORGE.md).

---

## v0.12.0 · "The Forge" (2026-10-24)

A new kind of maths inside Math Monster: **forge puzzles** about the *order of operations*. You get a target, say **= 20**, and a handful of pieces (2, 3, 4, +, ×, brackets). Use **every** piece, in the right order, so the calculation makes exactly the target: (2 + 3) × 4 = 20, but 2 + 3 × 4 = 14!

✨ **New: forge the seal (Adventure boss rounds)**
- The **final round of every spirit encounter** is now a forge round: the spirit's last shard is broken by forging **3 seals**. Rounds 1–4 stay as they were.
- While you build, the spirit **charges an attack**. When the bar fills you lose a life, but the puzzle stays and the bar starts again (gentle: no puzzle is ever lost). Players who need more time to move pieces (e.g. on a controller) get extra charge time from their input pace.
- Puzzles get harder through the adventure: **plus & minus** (first boss) → **× before +** → **brackets** → **four numbers** (with ÷).

✨ **New: forge practice (classroom)**
- A new card in the practice classroom. You and your companion each forge 8 puzzles side by side, with no timer.
- Your companion **thinks out loud**: it tries arrangements, works them out in the right order ("× first: 3 × 4 = 12"), and compares with the target. Before it has mastered maths it makes the classic mistakes: working **left to right** ("2 + 3 = 5, × 4 = 20!") or settling for "close enough".
- The level adapts: two first-try puzzles in a row → harder, a big struggle → easier. After two wrong tries you get a **hint** (the first calculation). Your level is remembered.

🎮 **How to play a forge puzzle**
- **Controller:** stick / D-pad moves, **A** picks up a piece, move to where it goes, **A** places it (the others slide apart to make room), **X** puts a piece back, **Y** checks.
- **Keyboard:** type a number or sign to grab that piece (`+ - * / x ( )`), arrows to move, Enter places, Backspace puts back, Space checks.
- **Touch:** tap a piece, then tap where it goes (before the piece you tap, or the empty end); tap a placed piece to move it; ✓ checks.
- While you build, every sign shows **when it is worked out** (① ② ③), and the row shows each calculation and the running result, so you can see *why* the order matters.
- A check explains what's wrong: pieces left, two numbers or two signs side by side, brackets not matching, a result that isn't whole, or "that makes 14, not 20".

🎨 **Art & UI**
- Pieces glide smoothly between tray and row (FLIP animation) and snap into place; the held piece floats and rides along the row.
- Forge panel in the battle with the spirit's charge bar and seal count; the boss banner explains the task.
- New sounds (Sound panel): **Pick up a piece**, **Piece snaps in**, **Seal forged**, 3 variants each plus silent.

🐛 **Fixes**
- Controller menus: pressing down from a small card no longer skips a wide card right below it (e.g. "Continue: stage 2"); the nearest item edge-to-edge in that direction is chosen.

📊 **Data & telemetry**
- New `math.forge.*` events: puzzle start, every piece move, every check (with the error or the value made), sealed, charge, touch taps; practice adds hint, tier change, companion attempts (strategy, slip, what it really made) and the lesson end. Session summary adds `forge` (Adventure) or `forgePractice`. Progress stores `classroom.forgeTier`.

🛠️ **Dev & tooling**
- New shared core pieces: `core/math/expression.ts` (parse/evaluate with order-of-operations steps and reasons, left-to-right evaluation, error explanations), `core/math/forge.ts` (puzzle generator with tiers and traps, board state as pure functions), `core/mental-math/order.ts` (`thinkForge`), `core/ui/forge/` (`ForgeBoardView`, `forgeControls`) and `core/ui/useFlip.ts`. Any game can use forge puzzles.
- Engine: `forge` option (Forge boss rounds), `forgeNav/Primary/Secondary/Take/Drop/Stash/Quick/Check`, `stats.forge`. `ForgePractice` session (`forgePractice.ts`). 24 new tests.
- Docs: new `docs/FORGE.md`.

---

## v0.11.0 · "Maze Duel" (2026-10-24)

A second maths game, and the first one against an opponent: race **Glitch**, a cheeky Static imp, through a number maze. Every right answer gives you one square of path. Squares like +3, −2, ×2 and ÷2 change the number your path carries, and only *exactly* the gate's number opens it.

✨ **New: Maze Duel**
- **The board:** a 9 × 7 grid. You start on the left, Glitch on the right, and the ★ Star Gate with its target number sits in the middle. The two mazes are mirror images (perfectly fair), separated by a crystal wall that only opens at the gate.
- **Your number** starts at 1. Stepping onto an operator square changes it (+n, −n, ×n, ÷n). ÷ only works when it divides evenly, numbers stay between 0 and 99, and you may only step into the gate with exactly the target.
- **Pieces:** answer an equation right to earn a piece, then choose:
  - 🧱 **Build** one square next to your path's end (it shows the number you'd get),
  - 🪨 **Stone**: drop one of your 3 stones next to Glitch's path end to block it,
  - ↩ **Back**: pick up your last square to get out of a dead end.
  A wrong answer shows the right one and earns nothing.
- **Fair blocking:** a stone can never seal anyone off completely, and stones never go right next to the gate.
- **Glitch** answers its own equations at the same time, thinking out loud in a thought bubble with real mental-math strategies (and slips: its wrong answers come from mistakes in its reasoning). It plans the shortest route that hits the target, backs out of dead ends like a person trying another way, and drops a stone on your next square when you get close.
- **Settings:** Glitch **Easy / Medium / Hard** (maths skill, speed, how often it wanders off the best route, how early it blocks), **Path hints On/Off** (green = still leads to the gate, dashed = dead end), and **Input time help**: Glitch waits for your input pace, so a controller dial is as fast as a keyboard.
- **Topics:** plus & minus to 10, to 20, times tables, big numbers.
- **Module screen:** meet Glitch, read the rules, and see your record against each difficulty (and your fastest win).

🎮 **Controls**
- Answering works exactly like Math Monster (keypad, keyboard, controller dial).
- Placing a piece: **keyboard** arrows/WASD aim, Enter places, Tab switches build ↔ stone, Backspace steps back. **Controller** stick/D-pad aims, A places, X switches, B steps back. **Touch**: tap a glowing square.

🎨 **Art & UI**
- Glowing number maze with operator colours, your path in cyan and Glitch's in pink, number badges on every square, previews and hints on the squares you can use.
- Glitch: a new SVG character with moods (thinking, oops, smug, cheering, sulking).
- New music track **Puzzle chase** (playful & tense) in a new **Maze duel** music slot, selectable in the Sound panel.
- Phone portrait/landscape layouts.

🐛 **Fixes**
- Controller menus: pressing left/right now prefers items in the same row (and up/down the same column), so e.g. "right" along the top bar reaches 🔊 Sound instead of dropping into the game cards.

📊 **Data & telemetry**
- New `duel.*` events (answers with think/input time, every move, Glitch's answers and strategies), a duel session summary, and a per-player duel record (see TELEMETRY.md).

🛠️ **Dev & tooling**
- Shared game pieces moved into `core/` so modules never copy or import each other: `core/math` (problems, levels, schemas, seeded RNG, difficulty), `core/ui/number-entry` (keypad, radial dial, `NumberDock`, number actions), `core/ui/PauseMenu`, `core/ui/Hero`, `core/ui/ThinkBubble`, and the shared styles `core/ui/game.css` / `think.css`. Math Monster now uses them too (no behaviour change).
- `src/modules/maze-duel/`: pure `board.ts` (seeded mirrored generator, route search) and `DuelEngine` (`duel.ts`), the rival planner (`ai.ts`), and 14 tests, including a 30-board AI-against-AI test that every duel finishes.
- Dev handle `window.__funl.duel` for browser tests.

---

## v0.10.0 · "Your Pace" (2026-10-24)

The game now learns how fast *you* can enter an answer and gives every equation enough time for it, so slow fingers (or a controller dial) never look like slow thinking.

🎮 **Gameplay**
- **Input-pace learning:** for each player, per device (controller, keyboard, touch, mouse, pen) and answer length (1, 2, 3+ digits), the game learns how long it takes to enter an answer, as a running median of recent answers, ignoring moments when the child looked away.
- **Input time is measured from the first movement:** on a controller the clock starts when the stick starts moving (or any button), not at the first digit. On keyboard and touch it starts at the first key or tap.
- **Extra time per equation (allowance):** each new equation gets extra travel time = (your expected input time − keyboard pace) × 1.25, up to 8 s. Typical keyboard players get about 0 extra; a child on the controller dial gets the time they need. New equations still arrive at the same rhythm.
- New setting **Input time help: Auto / Off**.

🎨 **Art & UI**
- Results show **"Input time per answer (controller)"** next to the typical answer time.
- Data screen: an **Input pace** map per player (device × 1/2/3 digits, measured or estimated, plus the extra time given).

📊 **Data & telemetry**
- `math.answer.correct` / `math.answer.wrong`: `typingMs` now means input time from the **first input movement** (stick, button, key or tap). New `digits` field.
- New `math.input.start` event. `math.problem.spawn` adds `allowanceMs` (included in `travelMs`).
- Session summary adds `inputPace` (`device`, `medianInputMs`, `medianMsPerDigit`, `answers`).

🛠️ **Dev & tooling**
- New core module `src/core/pace`: `InputPace` (`observe`, `expected`, `allowance`, `summary`), `loadPace`/`savePace`, `usePace` hook, plus 6 tests. Docs: `docs/INPUT-PACE.md`.
- Engine: `markInputStart()`, `inputAllowance` option, plus 2 tests. `createEngine(…, extras)`.
- `PaceTable` component (Data screen).

---

## v0.9.0 · "Heart & Sound" (2026-10-19)

More hearts, a kinder boss, every menu works with a controller, and the game finally has sound.

⚖️ **Balance**
- **5 lives** instead of 3.
- **Lives refill at the start of every new round**, so a hard round doesn't carry over into the next.
- **Gentler boss rounds:** 1.3× HP (was 1.5×) and **no extra lane**. The boss keeps the pace and lanes of its stage.

🎮 **Controllers in menus**
- Every menu now works with only a controller, tested end to end with no mouse or keyboard: creating a player, choosing a module, settings, starting a game, pause, sound, results, data, deleting a player.
- **On-screen keyboard** for typing a player's name. It appears automatically when a controller is used (or with "⌨ Show on-screen keyboard").
- **No more browser pop-ups:** deleting a player or a worksheet asks "Sure?" inside the page (`ConfirmButton`), so a controller can answer it.
- **Clear focus highlight** when a controller is in use (glowing outline, slightly raised cards).

🔊 **Sound & music (new)**
- **Synthesised sound library** (`src/core/audio`, no audio files): effects for correct, wrong, lose a life, round clear, purified, game over/try again, companion right/wrong, menu move and menu select. Each has 3–4 variants tagged by **mood** (happy, calm, gentle, encouraging, magical…) plus Silent. Kept gentle for children.
- **Music for emotion:** 5 generative loops (Calm pads, Lo-fi study, Brave adventure, Tense pulse, Sunny walk) assigned to **Menus**, **Adventure**, **Boss** and **Classroom**. Boss rounds switch to tense music, and the music ducks while paused.
- **Sound panel** from **Home/Profiles → 🔊 Sound** and **Pause → 🔊 Sound**: sound on/off, volume, music and effects levels, and a chooser for every slot. Picking a variant plays it so you can feel how it lands. Choices are saved per device.
- Every sound was rendered offline and level-checked: all audible, none clipping, and quiet variants were evened out.

📊 **Data & telemetry**
- New engine event `math.lives.refill` (`lives`, `restored`).

🛠️ **Dev & tooling**
- Engine: `DEFAULT_LIVES = 5`, `refillLives` option (default on), boss HP factor 1.3, no boss lane.
- `core/audio`: `AudioEngine` (`sfx`, `music`, `duck`, `unlock`, `playVariant`, `previewTrack`), `library.ts`, `synth.ts`. Tests run every recipe against a fake AudioContext. New `docs/AUDIO.md`.
- `core/ui`: `SoundPanel`, `OnScreenKeyboard`, `ConfirmButton`. Menu navigation plays menu sounds.
- `<html data-input="gamepad|keyboard|touch|mouse">` reflects the last input device, for styling.
- Dev handle `window.__funlAudio`.

---

## v0.8.0 · "Claw Back" (2026-10-19)

🎮 **Gameplay**
- **Knockback:** when several equations are in flight, every correct answer pushes all the *other* equations back by 18% of the lane, so you can claw your way back from a tight spot.
  - The push is a quick slide (about 0.25 s). While sliding back, an equation doesn't advance, and it never goes past the monster's edge.
  - Works everywhere there are several lanes: Adventure, and both columns in the classroom (your companion's correct answers knock back its own equations).
  - Knocked-back equations flash white with a » trail (chalky blue in the classroom).

📊 **Data & telemetry**
- `math.answer.correct` adds `pushedBack` (how many other equations were knocked back).

🛠️ **Dev & tooling**
- Engine option `knockback` (default `KNOCKBACK` = 0.18; 0 disables it). `ActiveProblem.recoil` holds the remaining slide. Two new engine tests.

---

## v0.7.0 · "Dial It In" (2026-10-19)

A new heroine, a controller layout built for thumbs, and a way to start the adventure over.

🎨 **Art & UI**
- **The hero is now a girl:** an anime swordswoman with a long ponytail and red ribbon, eyelashes and a pleated skirt. Battle and classroom poses both updated (see `?gallery`).
- **Empty practice hall:** without a companion, the classroom section shows an empty room (blank board, empty desks) and nothing to start.

🎮 **Gameplay**
- **Radial number dial for controllers.** With an Xbox-style controller the keypad grid is replaced by a dial with 0–9 around a circle (0 at the top, clockwise).
  - **Left stick** points at a number (the **D-pad** turns the dial one step).
  - **A** types the selected number, **X** deletes, **Y** sends. RT also sends and B also deletes. **Start** pauses.
  - In-game the stick drives the dial instead of moving a cursor; menus still use the stick for navigation. Touch and mouse still get the keypad, and keyboard players just type.
- **Reset progress:** the Math Monster screen has a "Reset progress" button with an in-page "Are you sure?" step that works with a controller. It forgets befriended spirits, the companion, its maths stars and classroom stages, so the adventure starts over and practice locks again. Play history (sessions) is kept.

⚖️ **Balance**
- **Companions think more slowly:** about 1.5× slower at ★0 and about 1.35× slower at ★5 (`thinkFraction = (0.35 + d) × (1.35 − 0.8 × skill)`). Long reasoning chains add less extra time (`0.8 + 0.05 × steps`, capped at 6 steps). ★5 still masters Normal speed.
- Longer rests between the companion's answers: 1.8 s right, 3.2 s wrong, 2.2 s out of time.

🛠️ **Dev & tooling**
- `InputManager.stick()` exposes the analogue left stick (x, y, magnitude, angle). `ControlScheme.stickAsNav: false` for Math Monster.
- `dialLayout.ts` (angle → digit, rotate) with tests. `RadialDial` component. `AnswerDock` picks keypad, dial or compact by device.
- Core `deleteProgress(moduleId, profileId)` (logged), with a test.
- README: **Current build** section (version, contents, tests, bundle size) and exact tool versions.

---

## v0.6.0 · "Thinking Out Loud" (2026-10-19)

Your companion now shows *how* it thinks. Its thought bubble works through real mental-math strategies, step by step, the way children are taught: counting on, making ten, splitting into tens and ones and more. When it gets one wrong, you can see exactly where its thinking slipped.

✨ **New**
- **Mental-math engine** (`src/core/mental-math/`), a new core module that models how people really calculate. It has 30 strategies across + − × ÷ (counting on/back, doubles, make ten, find a 10, number-line jumps, tens and ones, counting up, columns with exchange, repeated adding, counting in steps, doubling, ×10-derived facts, splitting a factor, think-multiplication, rules for 0 and 1…), each with its typical slips. See `docs/MENTAL-MATH.md`.
- **Reasoning thought bubbles** in the classroom. Your companion shows the problem, the strategy it picked ("💡 Find a 10"), its steps appearing one by one, and then its answer.
- **Wrong answers through wrong logic:** a mistake always comes from a slip in the reasoning: "6 + 4 = 10, so it's 10 ✗" (*Oops: I forgot to add the 3*), "7 − 4 = 3 → 43" (*I did 7 − 4 instead of 4 − 7*), "70 + 5 = 75" (*I forgot the ten inside 15*). The faulty step is underlined in red.
- **Notes:** intermediate results worth remembering go on a little notepad on your companion's desk (📝). This is the first piece of the thought-bubble + note system.
- **Three-number sums**, e.g. 3 + 6 + 4. New classroom topic "Three numbers: find a 10" (stage 5–6), where two of the numbers always make 10.

🎮 **Gameplay**
- **Your companion grows smarter, not just more accurate.** At ★0 it counts on and adds in order; at ★5 it finds tens, splits into tens and ones and uses columns. Longer reasoning takes longer, so smarter strategies are also faster.
- Your companion now works on **one equation at a time** (the most urgent in its column, marked 💭) and pauses briefly after each answer so you can read its thinking. Equations it never got to count as out of time.

⚖️ **Balance**
- The classroom ladder has 9 topics now. Stages from 5 up have moved by two (e.g. "Take away" is now stages 7–8).

📊 **Data & telemetry**
- `math.practice.companion` adds `outcome` (right/wrong/unsure), `attempted`, `strategy`, `slip` and `steps`. `answer` is null when it ran out of time.
- Problems have `terms` (all numbers), and keys look like `3+6+4` for three-number sums.

🛠️ **Dev & tooling**
- `core/mental-math` API: `think()`, `strategiesFor()`, `STRATEGIES`, plus step helpers. Property tests check, over about 2,800 problems, that every correct chain is true arithmetic and every slip is marked and consistent.
- `makeProblem(a, op, b, ...more)`, and rule options `terms` / `makeTen`. Classroom topics can carry their own level config.
- Companion: `mistake()` removed (replaced by reasoning slips). `attempt()` returns `reasoning`.

---

## v0.5.0 · "Study Buddies" (2026-10-19)

Two desks, two columns, one goal. Your companion now works on its own equations right next to you, and the classroom climbs in stages.

🎮 **Gameplay**
- **Two columns on the chalkboard:** yours on the left, your companion's on the right, each above its owner's desk. Equations float right → left inside each column.
- **Asynchronous answers:** your companion gets its own equations (same topic and pace) and answers them on its own clock, independently of you. It shows thinking dots while it works, then its answer: ✨ right, 😢 wrong (the equation gets crossed out and drifts on), 😅 out of time.
- **Classroom stages:** each stage is 12 equations, and you pass with 9 right.
  - **Pass** → "STAGE n CLEAR!" and the next, harder stage starts automatically after 6 seconds (or press ▶).
  - **Miss** → "SO CLOSE!" with **↺ Try again**. You can also retry a stage you passed, or leave class at any time.
  - The stage ends once both columns are done ("Waiting for Nyx…" / "Nyx is done!").
- **Difficulty ladder:** small sums → sums to 10 → take away → ± to 20 → 2/5/10 tables → times tables → big sums → sharing. Each topic is played twice: *calm* (1 lane) and then *quick* (2 lanes, 1.3× faster). After stage 16 the pace keeps rising (+10% per stage).
- The Math Monster screen shows **▶ Continue: stage N**, plus chips to replay any unlocked stage (quick stages are marked ⚡).
- Every finished stage earns your companion one mastery star (up to ★★★★★), pass or not.

⚖️ **Balance**
- Practice lanes now come from the stage (1 or 2 per column), not the "Equations at once" setting. The speed setting still scales the pace.

🎨 **Art & UI**
- Stage-result panel with both scores, your companion's stars and line, and Next / Try again / Leave. It works with a controller; moving off "Next" cancels the auto-advance.
- Phone portrait layout fixed for the two-column classroom.

📊 **Data & telemetry**
- New: `math.practice.stage.start` and `math.practice.stage.end` (scores, pass, companion results, mastery before/after, unlocked stage).
- `math.practice.mastery` is removed (now part of `stage.end`).
- `math.practice.companion` now refers to the companion's **own** equations (its `id`s come from the companion's engine).
- A practice session's `summary.practice` now covers every stage played: stages played/cleared, highest stage, unlocked stage, companion totals and per-stage results.
- Spirit progress gains `classroom.unlocked`.

🛠️ **Dev & tooling**
- `engine.answerFor(id, value)` answers one specific equation (used by the companion so a wrong answer can never hit another equation).
- `classroom.ts`: pure stage ladder (`stageConfig`, `stagePassed`, `PASS_CORRECT`) with tests.
- `useMathSession`: `autoFinish` option, and `onFrame(dt)` gets the frame's delta time.
- README: new **Tools and technologies** section explaining every tool, library and browser API we use. The roadmap line was removed.

---

## v0.4.0 · "Class Is in Session" (2026-10-19)

Two brothers, one classroom. Free the moon foxes in Adventure, then sit down next to your new friend and practise together.

✨ **New**
- **Practice mode (the classroom).** Unlocked once you've befriended a spirit. You and your companion sit at desks while equations slide right → left across the chalkboard, with the same lanes, speed and controls as Adventure.
  - When you answer, a **thought bubble** shows your answer (✓ / ✗). Your companion answers the same equation in its own bubble a moment later.
  - Companions are **not perfect at maths**. Hard equations take them longer, and they make kid-like mistakes (off by one, off by ten, mixed-up sign). A wrong answer shows 😢, running out of time shows 😅, and a right answer shows ✨.
  - Let an equation land and its answer is written on the board in yellow chalk. Practice has no lives and no game over.
  - A lesson is **12 equations**. Finishing one raises your companion's **maths mastery** by one star. At ★★★★★ (5 lessons) it gets everything right at Normal speed with Auto lanes. Turbo can still outpace it before then.
  - 8 topics: small sums, sums to 10, take away, ± to 20, 2/5/10 tables, times tables, big sums, sharing.
- **Myx**, Nyx's big brother: the *Crescent Fox*, taller with a crescent mark, a scarf, calm gold eyes and an extra tail. He went into the Static to find his little brother and got lost too.
- The Math Monster screen now has an **Adventure** section, a **Practice classroom** (locked until you befriend a spirit) and the Spirit Journal, which also shows each spirit's maths stars.

🎮 **Gameplay**
- The roster is now focused on **two spirits**: Nyx (little brother, met first) and Myx (big brother). Moss, Pip, Tide and Zib are shelved for later chapters.
- Nyx is now a *he*, and his lines and story were updated to match.

🎨 **Art & UI**
- New "elder" build in the creature renderer: taller and slimmer, longer ears, half-lidded eyes, plus a crescent and scarf as the Static fades.
- Classroom scene with a chalkboard, desks, a moonlit window and thought bubbles. On short landscape phones the bubbles move beside the characters.
- The hero has a seated, sword-free classroom pose.

📊 **Data & telemetry**
- New events: `math.practice.companion` (the companion's answer, correct, finished, modelled think time and mastery) and `math.practice.mastery` (stars before → after).
- `problem.spawn`, `answer.correct`, `answer.wrong` and `problem.timeout` now carry the equation's instance `id`.
- Session `config.options.mode` is now `adventure` · `pack` · `practice`. ⚠️ Sessions recorded **before v0.4.0** used `practice` to mean what is now `adventure`.
- Practice sessions add `summary.practice` (topic, companion score, mastery before/after).

🛠️ **Dev & tooling**
- Math Monster split into modes: shared `useMathSession` (loop, input, telemetry, finish), `AnswerDock` and `PauseMenu`, plus `AdventureGame` and `PracticeGame`. `MathMonsterGame` now just picks the mode.
- Engine: `unlimitedLives` option, `LimitedSource` (N problems), equation ids on events.
- `GameModule.Hub` now receives `onStart`, so module panels can launch sessions. New optional `GameModule.presetsTitle`.
- Companion skill model in `companion.ts`, pure and seeded, with tests (struggles at 0★, improves each lesson, 100% at 5★ on every topic).

---

## v0.3.0 · "Spirits of Lumora" (2026-10-19)

The monsters were never really monsters. Each one is a spirit of Lumora corrupted by the Static, and every right answer helps it remember who it was.

✨ **New**
- **5 spirits, 5 forms each.** Nyx (Moon Fox), Moss (Grove Sprite), Pip (Hearth Dragon), Tide (Lagoon Axolotl) and Zib (Storm Sprite). Every spirit goes Corrupted → Cracking → Wavering → Softened → True form, from menacing to cute.
- **Encounters.** Each spirit is fought over 5 rounds, one form per round. Defeating a form makes it transform into the next, cuter one.
- **Final boss round.** Round 5 is a boss fight against the true form, still wearing the last *Static shard*. Break it to **purify** the spirit.
- **Befriend.** A purified spirit offers to join you. Your companion stands beside the hero and cheers when you land a hit.
- **Spirit Journal** on the Math Monster screen shows every spirit, how far you've purified it, and its full backstory once freed. You can change companions there.
- Lore for the world and all 5 spirits (`docs/lore/WORLD.md`).

🎮 **Gameplay**
- The HUD shows the current form's name and **round pips** (●●●○◆), with the boss marked.
- New banners: `ROUND n` with the form's title and a story line, `K.O.!` with a transformation flash, `FINAL ROUND`, and `PURIFIED!`.
- Spirits you haven't purified yet are always met first. After that, spirits you've already freed come back for rematches.

⚖️ **Balance**
- Boss rounds have **1.5× HP** and **+1 lane** (with Auto lanes).
- After a boss falls there's a 3.2 s pause (instead of 1.8 s) so the purification can play out.

🎨 **Art & UI**
- Procedural creature renderer (`Creature.tsx`) replaces the old single demon. One "cuteness" value drives the eyes, mouth, body shape, claws → paws, colours, aura and each species' parts.

📊 **Data & telemetry**
- New events: `math.spirit.encounter`, `math.spirit.purified`, `math.spirit.befriend`.
- `level.start` and `monster.defeated` now carry `encounter`, `round` and `boss`. `game.pause` carries a `reason` (`player` · `hidden` · `story`).
- New per-player **progress** store (IndexedDB v3), included in Data → Export.

🐛 **Fixes**
- **Controller could freeze for a moment after opening a menu.** Menus now pick up input and set focus before the first paint. Spirit Journal portraits are rendered "lite" (no blur filters or looping animations) and appear once the browser is idle. The menu's first frame went from about 330 ms to about 150 ms on a software-rendered browser.
- **First equation could get stuck on the intro.** If player data loaded slowly, the game loop could spawn an equation before the game had started. Answers were then rejected until the intro ended. The engine now ignores ticks before `start()` (regression test added).
- The gamepad poll loop reschedules itself before handling input, so an error in an action handler can't stop the controller from working.

🛠️ **Dev & tooling**
- Line endings normalised to LF across the repo, plus a `.gitattributes` to keep it that way.
- Dev-only debug handles for browser tests: `window.__funl.engine` (current game) and `window.__funlInput`.
- Dev-only creature gallery at `?gallery` (every spirit × every form). It is not included in production builds.
- Generic `GameModule.Hub` slot for module-specific panels on the module screen.
- The version now comes from `package.json` via Vite `define` (`__APP_VERSION__`).

---

## v0.2.1 · "Under the Hood" (2026-10-19)

🛠️ **Dev & tooling**
- Structured diagnostics logging (`core/log`): levels, namespaces, context, IndexedDB persistence, global error capture and an error boundary with a recovery screen.
- Data → Diagnostics: recent warnings/errors and a "Download logs" button. `?log=debug` turns on verbose logs.
- Docs for people and agents: `AGENTS.md`, `CLAUDE.md`, architecture diagrams (Mermaid), telemetry data dictionary, logging guide, decision log.
- A complete `.gitignore`, and VS Code extension recommendations.

🐛 **Fixes**
- A failed telemetry save no longer silently loses events. They are kept, retried and logged.
- IndexedDB migrations are now versioned step by step (v2), so existing data survives upgrades.

---

## v0.2.0 · "Neon Night" (2026-10-16)

🎨 **Art & UI**
- New anime look: night-sky battlefield, a swordsman hero, shadow demons, slash and impact effects, combo counter, speed lines and slanted stage banners.
- The answer box and keypad moved to a compact bottom-left dock. The keypad hides while typing on a keyboard.

🎮 **Gameplay**
- **Several equations at once** (1–4 lanes). The answer hits whichever equation it solves.
- **Speed setting**: Chill / Normal / Fast / Turbo / Insane. Speed also ramps up within a stage, and keeps rising without end after stage 10.

🐛 **Fixes**
- The pause menu's second button was invisible (white on white).
- On the module screen, controller focus now starts on Play instead of the settings.

---

## v0.1.0 · "First Strike" (2026-10-16)

✨ **New**
- The FunL shell: player profiles, module menu, results, Data screen with JSON export.
- **Math Monster**: equations fly at you and you answer before they land. 10 stages from small sums to division.
- Touch, keyboard and gamepad support, with per-module control schemes and controller menu navigation.
- Full play-data recording (answer times, misclicks, corrections) to IndexedDB.
- Worksheet import (JSON content packs).
