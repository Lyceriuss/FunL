import { chord, noise, seq, tone, type Ctx } from './synth';

/**
 * The sound library: short effects for game moments and generative music
 * loops for moods. Every slot has several variants (plus silence) so they can
 * be auditioned and picked in the Sound panel. Moods describe the emotion a
 * sound is meant to create. For children, "wrong" sounds stay gentle, never
 * harsh buzzers.
 */

export type SfxSlot =
  | 'correct'
  | 'wrong'
  | 'lifeLost'
  | 'roundClear'
  | 'purified'
  | 'gameOver'
  | 'companionRight'
  | 'companionWrong'
  | 'menuMove'
  | 'menuSelect';

export interface SfxVariant {
  id: string;
  name: string;
  /** The feeling it's meant to create. */
  mood: string;
  play(ctx: Ctx, out: AudioNode, t: number): void;
}

export interface SfxSlotDef {
  slot: SfxSlot;
  label: string;
  /** When it plays. */
  when: string;
  default: string;
  variants: SfxVariant[];
}

const silent: SfxVariant = { id: 'none', name: 'Silent', mood: 'quiet', play: () => {} };

export const SFX: SfxSlotDef[] = [
  {
    slot: 'correct',
    label: 'Correct answer',
    when: 'You answer right',
    default: 'chime',
    variants: [
      { id: 'chime', name: 'Bright chime', mood: 'happy', play: (c, o, t) => seq(c, o, t, [84, 88], 0.07, { type: 'sine', dur: 0.35, gain: 0.22 }) },
      { id: 'coin', name: 'Arcade coin', mood: 'energetic', play: (c, o, t) => seq(c, o, t, [83, 88], 0.06, { type: 'square', dur: 0.14, gain: 0.14 }) },
      { id: 'pluck', name: 'Warm pluck', mood: 'calm', play: (c, o, t) => seq(c, o, t, [72, 76, 79], 0.05, { type: 'triangle', dur: 0.3, gain: 0.18 }) },
      {
        id: 'sparkle',
        name: 'Sparkle',
        mood: 'magical',
        play: (c, o, t) => {
          tone(c, o, { type: 'sine', note: 84, to: 96, at: t, dur: 0.25, gain: 0.12 });
          seq(c, o, t + 0.05, [91, 96, 100], 0.05, { type: 'sine', dur: 0.2, gain: 0.07 });
        },
      },
      silent,
    ],
  },
  {
    slot: 'wrong',
    label: 'Wrong answer',
    when: 'You answer wrong',
    default: 'soft-boop',
    variants: [
      { id: 'soft-boop', name: 'Soft boop', mood: 'gentle', play: (c, o, t) => tone(c, o, { type: 'sine', note: 64, to: 57, at: t, dur: 0.22, gain: 0.2 }) },
      { id: 'wobble', name: 'Wobble', mood: 'playful', play: (c, o, t) => tone(c, o, { type: 'triangle', note: 62, to: 55, at: t, dur: 0.35, gain: 0.18, vibrato: { rate: 12, depth: 18 } }) },
      { id: 'thud', name: 'Low thud', mood: 'neutral', play: (c, o, t) => tone(c, o, { type: 'sine', note: 45, to: 38, at: t, dur: 0.18, gain: 0.3 }) },
      { id: 'uh-oh', name: 'Uh-oh', mood: 'encouraging', play: (c, o, t) => seq(c, o, t, [67, 64], 0.13, { type: 'triangle', dur: 0.2, gain: 0.16 }) },
      silent,
    ],
  },
  {
    slot: 'lifeLost',
    label: 'Lose a life',
    when: 'An equation reaches you',
    default: 'whoosh',
    variants: [
      {
        id: 'whoosh',
        name: 'Whoosh',
        mood: 'surprise',
        play: (c, o, t) => {
          noise(c, o, { at: t, dur: 0.35, filter: 'bandpass', freq: 2500, to: 400, gain: 0.18, q: 1.5 });
          tone(c, o, { type: 'sine', note: 55, to: 43, at: t, dur: 0.3, gain: 0.2 });
        },
      },
      { id: 'oof', name: 'Oof', mood: 'playful', play: (c, o, t) => seq(c, o, t, [60, 57, 53], 0.09, { type: 'triangle', dur: 0.16, gain: 0.18 }) },
      { id: 'low-bell', name: 'Low bell', mood: 'serious', play: (c, o, t) => chord(c, o, t, [57, 60], { type: 'sine', dur: 0.8, gain: 0.14, release: 0.7 }) },
      silent,
    ],
  },
  {
    slot: 'roundClear',
    label: 'Round clear',
    when: 'A spirit is K.O.\'d or a classroom stage is passed',
    default: 'fanfare',
    variants: [
      { id: 'fanfare', name: 'Mini fanfare', mood: 'triumphant', play: (c, o, t) => seq(c, o, t, [72, 76, 79, 84], 0.09, { type: 'square', dur: 0.2, gain: 0.14, lowpass: 3000 }) },
      { id: 'harp', name: 'Harp rise', mood: 'wonder', play: (c, o, t) => seq(c, o, t, [60, 64, 67, 72, 76, 79, 84], 0.045, { type: 'triangle', dur: 0.5, gain: 0.1 }) },
      {
        id: 'level-up',
        name: 'Level up',
        mood: 'energetic',
        play: (c, o, t) => {
          tone(c, o, { type: 'square', note: 60, to: 84, at: t, dur: 0.3, gain: 0.06, lowpass: 2500 });
          chord(c, o, t + 0.3, [72, 76, 79], { type: 'triangle', dur: 0.4, gain: 0.1 });
        },
      },
      silent,
    ],
  },
  {
    slot: 'purified',
    label: 'Spirit purified',
    when: 'The last shard breaks',
    default: 'sparkle-rise',
    variants: [
      {
        id: 'sparkle-rise',
        name: 'Sparkle rise',
        mood: 'magical',
        play: (c, o, t) => {
          seq(c, o, t, [72, 76, 79, 83, 84, 88, 91, 96], 0.07, { type: 'sine', dur: 0.6, gain: 0.08 });
          noise(c, o, { at: t, dur: 0.9, filter: 'highpass', freq: 7000, gain: 0.04 });
        },
      },
      { id: 'choir', name: 'Warm choir', mood: 'peaceful', play: (c, o, t) => chord(c, o, t, [60, 64, 67, 72], { type: 'triangle', dur: 1.6, gain: 0.07, attack: 0.4, release: 0.8, vibrato: { rate: 5, depth: 3 } }) },
      { id: 'music-box', name: 'Music box', mood: 'tender', play: (c, o, t) => seq(c, o, t, [84, 88, 91, 88, 93, 91], 0.16, { type: 'sine', dur: 0.4, gain: 0.1 }) },
      silent,
    ],
  },
  {
    slot: 'gameOver',
    label: 'Game over / try again',
    when: 'All lives are gone or a stage is missed',
    default: 'gentle-fall',
    variants: [
      { id: 'gentle-fall', name: 'Gentle fall', mood: 'comforting', play: (c, o, t) => seq(c, o, t, [67, 64, 60, 62], 0.22, { type: 'triangle', dur: 0.4, gain: 0.13 }) },
      { id: 'try-again', name: 'Try again!', mood: 'encouraging', play: (c, o, t) => seq(c, o, t, [60, 62, 64, 67], 0.14, { type: 'sine', dur: 0.3, gain: 0.15 }) },
      { id: 'sad-trombone', name: 'Silly trombone', mood: 'silly', play: (c, o, t) => seq(c, o, t, [55, 54, 53, 52], 0.25, { type: 'sawtooth', dur: 0.35, gain: 0.12, lowpass: 900, vibrato: { rate: 6, depth: 4 } }) },
      silent,
    ],
  },
  {
    slot: 'companionRight',
    label: 'Companion is right',
    when: 'Your companion answers right (classroom)',
    default: 'squeak',
    variants: [
      { id: 'squeak', name: 'Happy squeak', mood: 'cute', play: (c, o, t) => tone(c, o, { type: 'sine', note: 88, to: 95, at: t, dur: 0.12, gain: 0.12 }) },
      { id: 'pop', name: 'Pop', mood: 'light', play: (c, o, t) => tone(c, o, { type: 'sine', note: 76, to: 88, at: t, dur: 0.07, gain: 0.18 }) },
      { id: 'trill', name: 'Little trill', mood: 'proud', play: (c, o, t) => seq(c, o, t, [86, 88, 86, 88], 0.04, { type: 'triangle', dur: 0.08, gain: 0.13 }) },
      silent,
    ],
  },
  {
    slot: 'companionWrong',
    label: 'Companion is wrong',
    when: 'Your companion slips (classroom)',
    default: 'aww',
    variants: [
      { id: 'aww', name: 'Aww', mood: 'sympathetic', play: (c, o, t) => tone(c, o, { type: 'triangle', note: 74, to: 67, at: t, dur: 0.35, gain: 0.1, vibrato: { rate: 7, depth: 6 } }) },
      { id: 'hmm', name: 'Hmm?', mood: 'curious', play: (c, o, t) => seq(c, o, t, [67, 70], 0.14, { type: 'sine', dur: 0.2, gain: 0.1 }) },
      { id: 'soft-boop', name: 'Soft boop', mood: 'gentle', play: (c, o, t) => tone(c, o, { type: 'sine', note: 64, to: 59, at: t, dur: 0.18, gain: 0.12 }) },
      silent,
    ],
  },
  {
    slot: 'menuMove',
    label: 'Menu move',
    when: 'Moving between buttons with a controller or arrows',
    default: 'tick',
    variants: [
      { id: 'tick', name: 'Soft tick', mood: 'subtle', play: (c, o, t) => tone(c, o, { type: 'sine', note: 90, at: t, dur: 0.03, gain: 0.06 }) },
      { id: 'blip', name: 'Blip', mood: 'techy', play: (c, o, t) => tone(c, o, { type: 'square', note: 79, at: t, dur: 0.04, gain: 0.03 }) },
      { id: 'wood', name: 'Wood block', mood: 'warm', play: (c, o, t) => tone(c, o, { type: 'triangle', note: 76, to: 72, at: t, dur: 0.05, gain: 0.1 }) },
      silent,
    ],
  },
  {
    slot: 'menuSelect',
    label: 'Menu select',
    when: 'Pressing a button with a controller or keyboard',
    default: 'confirm',
    variants: [
      { id: 'confirm', name: 'Confirm', mood: 'positive', play: (c, o, t) => seq(c, o, t, [76, 83], 0.05, { type: 'sine', dur: 0.12, gain: 0.1 }) },
      { id: 'pop', name: 'Pop', mood: 'light', play: (c, o, t) => tone(c, o, { type: 'sine', note: 72, to: 84, at: t, dur: 0.08, gain: 0.14 }) },
      { id: 'click', name: 'Click', mood: 'subtle', play: (c, o, t) => noise(c, o, { at: t, dur: 0.03, filter: 'bandpass', freq: 3000, gain: 0.12 }) },
      silent,
    ],
  },
];

// ---------------------------------------------------------------------------
// Music: small generative loops (eighth-note steps).
// ---------------------------------------------------------------------------

export type MusicSlot = 'menu' | 'adventure' | 'boss' | 'classroom';

export interface MusicTrack {
  id: string;
  name: string;
  mood: string;
  bpm: number;
  bars: number;
  /** Play whatever falls on this eighth-note step (0-based within the loop). */
  step(ctx: Ctx, out: AudioNode, step: number, t: number, stepDur: number): void;
}

export interface MusicSlotDef {
  slot: MusicSlot;
  label: string;
  when: string;
  default: string;
}

const kick = (c: Ctx, o: AudioNode, t: number, g = 0.22) => tone(c, o, { type: 'sine', note: 110, hz: true, to: 45, at: t, dur: 0.16, gain: g });
const hat = (c: Ctx, o: AudioNode, t: number, g = 0.025) => noise(c, o, { at: t, dur: 0.04, filter: 'highpass', freq: 8000, gain: g });
const snare = (c: Ctx, o: AudioNode, t: number, g = 0.07) => noise(c, o, { at: t, dur: 0.12, filter: 'bandpass', freq: 1800, gain: g, q: 0.7 });

export const MUSIC: MusicTrack[] = [
  {
    id: 'calm-pads',
    name: 'Calm pads',
    mood: 'calm',
    bpm: 72,
    bars: 4,
    step(c, o, s, t, d) {
      const prog = [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]];
      const ch = prog[Math.floor(s / 8) % prog.length];
      if (s % 8 === 0) {
        chord(c, o, t, ch, { type: 'sine', dur: d * 8, gain: 0.05, attack: 0.6, release: 1.2 });
        tone(c, o, { type: 'sine', note: ch[0] - 12, at: t, dur: d * 7.5, gain: 0.07, attack: 0.2 });
      }
      if (s % 2 === 0) tone(c, o, { type: 'triangle', note: ch[(s / 2) % 3] + 12, at: t, dur: d * 1.8, gain: 0.03 });
    },
  },
  {
    id: 'lofi-keys',
    name: 'Lo-fi study',
    mood: 'focused',
    bpm: 80,
    bars: 4,
    step(c, o, s, t, d) {
      const prog = [[60, 64, 67, 71], [57, 60, 64, 67], [62, 65, 69, 72], [55, 59, 62, 65]];
      const ch = prog[Math.floor(s / 8) % prog.length];
      const b = s % 8;
      if (b === 0 || b === 3) chord(c, o, t + (b === 3 ? d * 0.15 : 0), ch, { type: 'triangle', dur: d * 2.5, gain: 0.035, lowpass: 1800 });
      if (b === 0 || b === 4) tone(c, o, { type: 'sine', note: ch[0] - 24, at: t, dur: d * 3, gain: 0.09 });
      if (b === 0 || b === 5) kick(c, o, t, 0.14);
      if (b === 2 || b === 6) snare(c, o, t, 0.035);
      if (b % 2 === 1) hat(c, o, t + d * 0.1, 0.015);
    },
  },
  {
    id: 'brave',
    name: 'Brave adventure',
    mood: 'brave',
    bpm: 112,
    bars: 4,
    step(c, o, s, t, d) {
      const roots = [57, 53, 60, 55];
      const r = roots[Math.floor(s / 8) % roots.length];
      const b = s % 8;
      tone(c, o, { type: 'triangle', note: r - 24 + (b % 2 ? 12 : 0), at: t, dur: d * 0.9, gain: 0.08 });
      const melody = [0, null, 3, null, 5, 3, 7, null];
      const scale = [69, 72, 74, 76, 79, 81, 84, 86];
      const m = melody[b];
      if (m !== null && Math.floor(s / 8) % 2 === 0) tone(c, o, { type: 'square', note: scale[m], at: t, dur: d * 0.8, gain: 0.025, lowpass: 2500 });
      if (b === 0 || b === 4) kick(c, o, t, 0.18);
      if (b === 2 || b === 6) snare(c, o, t);
      hat(c, o, t, 0.012);
    },
  },
  {
    id: 'tense-pulse',
    name: 'Tense pulse',
    mood: 'tense',
    bpm: 128,
    bars: 2,
    step(c, o, s, t, d) {
      const b = s % 8;
      const bar = Math.floor(s / 8) % 2;
      tone(c, o, { type: 'sawtooth', note: (bar ? 46 : 45) + (b % 2 ? 12 : 0), at: t, dur: d * 0.7, gain: 0.045, lowpass: 900 });
      if (b === 0) tone(c, o, { type: 'sine', note: bar ? 77 : 76, at: t, dur: d * 3, gain: 0.04, vibrato: { rate: 6, depth: 4 } });
      if (b === 0 || b === 3 || b === 6) kick(c, o, t, 0.2);
      if (b === 4) snare(c, o, t, 0.06);
      hat(c, o, t, 0.018);
    },
  },
  {
    id: 'sunny',
    name: 'Sunny walk',
    mood: 'cheerful',
    bpm: 100,
    bars: 4,
    step(c, o, s, t, d) {
      const prog = [[60, 64, 67], [65, 69, 72], [67, 71, 74], [60, 64, 67]];
      const ch = prog[Math.floor(s / 8) % prog.length];
      const b = s % 8;
      if (b % 2 === 0) tone(c, o, { type: 'triangle', note: (b % 4 === 0 ? ch[0] : ch[2]) - 24, at: t, dur: d * 1.5, gain: 0.08 });
      if (b === 2 || b === 6) chord(c, o, t, ch, { type: 'square', dur: d * 0.6, gain: 0.018, lowpass: 2200 });
      tone(c, o, { type: 'sine', note: ch[b % 3] + 12, at: t, dur: d * 0.7, gain: 0.03 });
      if (b === 0 || b === 4) kick(c, o, t, 0.12);
    },
  },
];

export const MUSIC_SLOTS: MusicSlotDef[] = [
  { slot: 'menu', label: 'Menus', when: 'Menus and results', default: 'calm-pads' },
  { slot: 'adventure', label: 'Adventure', when: 'Normal adventure rounds', default: 'brave' },
  { slot: 'boss', label: 'Boss round', when: 'The final round of an encounter', default: 'tense-pulse' },
  { slot: 'classroom', label: 'Classroom', when: 'Practice classroom', default: 'lofi-keys' },
];

export function sfxSlot(slot: SfxSlot): SfxSlotDef {
  return SFX.find((s) => s.slot === slot)!;
}

export function track(id: string): MusicTrack | undefined {
  return MUSIC.find((m) => m.id === id);
}
