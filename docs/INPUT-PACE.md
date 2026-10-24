# Input pace: time to *enter* an answer

An equation's travel time has to cover two things: **thinking** of the answer and **entering** it. Entering costs very different amounts of time on different devices. "56" is about a second on a keyboard, but on the controller dial it's stick → A → stick → A → Y, which can take several seconds for a child. `src/core/pace/` measures each player's real input speed and gives every equation enough extra time for it, so slow *input* never looks like slow *thinking*.

## What is measured

**Input time** = from the **first input movement** for an answer → the answer arriving (submit).

| Device | Input starts at |
|---|---|
| Controller | the left stick leaving the dead zone, or any controller button (A, X, D-pad) |
| Keyboard | the first digit key |
| Touch / mouse / pen | the first keypad (or dial) tap |

The engine records this per answer:
- `math.answer.correct` / `math.answer.wrong` carry `typingMs` (= input time) and `digits`.
- `math.input.start` marks the moment input began.
- `firstInputMs` is the think time: from the equation appearing to input starting.

## The model (`InputPace`)

- Learned **per player, per device, per answer length** (1, 2, 3, 4+ digits) as the **median of the last 15** answers.
- **Rejects** impossible samples (< 150 ms or > 20 s) and distracted ones (more than 3× the current estimate once there are 3 samples).
- **Before there is data**, it uses device defaults (total input time for *n* digits):

  | Device | Default |
  |---|---|
  | Keyboard | 0.5 s + 0.3 s × n |
  | Touch | 0.7 s + 0.5 s × n |
  | Mouse | 0.7 s + 0.45 s × n |
  | Pen | 0.75 s + 0.5 s × n |
  | Controller (dial) | 1.2 s + 1.0 s × n |

- **Unmeasured lengths** are estimated from the nearest measured length on the same device, scaled by the default's shape (a slow 1-digit player is assumed slow at 2 digits too). Any samples it has are blended in.
- Stored in the per-player progress store (`input-pace:<profileId>`). It is saved every 4 accepted answers and when the game screen closes.

## The algorithm (allowance)

When an equation appears:

```
allowance = clamp( (expected(device, digits) − keyboardDefault(digits)) × 1.25 , 0 , 8 s )
travelMs  = level travel time (speed, lanes, speed-up) + allowance
```

- `device` = the player's current input device. `digits` = length of the correct answer.
- The difficulty curve was tuned for keyboard entry, so a typical keyboard player gets about **0 extra**. A child on the dial gets the time they actually need, never less than 0.
- Spawn spacing still uses the base travel time, so the allowance gives each equation more time without slowing the flow of new ones.
- The setting **Input time help: Auto / Off** (module screen) switches it off.
- The companion's column in the classroom gets no allowance (it doesn't type).

### Example (measured in a browser test)

A slow controller player (about 2.5 s to aim the dial, then A and Y) measured **2.9 s** input time per 1-digit answer. Their extra time per equation went 0.4 s → 2.2 s → 2.4 s → **2.7 s** as it learned ((2.9 − 0.8) × 1.25 ≈ 2.6 s). The pace map then estimated **+4.0 s** for 2-digit and **+5.3 s** for 3-digit answers.

## Where to see it

- **Results screen:** "Input time per answer (controller)", next to "Typical answer time". The difference between them is roughly think time.
- **Data screen → Input pace:** a map per player: device × 1/2/3 digits, measured (sample count) or estimated, plus the extra time given.
- **Session summary:** `summary.inputPace = { device, medianInputMs, medianMsPerDigit, answers }`.
