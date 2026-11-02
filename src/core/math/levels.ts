import type { LevelConfig } from './schema';

/**
 * Default difficulty curve. Each level is a new monster; defeating it moves
 * the player on. Past the last level the game keeps the final rules and
 * keeps getting faster (see levelAt).
 */
export const DEFAULT_LEVELS: LevelConfig[] = [
  {
    name: 'Small sums',
    rules: [{ op: '+', a: { min: 0, max: 5 }, b: { min: 0, max: 5 } }],
    travelMs: 14000,
    hitsToDefeat: 5,
    lanes: 1,
  },
  {
    name: 'Sums to 10',
    rules: [{ op: '+', a: { min: 1, max: 9 }, b: { min: 1, max: 9 }, maxAnswer: 10 }],
    travelMs: 12500,
    hitsToDefeat: 6,
    lanes: 1,
  },
  {
    name: 'Take away',
    rules: [{ op: '-', a: { min: 1, max: 10 }, b: { min: 0, max: 10 } }],
    travelMs: 12500,
    hitsToDefeat: 6,
    lanes: 2,
  },
  {
    name: 'Mix to 10',
    rules: [
      { op: '+', a: { min: 0, max: 10 }, b: { min: 0, max: 10 }, maxAnswer: 10 },
      { op: '-', a: { min: 0, max: 10 }, b: { min: 0, max: 10 } },
    ],
    travelMs: 11000,
    hitsToDefeat: 8,
    lanes: 2,
  },
  {
    name: 'Sums to 20',
    rules: [
      { op: '+', a: { min: 2, max: 18 }, b: { min: 2, max: 18 }, maxAnswer: 20 },
      { op: '-', a: { min: 5, max: 20 }, b: { min: 1, max: 15 } },
    ],
    travelMs: 11000,
    hitsToDefeat: 8,
    lanes: 2,
  },
  {
    name: '2, 5 and 10 tables',
    rules: [{ op: '×', a: { min: 1, max: 10 }, b: { min: 0, max: 10 }, bValues: [2, 5, 10] }],
    travelMs: 10000,
    hitsToDefeat: 8,
    lanes: 2,
  },
  {
    name: 'Times tables',
    rules: [{ op: '×', a: { min: 2, max: 10 }, b: { min: 2, max: 10 } }],
    travelMs: 10000,
    hitsToDefeat: 10,
    lanes: 2,
  },
  {
    name: 'Big sums',
    rules: [
      { op: '+', a: { min: 10, max: 60 }, b: { min: 5, max: 40 }, maxAnswer: 100 },
      { op: '-', a: { min: 20, max: 99 }, b: { min: 5, max: 50 } },
    ],
    travelMs: 13000,
    hitsToDefeat: 8,
    lanes: 2,
  },
  {
    name: 'Sharing',
    rules: [{ op: '÷', a: { min: 1, max: 10 }, b: { min: 2, max: 10 } }],
    travelMs: 10000,
    hitsToDefeat: 10,
    lanes: 2,
  },
  {
    name: 'Lightning round',
    rules: [
      { op: '+', a: { min: 2, max: 50 }, b: { min: 2, max: 50 }, maxAnswer: 100, weight: 1 },
      { op: '-', a: { min: 10, max: 99 }, b: { min: 2, max: 50 }, weight: 1 },
      { op: '×', a: { min: 2, max: 10 }, b: { min: 2, max: 10 }, weight: 2 },
      { op: '÷', a: { min: 2, max: 10 }, b: { min: 2, max: 10 }, weight: 1 },
    ],
    travelMs: 8000,
    hitsToDefeat: 12,
    lanes: 3,
  },
];

const ENDLESS_SPEEDUP = 0.88;
const MIN_TRAVEL_MS = 2000;

/** Level config for a 1-based level number; extends past the end endlessly. */
export function levelAt(levels: LevelConfig[], level: number): LevelConfig {
  const idx = Math.min(level, levels.length) - 1;
  const base = levels[Math.max(0, idx)];
  const extra = level - levels.length;
  if (extra <= 0) return base;
  return {
    ...base,
    name: `${base.name} +${extra}`,
    travelMs: Math.max(MIN_TRAVEL_MS, Math.round(base.travelMs * ENDLESS_SPEEDUP ** extra)),
    // Every third level past the end adds another lane, up to 4.
    lanes: Math.min(4, (base.lanes ?? 1) + Math.floor(extra / 3)),
  };
}
