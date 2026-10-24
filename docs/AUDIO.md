# Audio: sounds and music for emotion

`src/core/audio/` gives every game moment a sound and every place a musical mood. Everything is **synthesised with the Web Audio API**, so there are no audio files to load or license. Sounds are tuned for children: "wrong" sounds stay gentle and encouraging, never harsh buzzers.

## How it fits together

- **`audio`** (`AudioEngine.ts`) is the app-wide instance:
  - `audio.sfx(slot)` plays the effect chosen for a moment.
  - `audio.music(slot)` switches to the track chosen for a place.
  - `audio.duck(on)` lowers the music while paused.
  - `audio.unlock()` starts audio on the first user gesture (browser autoplay rule). `main.tsx` calls it on any input.
- **Library** (`library.ts`):
  - **Effect slots:** each has several variants with a *mood*, plus "Silent".
  - **Music tracks:** small generative loops at eighth-note steps, scheduled 250 ms ahead.
  - **Music slots:** Menus, Adventure, Boss, Classroom; each can use any track.
- **Settings** live per device in `localStorage.funl.audio`: on/off, volume, music, effects, chosen variant per slot and chosen track per music slot. Unknown ids fall back to defaults.
- **Sound panel** (`core/ui/SoundPanel.tsx`) is reachable from **Home/Profiles → 🔊 Sound** and **Pause → 🔊 Sound**. Picking a variant plays it immediately so it can be judged by feel. Leaving the panel returns to the scene's music.

## Slots

| Effect slot | Plays when | Variants (mood) | Default |
|---|---|---|---|
| correct | you answer right | Bright chime (happy) · Arcade coin (energetic) · Warm pluck (calm) · Sparkle (magical) | chime |
| wrong | you answer wrong | Soft boop (gentle) · Wobble (playful) · Low thud (neutral) · Uh-oh (encouraging) | soft-boop |
| lifeLost | an equation reaches you | Whoosh (surprise) · Oof (playful) · Low bell (serious) | whoosh |
| roundClear | spirit K.O.'d / classroom stage passed | Mini fanfare (triumphant) · Harp rise (wonder) · Level up (energetic) | fanfare |
| purified | the last shard breaks | Sparkle rise (magical) · Warm choir (peaceful) · Music box (tender) | sparkle-rise |
| gameOver | out of lives / stage missed | Gentle fall (comforting) · Try again! (encouraging) · Silly trombone (silly) | gentle-fall |
| companionRight | companion answers right | Happy squeak (cute) · Pop (light) · Little trill (proud) | squeak |
| companionWrong | companion slips | Aww (sympathetic) · Hmm? (curious) · Soft boop (gentle) | aww |
| menuMove | controller/arrow focus moves | Soft tick (subtle) · Blip (techy) · Wood block (warm) | tick |
| menuSelect | controller/keyboard presses a button | Confirm (positive) · Pop (light) · Click (subtle) | confirm |

| Music slot | Plays in | Default track |
|---|---|---|
| menu | menus and results | Calm pads (calm, 72 bpm) |
| adventure | normal adventure rounds | Brave adventure (brave, 112 bpm) |
| boss | the final round of an encounter | Tense pulse (tense, 128 bpm) |
| classroom | practice classroom | Lo-fi study (focused, 80 bpm) |

Also available for any slot: **Sunny walk** (cheerful, 100 bpm) and **Silent**.

## Adding a sound

1. Add a variant to a slot in `library.ts` (`play(ctx, out, t)` using `tone` / `noise` / `seq` / `chord` from `synth.ts`), with a `mood`. For a new moment, add a slot and call `audio.sfx('<slot>')` where it happens.
2. Keep levels comparable: peaks around 0.1–0.45 when rendered alone (see how the levels were checked in PATCHNOTES v0.9.0). `audio.test.ts` runs every recipe against a fake context.
3. Add the row to the tables above, and a patch note.
