import { evaluate, evaluateLeftToRight, expressionText, opSymbol, type EvalStep, type Piece } from '../math/expression';
import { trapsFor, type ForgePuzzle } from '../math/forge';
import type { Step } from './types';

/**
 * Thinking through a Forge puzzle (order of operations) the way a child
 * does: try an arrangement, work it out in the right order ("× first",
 * "brackets first"), compare with the target, try again.
 *
 * Mistakes are believable and visible in the reasoning, never random:
 * - left-to-right: works "2 + 3 × 4" left to right (= 20) and believes it
 * - close-enough: settles for an arrangement that is only close to the target
 */

export interface ForgeThought {
  strategyLabel: string;
  steps: Step[];
  /** The arrangement it settles on (piece ids, in order). */
  arrangement: number[];
  /** e.g. "(2 + 3) × 4" */
  text: string;
  /** The value it believes the arrangement makes. */
  claimed: number;
  /** What it really makes (order of operations). */
  actual: number;
  /** actual === target */
  correct: boolean;
  slip?: { id: 'left-to-right' | 'close-enough'; label: string };
}

const SHORT_REASON: Record<EvalStep['reason'], string> = {
  brackets: 'Brackets first: ',
  'times-first': `× first: `,
  'left-to-right': '',
};

function calcStep(s: { left: number; op: EvalStep['op']; right: number; result: number }, prefix = '', slip = false): Step {
  return {
    kind: 'calc',
    say: `${prefix}${s.left} ${opSymbol(s.op)} ${s.right} = ${s.result}`,
    calc: { terms: [s.left, s.right], op: s.op, result: s.result },
    value: s.result,
    ...(slip ? { slip: true } : {}),
  };
}

function shuffle<T>(xs: T[], rng: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** A random arrangement using every piece (numbers and signs alternate; brackets around one pair). */
export function randomArrangement(puzzle: ForgePuzzle, rng: () => number): number[] {
  const nums = shuffle(puzzle.pieces.filter((p) => p.kind === 'num'), rng);
  const ops = shuffle(puzzle.pieces.filter((p) => p.kind === 'op'), rng);
  const lp = puzzle.pieces.find((p) => p.kind === 'lp');
  const rp = puzzle.pieces.find((p) => p.kind === 'rp');
  const seq: Piece[] = [];
  nums.forEach((n, i) => {
    if (i > 0) seq.push(ops[i - 1]);
    seq.push(n);
  });
  if (lp && rp) {
    const pair = Math.floor(rng() * (nums.length - 1));
    seq.splice(2 * pair + 3, 0, rp);
    seq.splice(2 * pair, 0, lp);
  }
  return seq.map((p) => p.id);
}

const valueOf = (puzzle: ForgePuzzle, ids: number[]) => {
  const r = evaluate(ids.map((id) => puzzle.pieces[id]));
  return r.ok && r.whole ? r : null;
};

function workedSteps(puzzle: ForgePuzzle, ids: number[]): { steps: Step[]; value: number } | null {
  const r = valueOf(puzzle, ids);
  if (!r) return null;
  const many = r.steps.length > 1;
  return { steps: r.steps.map((s) => calcStep(s, many ? SHORT_REASON[s.reason] : '')), value: r.value };
}

const textOf = (puzzle: ForgePuzzle, ids: number[]) => expressionText(ids.map((id) => puzzle.pieces[id]));

/**
 * Think a Forge puzzle through.
 * - proficiency 0–1: fewer wrong tries before finding it
 * - wrong: true ends in a believable mistake (see the slips above)
 */
export function thinkForge(puzzle: ForgePuzzle, opts: { proficiency: number; wrong: boolean; rng: () => number }): ForgeThought {
  const { rng, proficiency } = opts;
  const steps: Step[] = [{ kind: 'plan', say: `I need to make ${puzzle.target}` }];
  const target = puzzle.target;

  // A few tries first (fewer when fluent). A try that happens to hit the target is a find.
  const tries = proficiency >= 0.8 ? (rng() < 0.3 ? 1 : 0) : proficiency >= 0.4 ? 1 + (rng() < 0.4 ? 1 : 0) : 2;
  let closest: { ids: number[]; value: number } | null = null;
  for (let t = 0; t < tries; t++) {
    let ids: number[] = [];
    let worked: ReturnType<typeof workedSteps> = null;
    for (let k = 0; k < 12 && !worked; k++) {
      ids = randomArrangement(puzzle, rng);
      worked = workedSteps(puzzle, ids);
    }
    if (!worked) continue;
    steps.push({ kind: 'plan', say: `Try ${textOf(puzzle, ids)}` }, ...worked.steps);
    if (worked.value === target && !opts.wrong) {
      steps.push({ kind: 'answer', say: `${textOf(puzzle, ids)} = ${target}!`, value: target });
      return { strategyLabel: 'Try and check', steps, arrangement: ids, text: textOf(puzzle, ids), claimed: target, actual: target, correct: true };
    }
    steps.push({ kind: 'plan', say: worked.value < target ? `${worked.value}: too small` : worked.value > target ? `${worked.value}: too big` : `${worked.value}: that's it… or is it?` });
    if (!closest || Math.abs(worked.value - target) < Math.abs(closest.value - target)) closest = { ids, value: worked.value };
  }

  if (opts.wrong) {
    // Slip 1: working left to right (no rules) makes a wrong arrangement look right.
    const traps = trapsFor(puzzle.pieces, target);
    if (traps.length > 0) {
      const pieces = traps[Math.floor(rng() * traps.length)];
      const ids = pieces.map((p) => p.id);
      const real = evaluate(pieces);
      const naive = evaluateLeftToRight(pieces)!;
      const realValue = real.ok ? real.value : NaN;
      const realSteps = real.ok ? real.steps : [];
      const firstDiff = Math.max(0, naive.steps.findIndex((s, i) => !realSteps[i] || s.result !== realSteps[i].result));
      steps.push({ kind: 'plan', say: `Try ${textOf(puzzle, ids)}` }, ...naive.steps.map((s, i) => calcStep(s, '', i >= firstDiff)));
      steps.push({ kind: 'answer', say: `${textOf(puzzle, ids)} = ${target}!`, value: target, slip: true });
      return {
        strategyLabel: 'Left to right',
        steps,
        arrangement: ids,
        text: textOf(puzzle, ids),
        claimed: target,
        actual: realValue,
        correct: false,
        slip: { id: 'left-to-right', label: `I went left to right. ${pieces.some((p) => p.kind === 'lp') ? 'Brackets go first' : '× and ÷ go first'}!` },
      };
    }
    // Slip 2: settle for something close.
    let pickIds = closest?.ids;
    let value = closest?.value;
    for (let k = 0; k < 20 && (pickIds === undefined || value === target); k++) {
      const ids = randomArrangement(puzzle, rng);
      const w = workedSteps(puzzle, ids);
      if (w && w.value !== target) {
        pickIds = ids;
        value = w.value;
        steps.push({ kind: 'plan', say: `Try ${textOf(puzzle, ids)}` }, ...w.steps);
      }
    }
    if (pickIds !== undefined && value !== undefined && value !== target) {
      steps.push({ kind: 'answer', say: `${value} is close enough!`, value, slip: true });
      return {
        strategyLabel: 'Close enough?',
        steps,
        arrangement: pickIds,
        text: textOf(puzzle, pickIds),
        claimed: value,
        actual: value,
        correct: false,
        slip: { id: 'close-enough', label: `Close isn't enough: it has to be exactly ${target}` },
      };
    }
  }

  // The real thing: the solution, worked in the right order.
  const ids = puzzle.solution;
  const worked = workedSteps(puzzle, ids)!;
  steps.push({ kind: 'plan', say: `Try ${textOf(puzzle, ids)}` }, ...worked.steps, { kind: 'answer', say: `${textOf(puzzle, ids)} = ${target}!`, value: target });
  return { strategyLabel: tries > 0 ? 'Try and check' : 'I can see it', steps, arrangement: ids, text: textOf(puzzle, ids), claimed: target, actual: target, correct: true };
}

