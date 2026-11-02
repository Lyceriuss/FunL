import { createRng, pick, randInt, type Rng } from '../../core/math/rng';

/**
 * The duel board: a small grid maze. You start on the left, the rival on the
 * right, and the Star Gate sits in the middle. Your path carries a number
 * (starting at 1); operator squares change it. You may only step into the
 * gate when your number equals the gate's target.
 *
 * The board is mirror-symmetric (left ↔ right), so both sides have exactly
 * the same routes. The middle column is a wall except for the gate: two
 * separate mazes, so paths never get in each other's way; only stones do. Pure and seeded: the same seed gives the same board.
 */

export const W = 9;
export const H = 7;
export const START_VALUE = 1;
/** Numbers above this are not allowed (keeps it child-sized). */
export const MAX_VALUE = 99;

export type OpSymbol = '+' | '-' | '×' | '÷';
export type Cell =
  | { kind: 'open' }
  | { kind: 'rock' }
  | { kind: 'gate' }
  | { kind: 'op'; op: OpSymbol; n: number };

export interface Board {
  seed: number;
  cells: Cell[];
  /** Cell index of the gate. */
  gate: number;
  /** Start cells: you (left) and rival (right). */
  start: { you: number; rival: number };
  target: number;
  /** Length (tiles after the start) of the shortest route to the gate. */
  shortest: number;
}

export const idx = (x: number, y: number) => y * W + x;
export const xy = (i: number) => ({ x: i % W, y: Math.floor(i / W) });
export const mirror = (i: number) => {
  const { x, y } = xy(i);
  return idx(W - 1 - x, y);
};

export type Dir = 'up' | 'down' | 'left' | 'right';
const DELTA: Record<Dir, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

export function step(i: number, dir: Dir): number | null {
  const { x, y } = xy(i);
  const [dx, dy] = DELTA[dir];
  const nx = x + dx;
  const ny = y + dy;
  return nx < 0 || ny < 0 || nx >= W || ny >= H ? null : idx(nx, ny);
}

export function neighbours(i: number): number[] {
  const out: number[] = [];
  for (const d of ['up', 'down', 'left', 'right'] as Dir[]) {
    const n = step(i, d);
    if (n !== null) out.push(n);
  }
  return out;
}

/** Direction from cell a to its neighbour b. */
export function dirTo(a: number, b: number): Dir | null {
  for (const d of ['up', 'down', 'left', 'right'] as Dir[]) if (step(a, d) === b) return d;
  return null;
}

/** Number after stepping onto a cell, or null when the step isn't allowed. */
export function applyCell(cell: Cell, value: number, target: number): number | null {
  switch (cell.kind) {
    case 'rock':
      return null;
    case 'gate':
      return value === target ? value : null;
    case 'open':
      return value;
    case 'op': {
      let v: number;
      if (cell.op === '+') v = value + cell.n;
      else if (cell.op === '-') v = value - cell.n;
      else if (cell.op === '×') v = value * cell.n;
      else {
        if (value % cell.n !== 0) return null;
        v = value / cell.n;
      }
      return v < 0 || v > MAX_VALUE ? null : v;
    }
  }
}

export function cellLabel(cell: Cell): string {
  return cell.kind === 'op' ? `${cell.op === '-' ? '−' : cell.op}${cell.n}` : '';
}

/**
 * Shortest route from `from` (carrying `value`) into the gate with exactly
 * the target, avoiding `blocked` cells. Returns the cells to step on (the
 * last one is the gate), or null if there is none within `maxLen`.
 * Iterative deepening DFS with a distance bound and a work cap.
 */
export function findRoute(
  board: Board,
  from: number,
  value: number,
  blocked: ReadonlySet<number>,
  maxLen = 22,
  budget = 80_000,
): number[] | null {
  const gate = xy(board.gate);
  const dist = (i: number) => {
    const p = xy(i);
    return Math.abs(p.x - gate.x) + Math.abs(p.y - gate.y);
  };
  if (from === board.gate) return value === board.target ? [] : null;
  let work = 0;
  const seen = new Set<number>(blocked);
  seen.add(from);
  const path: number[] = [];

  const dfs = (at: number, v: number, left: number): boolean => {
    if (++work > budget) return false;
    for (const n of neighbours(at)) {
      if (seen.has(n)) continue;
      if (n === board.gate) {
        if (v !== board.target) continue;
        path.push(n);
        return true;
      }
      if (left - 1 < dist(n)) continue;
      const nv = applyCell(board.cells[n], v, board.target);
      if (nv === null) continue;
      seen.add(n);
      path.push(n);
      if (dfs(n, nv, left - 1)) return true;
      path.pop();
      seen.delete(n);
    }
    return false;
  };

  for (let len = Math.max(1, dist(from)); len <= maxLen; len++) {
    if (dfs(from, value, len)) return path;
    if (work > budget) return null;
  }
  return null;
}

/** Every gate value reachable from `from` (shortest route length for each). */
export function reachableTargets(cells: Cell[], from: number, gate: number, maxLen: number, budget = 400_000): Map<number, number> {
  const found = new Map<number, number>();
  const seen = new Set<number>([from]);
  let work = 0;
  const dfs = (at: number, v: number, len: number) => {
    if (++work > budget || len >= maxLen) return;
    for (const n of neighbours(at)) {
      if (seen.has(n)) continue;
      if (n === gate) {
        const best = found.get(v);
        if (best === undefined || len + 1 < best) found.set(v, len + 1);
        continue;
      }
      const nv = applyCell(cells[n], v, -1);
      if (nv === null) continue;
      seen.add(n);
      dfs(n, nv, len + 1);
      seen.delete(n);
    }
  };
  dfs(from, START_VALUE, 0);
  return found;
}

const OP_TILES: { op: OpSymbol; n: number[]; weight: number }[] = [
  { op: '+', n: [1, 2, 3, 4, 5], weight: 5 },
  { op: '-', n: [1, 2, 3], weight: 3 },
  { op: '×', n: [2, 3], weight: 3 },
  { op: '÷', n: [2, 3], weight: 2 },
];

function randomOp(rng: Rng): Cell {
  const total = OP_TILES.reduce((s, t) => s + t.weight, 0);
  let r = rng() * total;
  for (const t of OP_TILES) {
    r -= t.weight;
    if (r < 0) return { kind: 'op', op: t.op, n: pick(rng, t.n) };
  }
  return { kind: 'op', op: '+', n: 1 };
}

/**
 * Generate a fair, solvable board. The left half is random, the right half
 * mirrors it. The target is a number reachable at the gate that needs a few
 * operator squares (not just walking straight there).
 */
export function generateBoard(seed: number): Board {
  const rng = createRng(seed);
  const you = idx(0, 3);
  const gate = idx(4, 3);
  for (let attempt = 0; attempt < 200; attempt++) {
    const cells: Cell[] = Array.from({ length: W * H }, () => ({ kind: 'open' }) as Cell);
    // Left half (x 0..3) plus the middle column; mirrored afterwards.
    for (let y = 0; y < H; y++) {
      for (let x = 0; x <= 4; x++) {
        const i = idx(x, y);
        if (i === you || i === gate) continue;
        const r = rng();
        // The middle column is a crystal wall: two separate mazes that meet only at the gate.
        if (x === 4) cells[i] = { kind: 'rock' };
        else if (r < 0.2) cells[i] = { kind: 'rock' };
        else if (r < 0.52) cells[i] = randomOp(rng);
      }
    }
    // Keep the start's neighbours walkable.
    for (const n of neighbours(you)) if (cells[n].kind === 'rock') cells[n] = { kind: 'open' };
    cells[gate] = { kind: 'gate' };
    for (let y = 0; y < H; y++) for (let x = 5; x < W; x++) cells[idx(x, y)] = cells[idx(W - 1 - x, y)];

    const targets = reachableTargets(cells, you, gate, 11);
    const straight = reachableTargets(
      cells.map((c) => (c.kind === 'op' ? ({ kind: 'rock' } as Cell) : c)),
      you,
      gate,
      11,
    );
    const options = [...targets.entries()].filter(([v, len]) => v >= 4 && v <= 40 && len >= 5 && len <= 10 && !straight.has(v));
    if (options.length === 0) continue;
    // Prefer targets with a medium-length route.
    options.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    const [target, shortest] = options[randInt(rng, 0, Math.min(options.length - 1, 5))];
    return { seed, cells, gate, start: { you, rival: mirror(you) }, target, shortest };
  }
  throw new Error(`could not generate a board for seed ${seed}`);
}
