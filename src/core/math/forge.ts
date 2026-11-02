import { evaluate, evaluateLeftToRight, expressionText, pieceText, type BinOp, type EvalStep, type ParseError, type Piece } from './expression';
import { pick, randInt, type Rng } from './rng';

/**
 * Forge puzzles: build the target number from a set of pieces. **Every piece
 * must be used**, so the puzzle is the *order*: where the numbers, signs and
 * brackets go so that the order of operations gives exactly the target.
 *
 *   Target 20, pieces 2 3 4 + × ( )  →  (2 + 3) × 4 = 20
 *
 * This file holds the puzzle generator and the board state (tray, row,
 * held piece, cursor) as pure functions, shared by every game that uses it.
 */

export type ForgeTier = 1 | 2 | 3 | 4 | 5 | 6;
export const FORGE_MAX_TIER: ForgeTier = 6;

export const FORGE_TIERS: Record<ForgeTier, { label: string; hint: string }> = {
  1: { label: 'Plus & minus', hint: 'Order the numbers and signs' },
  2: { label: '× before +', hint: 'Times goes before plus and minus' },
  3: { label: '÷ joins in', hint: 'Times and divide go before plus and minus' },
  4: { label: 'Brackets', hint: 'Brackets go first of all' },
  5: { label: 'Four numbers', hint: 'Mix everything you know' },
  6: { label: 'Master forger', hint: 'Four numbers and brackets' },
};

export interface ForgePuzzle {
  /** Stable key for analysis: the intended solution, e.g. "(2+3)×4". */
  key: string;
  tier: ForgeTier;
  target: number;
  /** All pieces (tray order: numbers, then signs, then brackets). */
  pieces: Piece[];
  /** One solution (piece ids in order). */
  solution: number[];
}

interface TierSpec {
  nums: number;
  min: number;
  max: number;
  ops: BinOp[];
  /** At least one of these ops must appear. */
  need?: BinOp[];
  brackets: 'never' | 'always' | 'maybe';
  /** "× before +" must change the answer (vs working left to right). */
  precedenceMatters?: boolean;
  minTarget: number;
  maxTarget: number;
}

const SPECS: Record<ForgeTier, TierSpec> = {
  1: { nums: 3, min: 1, max: 9, ops: ['+', '-'], brackets: 'never', minTarget: 2, maxTarget: 25 },
  2: { nums: 3, min: 2, max: 9, ops: ['+', '-', '×'], need: ['×'], brackets: 'never', precedenceMatters: true, minTarget: 4, maxTarget: 90 },
  3: { nums: 3, min: 2, max: 9, ops: ['+', '-', '×', '÷'], need: ['÷'], brackets: 'never', precedenceMatters: true, minTarget: 2, maxTarget: 60 },
  4: { nums: 3, min: 2, max: 9, ops: ['+', '-', '×'], need: ['×'], brackets: 'always', minTarget: 4, maxTarget: 100 },
  5: { nums: 4, min: 1, max: 9, ops: ['+', '-', '×', '÷'], need: ['×', '÷'], brackets: 'never', precedenceMatters: true, minTarget: 2, maxTarget: 100 },
  6: { nums: 4, min: 1, max: 9, ops: ['+', '-', '×', '÷'], need: ['×', '÷'], brackets: 'always', minTarget: 2, maxTarget: 100 },
};

type Tok = { kind: 'num'; value: number } | { kind: 'op'; op: BinOp } | { kind: 'lp' } | { kind: 'rp' };

const withIds = (toks: Tok[]): Piece[] => toks.map((t, id) => ({ ...t, id }) as Piece);

/** Generate a puzzle for a tier (seeded). Always solvable by construction. */
export function generateForgePuzzle(rng: Rng, tier: ForgeTier): ForgePuzzle {
  const spec = SPECS[tier];
  for (let attempt = 0; attempt < 3000; attempt++) {
    const nums = Array.from({ length: spec.nums }, () => randInt(rng, spec.min, spec.max));
    const ops = Array.from({ length: spec.nums - 1 }, () => pick(rng, spec.ops));
    if (spec.need && !ops.some((o) => spec.need!.includes(o))) continue;
    const toks: Tok[] = [];
    nums.forEach((n, i) => {
      if (i > 0) toks.push({ kind: 'op', op: ops[i - 1] });
      toks.push({ kind: 'num', value: n });
    });
    let bracketed = false;
    if (spec.brackets === 'always' || (spec.brackets === 'maybe' && rng() < 0.5)) {
      // Brackets around one "a op b" pair whose op is + or −, next to a × or ÷.
      const pairs = ops.map((op, i) => ({ op, i })).filter(({ op, i }) => (op === '+' || op === '-') && (ops[i - 1] === '×' || ops[i - 1] === '÷' || ops[i + 1] === '×' || ops[i + 1] === '÷'));
      if (pairs.length === 0) {
        if (spec.brackets === 'always') continue;
      } else {
        const { i } = pick(rng, pairs);
        // Pair = nums i and i+1 → token positions 2i and 2i+2.
        toks.splice(2 * i + 3, 0, { kind: 'rp' });
        toks.splice(2 * i, 0, { kind: 'lp' });
        bracketed = true;
      }
    }
    const pieces = withIds(toks);
    const r = evaluate(pieces);
    if (!r.ok || !r.whole || r.value < spec.minTarget || r.value > spec.maxTarget) continue;
    if (r.steps.some((s) => s.result < 0 || !Number.isInteger(s.result))) continue;
    if (spec.precedenceMatters && evaluateLeftToRight(pieces)?.value === r.value) continue;
    if (bracketed) {
      // The brackets must matter.
      const plain = evaluate(withIds(toks.filter((t) => t.kind !== 'lp' && t.kind !== 'rp')));
      if (plain.ok && plain.value === r.value) continue;
    }
    // The order must matter: some other arrangement gives a different number.
    if (new Set(arrangementValues(pieces)).size < 2) continue;
    // Prefer puzzles with a tempting left-to-right trap (from tier 2 on).
    if (tier >= 2 && attempt < 300 && trapsFor(pieces, r.value).length === 0) continue;
    // Tray order: numbers (small → big), signs, brackets. Ids follow tray order.
    const rank = (t: Piece) => (t.kind === 'num' ? 0 : t.kind === 'op' ? 1 : 2);
    const sorted = [...pieces].sort((a, b) => rank(a) - rank(b) || (a.kind === 'num' && b.kind === 'num' ? a.value - b.value : 0) || a.id - b.id);
    const newId = new Map(sorted.map((p, i) => [p.id, i]));
    const tray = sorted.map((p) => ({ ...p, id: newId.get(p.id)! }));
    return {
      key: expressionText(pieces).replace(/\s+/g, ''),
      tier,
      target: r.value,
      pieces: tray,
      solution: pieces.map((p) => newId.get(p.id)!),
    };
  }
  throw new Error(`could not generate a tier ${tier} puzzle`);
}

/** Every arrangement of these pieces: numbers and signs alternating, brackets (if any) around one pair. */
export function allArrangements(pieces: readonly Piece[]): Piece[][] {
  const nums = pieces.filter((p) => p.kind === 'num');
  const ops = pieces.filter((p) => p.kind === 'op');
  const lp = pieces.find((p) => p.kind === 'lp');
  const rp = pieces.find((p) => p.kind === 'rp');
  const out: Piece[][] = [];
  for (const ns of permutations(nums)) {
    for (const os of permutations(ops)) {
      const seq: Piece[] = [];
      ns.forEach((n, i) => {
        if (i > 0) seq.push(os[i - 1]);
        seq.push(n);
      });
      if (!lp || !rp) {
        out.push(seq);
        continue;
      }
      for (let pair = 0; pair < ns.length - 1; pair++) {
        const v = [...seq];
        v.splice(2 * pair + 3, 0, rp);
        v.splice(2 * pair, 0, lp);
        out.push(v);
      }
    }
  }
  return out;
}

/** Values of every arrangement (whole-number results only). */
export function arrangementValues(pieces: readonly Piece[]): number[] {
  return allArrangements(pieces).flatMap((v) => {
    const r = evaluate(v);
    return r.ok && r.whole ? [r.value] : [];
  });
}

/**
 * Trap arrangements: they make the target when read left to right with no
 * rules, but not with the real order of operations. The mistake to learn from.
 */
export function trapsFor(pieces: readonly Piece[], target: number): Piece[][] {
  return allArrangements(pieces).filter((v) => {
    const r = evaluate(v);
    return evaluateLeftToRight(v)?.value === target && !(r.ok && r.whole && r.value === target);
  });
}

function permutations<T>(xs: T[]): T[][] {
  if (xs.length <= 1) return [xs];
  return xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((rest) => [x, ...rest]));
}

// ---------------------------------------------------------------------------
// Board state
// ---------------------------------------------------------------------------

export type ForgeZone = 'tray' | 'row';

export interface ForgeBoard {
  puzzle: ForgePuzzle;
  /** Placed pieces, in order. */
  row: number[];
  /** Picked-up piece (moving), if any. */
  held: number | null;
  /** Where the held piece came from (to put it back on cancel). */
  heldFrom: { zone: ForgeZone; index: number } | null;
  /**
   * Controller/keyboard cursor. In the row it points at a *gap* (0…row
   * length) while holding a piece, otherwise at a piece.
   */
  cursor: { zone: ForgeZone; index: number };
}

export type ForgeMove =
  | { kind: 'pick'; piece: number; from: ForgeZone }
  | { kind: 'place'; piece: number; gap: number }
  | { kind: 'return'; piece: number }
  | { kind: 'cancel'; piece: number }
  | { kind: 'cursor' }
  | { kind: 'none' };

export function newBoard(puzzle: ForgePuzzle): ForgeBoard {
  return { puzzle, row: [], held: null, heldFrom: null, cursor: { zone: 'tray', index: 0 } };
}

/** Pieces still in the tray (not placed, not held), in tray order. */
export function trayOf(b: ForgeBoard): number[] {
  const used = new Set(b.row);
  return b.puzzle.pieces.map((p) => p.id).filter((id) => !used.has(id) && id !== b.held);
}

export function pieceById(b: ForgeBoard, id: number): Piece {
  return b.puzzle.pieces[id];
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** Where the cursor goes after a piece lands: back to the tray, or onto the finished row. */
function afterPlace(b: ForgeBoard, placedAt: number, trayIndex: number): ForgeBoard['cursor'] {
  const tray = trayOf(b);
  return tray.length ? { zone: 'tray', index: clamp(trayIndex, 0, tray.length - 1) } : { zone: 'row', index: placedAt };
}

export function forgeNav(b: ForgeBoard, dir: 'up' | 'down' | 'left' | 'right'): { board: ForgeBoard; move: ForgeMove } {
  const tray = trayOf(b);
  const holding = b.held !== null;
  const rowSlots = holding ? b.row.length + 1 : b.row.length;
  let { zone, index } = b.cursor;
  if (dir === 'left' || dir === 'right') {
    const d = dir === 'left' ? -1 : 1;
    const len = zone === 'tray' ? tray.length : rowSlots;
    if (len === 0) return { board: b, move: { kind: 'none' } };
    const next = clamp(index + d, 0, len - 1);
    if (next === index) return { board: b, move: { kind: 'none' } };
    index = next;
  } else if (dir === 'up') {
    if (zone === 'row' || rowSlots === 0) return { board: b, move: { kind: 'none' } };
    zone = 'row';
    index = holding ? b.row.length : clamp(index, 0, b.row.length - 1);
  } else {
    if (zone === 'tray' || tray.length === 0) return { board: b, move: { kind: 'none' } };
    zone = 'tray';
    index = clamp(index, 0, tray.length - 1);
  }
  return { board: { ...b, cursor: { zone, index } }, move: { kind: 'cursor' } };
}

/** Pick up a specific piece (tray or row). */
export function forgeTake(b: ForgeBoard, id: number): { board: ForgeBoard; move: ForgeMove } {
  let board = b;
  if (board.held !== null) board = forgeCancel(board).board;
  const rowIndex = board.row.indexOf(id);
  if (rowIndex >= 0) {
    const row = board.row.filter((x) => x !== id);
    return {
      board: { ...board, row, held: id, heldFrom: { zone: 'row', index: rowIndex }, cursor: { zone: 'row', index: rowIndex } },
      move: { kind: 'pick', piece: id, from: 'row' },
    };
  }
  const trayIndex = trayOf(board).indexOf(id);
  if (trayIndex < 0) return { board: b, move: { kind: 'none' } };
  return {
    board: { ...board, held: id, heldFrom: { zone: 'tray', index: trayIndex }, cursor: { zone: 'row', index: board.row.length } },
    move: { kind: 'pick', piece: id, from: 'tray' },
  };
}

/** Put the held piece into a gap of the row (0 = before the first piece). */
export function forgeDrop(b: ForgeBoard, gap: number): { board: ForgeBoard; move: ForgeMove } {
  if (b.held === null) return { board: b, move: { kind: 'none' } };
  const at = clamp(gap, 0, b.row.length);
  const row = [...b.row.slice(0, at), b.held, ...b.row.slice(at)];
  const placed: ForgeBoard = { ...b, row, held: null, heldFrom: null };
  // Back to the same place in the tray, ready for the next piece.
  const cursor = afterPlace(placed, at, b.heldFrom?.zone === 'tray' ? b.heldFrom.index : 0);
  return { board: { ...placed, cursor }, move: { kind: 'place', piece: b.held, gap: at } };
}

/** Put the held piece back where it came from. */
export function forgeCancel(b: ForgeBoard): { board: ForgeBoard; move: ForgeMove } {
  if (b.held === null) return { board: b, move: { kind: 'none' } };
  const id = b.held;
  if (b.heldFrom?.zone === 'row') {
    const at = clamp(b.heldFrom.index, 0, b.row.length);
    const row = [...b.row.slice(0, at), id, ...b.row.slice(at)];
    return { board: { ...b, row, held: null, heldFrom: null, cursor: { zone: 'row', index: at } }, move: { kind: 'cancel', piece: id } };
  }
  const board: ForgeBoard = { ...b, held: null, heldFrom: null };
  const tray = trayOf(board);
  return { board: { ...board, cursor: { zone: 'tray', index: Math.max(0, tray.indexOf(id)) } }, move: { kind: 'cancel', piece: id } };
}

/** Send a placed piece back to the tray. */
export function forgeReturn(b: ForgeBoard, id: number): { board: ForgeBoard; move: ForgeMove } {
  if (!b.row.includes(id)) return { board: b, move: { kind: 'none' } };
  const row = b.row.filter((x) => x !== id);
  const cursor = b.cursor.zone === 'row' ? (row.length ? { zone: 'row' as const, index: clamp(b.cursor.index, 0, row.length - 1) } : { zone: 'tray' as const, index: 0 }) : b.cursor;
  return { board: { ...b, row, cursor }, move: { kind: 'return', piece: id } };
}

/** A: pick up what the cursor points at, or drop the held piece at the cursor. */
export function forgePrimary(b: ForgeBoard): { board: ForgeBoard; move: ForgeMove } {
  const { zone, index } = b.cursor;
  if (b.held !== null) {
    if (zone === 'row') return forgeDrop(b, index);
    // Cursor went back to the tray: swap for the piece there.
    const target = trayOf(b)[index];
    return target === undefined ? forgeCancel(b) : forgeTake(b, target);
  }
  const id = zone === 'tray' ? trayOf(b)[index] : b.row[index];
  return id === undefined ? { board: b, move: { kind: 'none' } } : forgeTake(b, id);
}

/** X: cancel the held piece, or send the pointed-at row piece back to the tray. */
export function forgeSecondary(b: ForgeBoard): { board: ForgeBoard; move: ForgeMove } {
  if (b.held !== null) return forgeCancel(b);
  if (b.cursor.zone === 'row' && b.row[b.cursor.index] !== undefined) return forgeReturn(b, b.row[b.cursor.index]);
  return { board: b, move: { kind: 'none' } };
}

/** Keyboard shortcut: pick the first tray piece showing this symbol ("7", "+", "(", "*"…). */
export function forgeQuick(b: ForgeBoard, symbol: string): { board: ForgeBoard; move: ForgeMove } {
  const norm = symbol === '*' || symbol === 'x' ? '×' : symbol === '/' ? '÷' : symbol === '-' ? '−' : symbol;
  const id = trayOf(b).find((pid) => pieceText(b.puzzle.pieces[pid]) === norm);
  return id === undefined ? { board: b, move: { kind: 'none' } } : forgeTake(b, id);
}

export type ForgeCheck =
  | { status: 'incomplete'; left: number }
  | { status: 'invalid'; error: ParseError }
  | { status: 'right' | 'wrong'; value: number; steps: EvalStep[]; whole: boolean; text: string };

/** Y: is the row finished, valid, and equal to the target? */
export function forgeCheck(b: ForgeBoard): ForgeCheck {
  const left = trayOf(b).length + (b.held !== null ? 1 : 0);
  if (left > 0) return { status: 'incomplete', left };
  const pieces = b.row.map((id) => b.puzzle.pieces[id]);
  const r = evaluate(pieces);
  if (!r.ok) return { status: 'invalid', error: r.error };
  const right = r.whole && r.value === b.puzzle.target;
  return { status: right ? 'right' : 'wrong', value: r.value, steps: r.steps, whole: r.whole, text: expressionText(pieces) };
}

/** Live preview of the row as it stands (null while it isn't a valid expression yet). */
export function forgePreview(b: ForgeBoard): { value: number; steps: EvalStep[]; whole: boolean } | null {
  if (b.row.length === 0) return null;
  const r = evaluate(b.row.map((id) => b.puzzle.pieces[id]));
  return r.ok ? { value: r.value, steps: r.steps, whole: r.whole } : null;
}

/** Touch: drop the held piece back into the tray (wherever it came from). */
export function forgeStash(b: ForgeBoard): { board: ForgeBoard; move: ForgeMove } {
  if (b.held === null) return { board: b, move: { kind: 'none' } };
  const board: ForgeBoard = { ...b, held: null, heldFrom: null };
  return { board: { ...board, cursor: { zone: 'tray', index: Math.max(0, trayOf(board).indexOf(b.held)) } }, move: { kind: 'return', piece: b.held } };
}
