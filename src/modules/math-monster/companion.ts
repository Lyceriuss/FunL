import { think, type Reasoning } from '../../core/mental-math';
import type { Rng } from './rng';
import type { MathProblem } from './schema';

/**
 * The companion's maths "brain" for practice mode. Pure and seeded, so it's
 * testable and reproducible.
 *
 * - Every equation has a difficulty (0–1) from its operation and size.
 * - The companion needs time to think, measured against how long the
 *   equation takes to cross the board at *normal* speed with Auto lanes.
 *   Harder equations take longer; if it would land first, the companion
 *   doesn't finish.
 * - It reasons like a child, using real mental-math strategies (core/mental-math):
 *   beginners count on, fluent thinkers make tens and split into tens/ones.
 *   Its mistakes come from slips *in that reasoning* (counting the start
 *   number, forgetting a term, dropping a carried ten…), never random numbers.
 * - More reasoning steps take longer to think through.
 * - Mastery = completed practice sessions (0–5). At MASTERY_MAX it finishes
 *   every equation correctly at normal speed.
 */

export const MASTERY_MAX = 5;
/** Equations per practice session. */
export const PRACTICE_LENGTH = 12;

export interface CompanionAttempt {
  /** How it thinks the problem through (strategy + steps), right or wrong. */
  reasoning: Reasoning;
  /** The answer its reasoning arrives at. */
  answer: number;
  correct: boolean;
  /** Would it finish before the equation lands (if it started right away)? */
  finished: boolean;
  /** How long it needs to think it through (engine ms). */
  thinkMs: number;
}

/** Rough difficulty of a problem for a child, 0 (trivial) to 1 (hard). */
export function difficulty(p: MathProblem): number {
  const big = (n: number) => Math.min(n, 100) / 100;
  let d: number;
  switch (p.op) {
    case '+':
      d = 0.08 + 0.45 * big(p.answer) + ((p.a % 10) + (p.b % 10) >= 10 ? 0.15 : 0) + 0.12 * (p.terms.length - 2);
      break;
    case '-':
      d = 0.12 + 0.45 * big(p.a) + (p.a % 10 < p.b % 10 ? 0.15 : 0);
      break;
    case '×':
      d = 0.3 + 0.5 * big(p.answer);
      break;
    case '÷':
      d = 0.4 + 0.5 * big(p.a);
      break;
  }
  return Math.max(0, Math.min(1, d));
}

export function skillFor(mastery: number): number {
  return Math.max(0, Math.min(1, mastery / MASTERY_MAX));
}

/**
 * Share of the normal-speed travel time the companion needs to think.
 * Slow and careful at first (about 1.5x the v0.6 pace at 0 stars); at full
 * mastery it still finishes well before the equation lands at normal speed.
 */
export function thinkFraction(d: number, skill: number): number {
  return (0.35 + d) * (1.35 - 0.8 * skill);
}

/** Chance of getting it right once finished. */
export function correctChance(d: number, skill: number): number {
  if (skill >= 1) return 1;
  return Math.max(0.15, Math.min(1, 1 - d * (1 - skill) * 0.9));
}

export function attempt(
  p: MathProblem,
  opts: {
    mastery: number;
    /** Actual travel time of this equation (depends on the speed setting). */
    travelMs: number;
    /** Travel time at normal speed, Auto lanes (what mastery is measured against). */
    normalTravelMs: number;
    rng: Rng;
  },
): CompanionAttempt {
  const d = difficulty(p);
  const skill = skillFor(opts.mastery);
  // Always draw the same number of random values, so results stay stable.
  const jitter = 0.85 + opts.rng() * 0.3;
  const roll = opts.rng();
  const right = roll < correctChance(d, skill);
  const reasoning = think({ op: p.op, terms: p.terms }, { proficiency: skill, wrong: !right, rng: opts.rng });

  // Longer chains of reasoning take a bit longer to think through.
  const stepFactor = 0.8 + 0.05 * Math.min(reasoning.steps.length, 6);
  const thinkMs = Math.round(thinkFraction(d, skill) * opts.normalTravelMs * jitter * stepFactor);
  const finished = thinkMs < opts.travelMs;
  return { reasoning, answer: reasoning.answer, correct: finished && reasoning.correct, finished, thinkMs };
}
