import { ADDITION } from './addition';
import { DIVISION, MULTIPLICATION } from './multiplication';
import { calc, exprValue, finalValue } from './steps';
import { SPECIAL } from './special';
import { SUBTRACTION } from './subtraction';
import type { Expr, Reasoning, Step, Strategy, Tier } from './types';

export * from './types';
export { evaluate, exprText, exprValue, finalValue } from './steps';

/**
 * Mental-math reasoning engine. See docs/MENTAL-MATH.md for the catalogue.
 *
 *   think({ op: '+', terms: [3, 6, 4] }, { proficiency: 0.9, wrong: false, rng })
 *   → Find a 10: "6 + 4 = 10" (note 10), "10 + 3 = 13"
 */

export const STRATEGIES: readonly Strategy[] = [...ADDITION, ...SUBTRACTION, ...MULTIPLICATION, ...DIVISION, ...SPECIAL];

/** Fallback for anything no specific strategy covers: work it out in order. */
export const stepwise: Strategy = {
  id: 'stepwise',
  name: 'Working it out in order',
  label: 'Step by step',
  op: '+',
  tier: 1,
  description: 'Calculate each part in order.',
  applies: () => true,
  slips: [{ id: 'step-slip', label: 'I made a mistake on the way' }],
  run(e, slip, rng = Math.random) {
    if (slip && slip !== 'step-slip') return null;
    const n = e.terms.length - 1;
    const bad = slip ? Math.floor(rng() * n) : -1;
    const steps: Step[] = [];
    let acc = e.terms[0];
    for (let k = 1; k <= n; k++) {
      const right = exprValue({ op: e.op, terms: [acc, e.terms[k]] });
      const v = k - 1 === bad ? (right > 0 ? right - 1 : right + 1) : right;
      steps.push(calc([acc, e.terms[k]], e.op, v, { note: k < n, slip: k - 1 === bad }));
      acc = v;
    }
    return steps;
  },
};

/** Every strategy that fits this problem, each with its correct reasoning. */
export function strategiesFor(e: Expr): { strategy: Strategy; steps: Step[] }[] {
  return STRATEGIES.filter((s) => s.op === e.op && s.applies(e)).flatMap((s) => {
    const steps = s.run(e);
    return steps ? [{ strategy: s, steps }] : [];
  });
}

/**
 * Strategy preference by proficiency (0–1): beginners count (tier 1), then
 * use known facts (tier 2), fluent thinkers group and recall (tier 3).
 */
export function preferredTier(proficiency: number): Tier {
  return proficiency < 0.34 ? 1 : proficiency < 0.67 ? 2 : 3;
}

function weight(s: Strategy, pref: Tier): number {
  const d = Math.abs(s.tier - pref);
  return d === 0 ? 3 : d === 1 ? 1 : 0.25;
}

function weightedOrder(list: Strategy[], pref: Tier, rng: () => number): Strategy[] {
  const pool = [...list];
  const out: Strategy[] = [];
  while (pool.length) {
    const total = pool.reduce((n, s) => n + weight(s, pref), 0);
    let x = rng() * total;
    let idx = pool.length - 1;
    for (let i = 0; i < pool.length; i++) {
      x -= weight(pool[i], pref);
      if (x < 0) {
        idx = i;
        break;
      }
    }
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}

function labelOf(label: string | ((e: Expr) => string), e: Expr): string {
  return typeof label === 'function' ? label(e) : label;
}

/**
 * Think a problem through like a person would.
 * - proficiency (0–1) shifts which strategies are chosen
 * - wrong: true produces a believable mistake made *through* the reasoning
 *   (one of the chosen strategy's slips), never a random number
 */
export function think(e: Expr, opts: { proficiency: number; wrong: boolean; rng: () => number }): Reasoning {
  const correctValue = exprValue(e);
  const candidates = STRATEGIES.filter((s) => s.op === e.op && s.applies(e));
  const order = weightedOrder(candidates.length ? candidates : [stepwise], preferredTier(opts.proficiency), opts.rng);

  const build = (s: Strategy, steps: Step[], slip?: { id: string; label: string }): Reasoning => ({
    expr: e,
    strategy: s.id,
    strategyLabel: s.label,
    steps,
    answer: finalValue(steps),
    correct: !slip,
    slip,
  });

  if (!opts.wrong) {
    for (const s of order) {
      const steps = s.run(e, undefined, opts.rng);
      if (steps && finalValue(steps) === correctValue) return build(s, steps);
    }
    return build(stepwise, stepwise.run(e)!);
  }

  for (const s of [...order, stepwise]) {
    const slips = [...s.slips].sort(() => opts.rng() - 0.5);
    for (const slip of slips) {
      const steps = s.run(e, slip.id, opts.rng);
      if (!steps) continue;
      const v = finalValue(steps);
      if (v === correctValue || v < 0 || !Number.isInteger(v)) continue;
      return build(s, steps, { id: slip.id, label: labelOf(slip.label, e) });
    }
  }
  // Practically unreachable (stepwise always has a slip), but stay safe.
  return build(stepwise, [calc(e.terms, e.op, correctValue + 1, { slip: true })], { id: 'step-slip', label: 'I made a mistake' });
}
