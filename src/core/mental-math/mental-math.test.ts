import { describe, expect, it } from 'vitest';
import { STRATEGIES, evaluate, exprValue, finalValue, preferredTier, strategiesFor, think, type Expr, type Step } from './index';

/** Small deterministic RNG for tests. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function problems(): Expr[] {
  const r = rng(11);
  const int = (lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
  const out: Expr[] = [];
  for (let i = 0; i < 400; i++) {
    out.push({ op: '+', terms: [int(0, 20), int(0, 20)] });
    out.push({ op: '+', terms: [int(10, 99), int(1, 99)] });
    out.push({ op: '+', terms: [int(1, 9), int(1, 9), int(1, 9)] });
    const x = int(1, 9);
    out.push({ op: '+', terms: [int(1, 9), x, 10 - x] }); // contains a ten-pair
    const a = int(0, 99);
    out.push({ op: '-', terms: [a, int(0, a)] });
    out.push({ op: '×', terms: [int(1, 12), int(1, 12)] });
    const d = int(1, 10);
    out.push({ op: '÷', terms: [d * int(1, 12), d] });
  }
  return out;
}

/** Calculation steps that aren't marked as the slip must be true arithmetic. */
function honest(steps: Step[]) {
  for (const s of steps) {
    if (s.calc && !s.slip) expect(evaluate(s.calc.terms, s.calc.op), s.say).toBe(s.calc.result);
  }
}

describe('mental-math strategies', () => {
  const all = problems();

  it('every applicable strategy reaches the right answer through true steps', () => {
    let checked = 0;
    for (const e of all) {
      for (const { strategy, steps } of strategiesFor(e)) {
        expect(finalValue(steps), `${strategy.id} on ${e.terms.join(e.op)}`).toBe(exprValue(e));
        expect(steps.some((s) => s.slip)).toBe(false);
        honest(steps);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(3000);
  });

  it('every slip is marked and its wrong answer follows from the shown steps', () => {
    const r = rng(5);
    let slips = 0;
    for (const e of all) {
      for (const s of STRATEGIES.filter((x) => x.op === e.op && x.applies(e))) {
        for (const slip of s.slips) {
          const steps = s.run(e, slip.id, r);
          if (!steps) continue;
          slips++;
          expect(steps.some((st) => st.slip), `${s.id}/${slip.id}`).toBe(true);
          honest(steps);
          // The final value is exactly what the (flawed) steps produce.
          expect(Number.isFinite(finalValue(steps))).toBe(true);
        }
      }
    }
    expect(slips).toBeGreaterThan(2000);
  });

  it('every operation has a strategy for every generated problem', () => {
    for (const e of all) expect(strategiesFor(e).length, e.terms.join(e.op)).toBeGreaterThan(0);
  });
});

describe('think()', () => {
  it('is correct when asked to be, and wrong through a labelled slip otherwise', () => {
    const r = rng(9);
    for (const e of problems().slice(0, 1500)) {
      const ok = think(e, { proficiency: r(), wrong: false, rng: r });
      expect(ok.correct).toBe(true);
      expect(ok.answer).toBe(exprValue(e));

      const bad = think(e, { proficiency: r(), wrong: true, rng: r });
      expect(bad.correct).toBe(false);
      expect(bad.answer).not.toBe(exprValue(e));
      expect(bad.answer).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(bad.answer)).toBe(true);
      expect(bad.slip?.label).toMatch(/^I /);
      expect(bad.slip?.label).not.toMatch(/[{}]/);
      expect(bad.steps.some((s) => s.slip)).toBe(true);
      expect(finalValue(bad.steps)).toBe(bad.answer);
    }
  });

  it('beginners count, fluent thinkers use smarter strategies', () => {
    const tierOf = (id: string) => STRATEGIES.find((s) => s.id === id)?.tier ?? 1;
    const avg = (p: number) => {
      const r = rng(3);
      const list = problems().slice(0, 1200);
      return list.reduce((n, e) => n + tierOf(think(e, { proficiency: p, wrong: false, rng: r }).strategy), 0) / list.length;
    };
    expect(preferredTier(0)).toBe(1);
    expect(preferredTier(1)).toBe(3);
    expect(avg(1)).toBeGreaterThan(avg(0) + 0.5);
  });

  it('thinks 3 + 2 as 3 + 1 + 1 when counting on', () => {
    const s = strategiesFor({ op: '+', terms: [3, 2] }).find((x) => x.strategy.id === 'count-on')!;
    expect(s.steps.map((x) => x.say)).toEqual(['3 + 2 = 3 + 1 + 1', '3 + 1 = 4', '4 + 1 = 5']);
  });

  it('thinks 3 + 6 + 4 either in order or as 6 + 4 = 10, then + 3', () => {
    const ways = Object.fromEntries(strategiesFor({ op: '+', terms: [3, 6, 4] }).map((x) => [x.strategy.id, x.steps.map((s) => s.say)]));
    expect(ways['left-to-right']).toEqual(['3 + 6 = 9', '9 + 4 = 13']);
    expect(ways['ten-pair']).toEqual(['Look for a 10: 6 + 4', '6 + 4 = 10', '10 + 3 = 13']);
  });

  it('reproduces classic mistakes with their wrong logic', () => {
    const r = rng(1);
    const pair = STRATEGIES.find((s) => s.id === 'ten-pair')!;
    const forgot = pair.run({ op: '+', terms: [3, 6, 4] }, 'forgot-term', r)!;
    expect(forgot.map((s) => s.say)).toEqual(['Look for a 10: 6 + 4', '6 + 4 = 10', "So it's 10"]);

    const col = STRATEGIES.find((s) => s.id === 'column-sub')!;
    const bug = col.run({ op: '-', terms: [64, 27] }, 'smaller-from-larger', r)!;
    expect(bug.map((s) => s.say)).toEqual(['60 - 20 = 40', '7 - 4 = 3', '40 + 3 = 43']);

    const split = STRATEGIES.find((s) => s.id === 'split-tens')!;
    const carry = split.run({ op: '+', terms: [47, 38] }, 'dropped-ten', r)!;
    expect(carry.at(-1)!.say).toBe('70 + 5 = 75');
  });
});
