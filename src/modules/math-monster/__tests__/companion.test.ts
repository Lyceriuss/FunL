import { describe, expect, it } from 'vitest';
import { MASTERY_MAX, attempt, difficulty } from '../companion';
import { DEFAULT_LEVELS } from '../levels';
import { GeneratedSource } from '../problems';
import { createRng } from '../rng';
import { makeProblem } from '../schema';

const NORMAL = 10_000;

function rate(mastery: number, level: number, travelMs = NORMAL, n = 400) {
  const src = new GeneratedSource(7);
  const rng = createRng(1);
  let correct = 0;
  let finished = 0;
  for (let i = 0; i < n; i++) {
    const p = src.next(DEFAULT_LEVELS[level - 1], null);
    const a = attempt(p, { mastery, travelMs, normalTravelMs: NORMAL, rng });
    if (a.correct) correct++;
    if (a.finished) finished++;
  }
  return { correct: correct / n, finished: finished / n };
}

describe('companion brain', () => {
  it('rates harder problems as more difficult', () => {
    expect(difficulty(makeProblem(2, '+', 3))).toBeLessThan(difficulty(makeProblem(47, '+', 38)));
    expect(difficulty(makeProblem(3, '×', 4))).toBeLessThan(difficulty(makeProblem(9, '×', 8)));
    expect(difficulty(makeProblem(81, '÷', 9))).toBeGreaterThan(difficulty(makeProblem(9, '+', 1)));
  });

  it('struggles more with harder topics before practice', () => {
    const easy = rate(0, 1); // small sums
    const hard = rate(0, 9); // division
    expect(easy.correct).toBeGreaterThan(0.75);
    expect(hard.correct).toBeLessThan(0.5);
    expect(hard.finished).toBeLessThan(1); // some it can't finish in time
  });

  it('improves with every practice session', () => {
    const rates = [0, 1, 2, 3, 4, 5].map((m) => rate(m, 7).correct);
    for (let i = 1; i < rates.length; i++) expect(rates[i]).toBeGreaterThanOrEqual(rates[i - 1]);
  });

  it('masters every topic at normal speed after 5 sessions', () => {
    for (let level = 1; level <= DEFAULT_LEVELS.length; level++) {
      expect(rate(MASTERY_MAX, level).correct).toBe(1);
    }
  });

  it('can still be outpaced at turbo speed before mastery', () => {
    expect(rate(2, 9, NORMAL / 2).finished).toBeLessThan(rate(2, 9, NORMAL).finished);
  });

  it('makes mistakes through its reasoning, never random numbers', () => {
    const rng = createRng(3);
    let wrong = 0;
    for (const p of [makeProblem(3, '+', 2), makeProblem(3, '+', 6, 4), makeProblem(64, '-', 27), makeProblem(7, '×', 8), makeProblem(56, '÷', 8)]) {
      for (let i = 0; i < 60; i++) {
        const a = attempt(p, { mastery: 0, travelMs: 60_000, normalTravelMs: NORMAL, rng });
        expect(a.answer).toBe(a.reasoning.answer);
        if (!a.reasoning.correct) {
          wrong++;
          expect(a.answer).not.toBe(p.answer);
          expect(a.answer).toBeGreaterThanOrEqual(0);
          expect(a.reasoning.steps.some((s) => s.slip)).toBe(true);
          expect(a.reasoning.slip?.label).toBeTruthy();
        } else {
          expect(a.answer).toBe(p.answer);
        }
      }
    }
    expect(wrong).toBeGreaterThan(20);
  });

  it('uses simpler strategies as a beginner and smarter ones once mastered', () => {
    const rng = createRng(4);
    const p = makeProblem(3, '+', 6, 4);
    const used = (mastery: number) => {
      const counts: Record<string, number> = {};
      for (let i = 0; i < 200; i++) {
        const id = attempt(p, { mastery, travelMs: 60_000, normalTravelMs: NORMAL, rng }).reasoning.strategy;
        counts[id] = (counts[id] ?? 0) + 1;
      }
      return counts;
    };
    expect((used(0)['left-to-right'] ?? 0)).toBeGreaterThan(used(0)['ten-pair'] ?? 0);
    expect((used(5)['ten-pair'] ?? 0)).toBeGreaterThan(used(5)['left-to-right'] ?? 0);
  });
});
