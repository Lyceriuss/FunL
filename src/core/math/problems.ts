import { createRng, pick, randInt, type Rng } from './rng';
import { makeProblem, type LevelConfig, type MathPack, type MathProblem, type OpRule } from './schema';

/**
 * Supplies problems to the engine. Swap implementations to go from random
 * practice to a fixed worksheet without touching game logic.
 */
export interface ProblemSource {
  next(level: LevelConfig, previous: MathProblem | null): MathProblem | null;
  /** Problems remaining, or null if endless. */
  remaining(): number | null;
  /** Give a missed problem another go later (fixed packs only). */
  requeue?(problem: MathProblem): void;
}

/** A fixed number of problems from another source (e.g. a practice session). */
export class LimitedSource implements ProblemSource {
  private left: number;
  private readonly inner: ProblemSource;
  constructor(inner: ProblemSource, count: number) {
    this.inner = inner;
    this.left = count;
  }

  next(level: LevelConfig, previous: MathProblem | null): MathProblem | null {
    if (this.left <= 0) return null;
    const p = this.inner.next(level, previous);
    if (p) this.left--;
    return p;
  }

  remaining(): number {
    return this.left;
  }
}

/** Endless random problems following the level's rules. */
export class GeneratedSource implements ProblemSource {
  private rng: Rng;
  constructor(seed: number) {
    this.rng = createRng(seed);
  }

  next(level: LevelConfig, previous: MathProblem | null): MathProblem {
    // Avoid showing the exact same problem twice in a row.
    for (let i = 0; i < 20; i++) {
      const p = generate(this.rng, weightedRule(this.rng, level.rules));
      if (!previous || p.key !== previous.key) return p;
    }
    return generate(this.rng, level.rules[0]);
  }

  remaining(): null {
    return null;
  }
}

/** Problems from a fixed pack (e.g. a transcribed worksheet). */
export class PackSource implements ProblemSource {
  private queue: MathProblem[];
  constructor(pack: MathPack, seed: number) {
    this.queue = pack.problems.map((p) => makeProblem(p.a, p.op, p.b));
    if (pack.order === 'shuffle') shuffle(this.queue, createRng(seed));
  }

  next(): MathProblem | null {
    return this.queue.shift() ?? null;
  }

  remaining(): number {
    return this.queue.length;
  }

  requeue(problem: MathProblem): void {
    this.queue.push(problem);
  }
}

const PACK_HITS_PER_MONSTER = 6;

/** Split a pack into monsters ("levels") so packs get the same game feel. */
export function levelsForPack(pack: MathPack): LevelConfig[] {
  const levels: LevelConfig[] = [];
  for (let left = pack.problems.length; left > 0; left -= PACK_HITS_PER_MONSTER) {
    levels.push({
      name: pack.title,
      rules: [{ op: '+', a: { min: 0, max: 0 }, b: { min: 0, max: 0 } }], // unused: problems come from the pack
      travelMs: pack.travelMs,
      hitsToDefeat: Math.min(PACK_HITS_PER_MONSTER, left),
      lanes: pack.lanes,
    });
  }
  return levels;
}

function weightedRule(rng: Rng, rules: OpRule[]): OpRule {
  const total = rules.reduce((s, r) => s + (r.weight ?? 1), 0);
  let x = rng() * total;
  for (const r of rules) {
    x -= r.weight ?? 1;
    if (x < 0) return r;
  }
  return rules[rules.length - 1];
}

export function generate(rng: Rng, rule: OpRule): MathProblem {
  if (rule.op === '+' && (rule.terms ?? 2) > 2) return generateChain(rng, rule);
  const pickB = () => (rule.bValues?.length ? pick(rng, rule.bValues) : randInt(rng, rule.b.min, rule.b.max));

  for (let attempt = 0; attempt < 50; attempt++) {
    let a = randInt(rng, rule.a.min, rule.a.max);
    let b = pickB();
    switch (rule.op) {
      case '-':
        if (b > a) [a, b] = [b, a];
        break;
      case '÷': {
        // Build from the answer so division is always exact: a ÷ b = q.
        if (b === 0) b = 1;
        const q = a;
        a = q * b;
        break;
      }
      case '×':
        // Put the table number second, as it is usually read ("3 × 5").
        if (rule.bValues?.length && rng() < 0.5) [a, b] = [b, a];
        break;
    }
    const p = makeProblem(a, rule.op, b);
    if (rule.maxAnswer !== undefined && p.answer > rule.maxAnswer) continue;
    return p;
  }
  // Fallback that always satisfies maxAnswer for + rules.
  return makeProblem(rule.a.min, rule.op, rule.op === '÷' ? Math.max(1, rule.b.min) : rule.b.min);
}

/** Sums of 3+ numbers, e.g. 3 + 6 + 4; with makeTen, two of them always make 10. */
function generateChain(rng: Rng, rule: OpRule): MathProblem {
  const n = rule.terms ?? 3;
  const term = () => randInt(rng, rule.a.min, rule.a.max);
  for (let attempt = 0; attempt < 50; attempt++) {
    const terms = Array.from({ length: n }, term);
    if (rule.makeTen) {
      const x = randInt(rng, 1, 9);
      terms[0] = x;
      terms[1] = 10 - x;
      shuffle(terms, rng);
    }
    const p = makeProblem(terms[0], '+', terms[1], ...terms.slice(2));
    if (rule.maxAnswer !== undefined && p.answer > rule.maxAnswer) continue;
    return p;
  }
  return makeProblem(1, '+', 9, rule.a.min);
}

function shuffle<T>(items: T[], rng: Rng): void {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
}
