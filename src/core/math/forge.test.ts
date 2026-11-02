import { describe, expect, it } from 'vitest';
import { thinkForge } from '../mental-math/order';
import { evaluate, evaluateLeftToRight, expressionText, operatorOrder, type Piece } from './expression';
import {
  forgeCheck,
  forgeDrop,
  forgeNav,
  forgePrimary,
  forgeQuick,
  forgeSecondary,
  forgeTake,
  generateForgePuzzle,
  newBoard,
  trayOf,
  type ForgeTier,
} from './forge';
import { createRng } from './rng';

let nextId = 0;
const n = (value: number): Piece => ({ id: nextId++, kind: 'num', value });
const o = (op: '+' | '-' | '×' | '÷'): Piece => ({ id: nextId++, kind: 'op', op });
const L = (): Piece => ({ id: nextId++, kind: 'lp' });
const R = (): Piece => ({ id: nextId++, kind: 'rp' });

describe('expression', () => {
  it('follows the order of operations and records why', () => {
    const r = evaluate([n(2), o('+'), n(3), o('×'), n(4)]);
    expect(r.ok && r.value).toBe(14);
    if (!r.ok) return;
    expect(r.steps.map((s) => [s.left, s.op, s.right, s.result, s.reason])).toEqual([
      [3, '×', 4, 12, 'times-first'],
      [2, '+', 12, 14, 'left-to-right'],
    ]);
    expect([...operatorOrder(r.steps).entries()]).toEqual([
      [3, 1],
      [1, 2],
    ]);
  });

  it('does brackets first', () => {
    const r = evaluate([L(), n(2), o('+'), n(3), R(), o('×'), n(4)]);
    expect(r.ok && r.value).toBe(20);
    if (r.ok) expect(r.steps[0].reason).toBe('brackets');
  });

  it('works equal precedence left to right', () => {
    const r = evaluate([n(8), o('-'), n(3), o('+'), n(2)]);
    expect(r.ok && r.value).toBe(7);
    const d = evaluate([n(12), o('÷'), n(2), o('×'), n(3)]);
    expect(d.ok && d.value).toBe(18);
  });

  it('explains invalid rows', () => {
    const code = (ps: Piece[]) => {
      const r = evaluate(ps);
      return r.ok ? 'ok' : r.error.code;
    };
    expect(code([])).toBe('empty');
    expect(code([o('+'), n(2)])).toBe('starts-with-op');
    expect(code([n(2), o('+')])).toBe('ends-with-op');
    expect(code([n(2), o('+'), o('×'), n(3)])).toBe('two-ops');
    expect(code([n(2), n(3)])).toBe('two-numbers');
    expect(code([L(), n(2), o('+'), n(3)])).toBe('bracket-open');
    expect(code([n(2), o('+'), n(3), R()])).toBe('bracket-close');
    expect(code([n(2), o('+'), L(), R()])).toBe('empty-brackets');
    expect(code([n(2), o('÷'), n(0)])).toBe('divide-by-zero');
  });

  it('flags results that are not whole', () => {
    const r = evaluate([n(7), o('÷'), n(2)]);
    expect(r.ok && r.whole).toBe(false);
  });

  it('can reproduce the left-to-right mistake', () => {
    expect(evaluateLeftToRight([n(2), o('+'), n(3), o('×'), n(4)])?.value).toBe(20);
    expect(expressionText([L(), n(2), o('+'), n(3), R(), o('×'), n(4)])).toBe('(2 + 3) × 4');
  });
});

describe('forge puzzles', () => {
  it('generates solvable puzzles that use every piece, per tier', () => {
    for (const tier of [1, 2, 3, 4, 5, 6] as ForgeTier[]) {
      for (let seed = 1; seed <= 60; seed++) {
        const p = generateForgePuzzle(createRng(seed * 13 + tier), tier);
        expect(new Set(p.solution).size).toBe(p.pieces.length);
        const r = evaluate(p.solution.map((id) => p.pieces[id]));
        expect(r.ok && r.value).toBe(p.target);
        expect(p.pieces.every((x, i) => x.id === i)).toBe(true);
        if (tier === 2) expect(evaluateLeftToRight(p.solution.map((id) => p.pieces[id]))?.value).not.toBe(p.target);
        if (tier === 3) expect(p.pieces.some((x) => x.kind === 'op' && x.op === '÷')).toBe(true);
        if (tier === 4 || tier === 6) expect(p.pieces.some((x) => x.kind === 'lp')).toBe(true);
        if (tier === 5) expect(p.pieces.some((x) => x.kind === 'lp')).toBe(false);
        if (tier >= 5) expect(p.pieces.filter((x) => x.kind === 'num')).toHaveLength(4);
      }
    }
  });

  it('is deterministic for a seed', () => {
    expect(generateForgePuzzle(createRng(5), 3)).toEqual(generateForgePuzzle(createRng(5), 3));
  });
});

describe('forge board', () => {
  const puzzle = generateForgePuzzle(createRng(42), 2);

  it('A picks from the tray, the cursor jumps to the row, A drops; X takes back', () => {
    let b = newBoard(puzzle);
    const first = trayOf(b)[0];
    b = forgePrimary(b).board;
    expect(b.held).toBe(first);
    expect(b.cursor).toEqual({ zone: 'row', index: 0 });
    b = forgePrimary(b).board;
    expect(b.row).toEqual([first]);
    expect(b.cursor.zone).toBe('tray');
    // Second piece goes before the first.
    b = forgePrimary(b).board;
    b = forgeNav(b, 'left').board;
    expect(b.cursor).toEqual({ zone: 'row', index: 0 });
    const second = b.held!;
    b = forgePrimary(b).board;
    expect(b.row).toEqual([second, first]);
    // X on a row piece sends it back.
    b = forgeNav(b, 'up').board;
    b = forgeSecondary(b).board;
    expect(b.row).toHaveLength(1);
    expect(trayOf(b)).toContain(second);
  });

  it('X while holding puts the piece back where it was', () => {
    let b = newBoard(puzzle);
    b = forgeDrop(forgeTake(b, 0).board, 0).board;
    b = forgeDrop(forgeTake(b, 1).board, 1).board;
    b = forgeTake(b, 0).board; // pick from the row
    expect(b.row).toEqual([1]);
    b = forgeSecondary(b).board;
    expect(b.row).toEqual([0, 1]);
  });

  it('checks: incomplete, invalid, wrong, right', () => {
    let b = newBoard(puzzle);
    expect(forgeCheck(b).status).toBe('incomplete');
    // Everything in tray order: numbers then signs → invalid.
    for (const id of trayOf(b)) b = forgeDrop(forgeTake(b, id).board, b.row.length).board;
    expect(forgeCheck(b).status).toBe('invalid');
    b = newBoard(puzzle);
    for (const id of puzzle.solution) b = forgeDrop(forgeTake(b, id).board, b.row.length).board;
    const c = forgeCheck(b);
    expect(c.status).toBe('right');
  });

  it('keyboard shortcuts pick a piece by its symbol', () => {
    const b = newBoard(puzzle);
    const num = puzzle.pieces.find((p) => p.kind === 'num')!;
    const r = forgeQuick(b, String(num.kind === 'num' ? num.value : ''));
    expect(r.board.held).toBe(num.id);
    expect(forgeQuick(b, '*').board.held).toBe(puzzle.pieces.find((p) => p.kind === 'op' && p.op === '×')!.id);
  });
});

describe('thinking a forge puzzle through', () => {
  it('right: ends on a real solution, worked in the right order', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const p = generateForgePuzzle(createRng(seed), ((seed % 6) + 1) as ForgeTier);
      const t = thinkForge(p, { proficiency: seed / 30, wrong: false, rng: createRng(seed + 100) });
      expect(t.correct).toBe(true);
      const r = evaluate(t.arrangement.map((id) => p.pieces[id]));
      expect(r.ok && r.value).toBe(p.target);
      // Unmarked calc steps are true.
      for (const s of t.steps) if (s.kind === 'calc' && !s.slip && s.calc) expect(evaluate([n(s.calc.terms[0]), o(s.calc.op), n(s.calc.terms[1])]).ok && s.calc.result).toBe((evaluate([n(s.calc.terms[0]), o(s.calc.op), n(s.calc.terms[1])]) as { value: number }).value);
    }
  });

  it('wrong: a visible slip, never a random number', () => {
    let leftToRight = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const p = generateForgePuzzle(createRng(seed), 2);
      const t = thinkForge(p, { proficiency: 0.2, wrong: true, rng: createRng(seed) });
      expect(t.correct).toBe(false);
      expect(t.slip).toBeDefined();
      expect(t.steps.some((s) => s.slip)).toBe(true);
      if (t.slip!.id === 'left-to-right') {
        leftToRight++;
        expect(evaluateLeftToRight(t.arrangement.map((id) => p.pieces[id]))?.value).toBe(p.target);
      }
    }
    expect(leftToRight).toBeGreaterThan(5);
  });
});
