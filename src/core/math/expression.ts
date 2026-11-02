/**
 * Expressions built from pieces (numbers, + − × ÷, brackets), evaluated with
 * the order of operations (brackets, then × ÷, then + −, each left to right).
 * Every calculation is recorded as a step with *why* it came at that point,
 * so games can show the order ("× before +") and explain mistakes.
 *
 * Pure; used by the Forge puzzles and by thinkers (core/mental-math/order).
 */

export type BinOp = '+' | '-' | '×' | '÷';

export type Piece =
  | { id: number; kind: 'num'; value: number }
  | { id: number; kind: 'op'; op: BinOp }
  | { id: number; kind: 'lp' }
  | { id: number; kind: 'rp' };

export type Node =
  | { kind: 'num'; value: number; at: number }
  | { kind: 'bin'; op: BinOp; left: Node; right: Node; at: number; from: number; to: number; brackets: number };

export type StepReason = 'brackets' | 'times-first' | 'left-to-right';

export interface EvalStep {
  op: BinOp;
  left: number;
  right: number;
  result: number;
  /** Index (in the piece list) of the operator. */
  at: number;
  /** Piece span this calculation covers (inclusive). */
  from: number;
  to: number;
  reason: StepReason;
}

export type ParseErrorCode =
  | 'empty'
  | 'starts-with-op'
  | 'ends-with-op'
  | 'two-ops'
  | 'two-numbers'
  | 'bracket-open'
  | 'bracket-close'
  | 'empty-brackets'
  | 'divide-by-zero';

export interface ParseError {
  code: ParseErrorCode;
  /** Piece index where it went wrong. */
  at: number;
  message: string;
}

export type EvalResult =
  | { ok: true; value: number; steps: EvalStep[]; tree: Node; whole: boolean }
  | { ok: false; error: ParseError };

const MESSAGES: Record<ParseErrorCode, string> = {
  empty: 'Place some pieces first',
  'starts-with-op': 'It has to start with a number (or a bracket)',
  'ends-with-op': 'It has to end with a number (or a bracket)',
  'two-ops': 'Two signs next to each other: put a number between them',
  'two-numbers': 'Two numbers next to each other: put a sign between them',
  'bracket-open': 'A bracket was opened but never closed',
  'bracket-close': 'A bracket closes without being opened',
  'empty-brackets': 'There is nothing inside the brackets',
  'divide-by-zero': "You can't divide by zero",
};

export const opSymbol = (op: BinOp) => (op === '-' ? '−' : op);

export function pieceText(p: Piece): string {
  return p.kind === 'num' ? String(p.value) : p.kind === 'op' ? opSymbol(p.op) : p.kind === 'lp' ? '(' : ')';
}

/** Readable text, e.g. "(2 + 3) × 4". */
export function expressionText(pieces: readonly Piece[]): string {
  let out = '';
  pieces.forEach((p, i) => {
    const t = pieceText(p);
    const prev = pieces[i - 1];
    const tight = p.kind === 'rp' || prev?.kind === 'lp';
    out += i === 0 || tight ? t : ` ${t}`;
  });
  return out;
}

class ParseFail extends Error {
  readonly info: ParseError;
  constructor(info: ParseError) {
    super(info.message);
    this.info = info;
  }
}

const fail = (code: ParseErrorCode, at: number): never => {
  throw new ParseFail({ code, at, message: MESSAGES[code] });
};

/** Parse pieces into a tree (precedence and brackets), or explain what's wrong. */
export function parse(pieces: readonly Piece[]): { ok: true; tree: Node } | { ok: false; error: ParseError } {
  if (pieces.length === 0) return { ok: false, error: { code: 'empty', at: 0, message: MESSAGES.empty } };
  let i = 0;
  let depth = 0;

  const factor = (): Node => {
    const p = pieces[i];
    if (!p) return fail(i === 0 ? 'empty' : 'ends-with-op', Math.max(0, i - 1));
    if (p.kind === 'num') {
      i++;
      const next = pieces[i];
      if (next && (next.kind === 'num' || next.kind === 'lp')) fail('two-numbers', i);
      return { kind: 'num', value: p.value, at: i - 1 };
    }
    if (p.kind === 'lp') {
      const open = i;
      i++;
      if (pieces[i]?.kind === 'rp') fail('empty-brackets', i);
      depth++;
      const inner = expr();
      depth--;
      if (pieces[i]?.kind !== 'rp') fail('bracket-open', open);
      i++;
      const next = pieces[i];
      if (next && (next.kind === 'num' || next.kind === 'lp')) fail('two-numbers', i);
      return inner.kind === 'bin' ? { ...inner, from: open, to: i - 1, brackets: inner.brackets + 1 } : inner;
    }
    if (p.kind === 'rp') return fail('bracket-close', i);
    return fail(i === 0 ? 'starts-with-op' : 'two-ops', i);
  };

  const level = (ops: BinOp[], next: () => Node) => (): Node => {
    let left = next();
    while (i < pieces.length) {
      const p = pieces[i];
      if (p.kind !== 'op' || !ops.includes(p.op)) break;
      const at = i;
      i++;
      if (i >= pieces.length) fail('ends-with-op', at);
      const right = next();
      left = { kind: 'bin', op: p.op, left, right, at, from: spanFrom(left), to: spanTo(right), brackets: 0 };
    }
    return left;
  };
  const term = level(['×', '÷'], factor);
  const expr = level(['+', '-'], term);

  try {
    const tree = expr();
    if (i < pieces.length) fail(pieces[i].kind === 'rp' ? (depth === 0 ? 'bracket-close' : 'bracket-open') : 'two-numbers', i);
    return { ok: true, tree };
  } catch (e) {
    if (e instanceof ParseFail) return { ok: false, error: e.info };
    throw e;
  }
}

function spanFrom(n: Node): number {
  return n.kind === 'num' ? n.at : n.from;
}
function spanTo(n: Node): number {
  return n.kind === 'num' ? n.at : n.to;
}

function apply(op: BinOp, a: number, b: number): number {
  if (op === '+') return a + b;
  if (op === '-') return a - b;
  if (op === '×') return a * b;
  return a / b;
}

/** Evaluate with the order of operations, recording each calculation in order. */
export function evaluate(pieces: readonly Piece[]): EvalResult {
  const parsed = parse(pieces);
  if (!parsed.ok) return parsed;
  const steps: EvalStep[] = [];
  let whole = true;
  let zeroAt = -1;
  // Does this +/− level also contain × or ÷ (so "× first" is the reason)?
  const mixed = (n: Node): boolean => n.kind === 'bin' && (n.op === '+' || n.op === '-') && (hasMul(n.left) || hasMul(n.right));
  const hasMul = (n: Node): boolean => n.kind === 'bin' && n.brackets === 0 && (n.op === '×' || n.op === '÷' || hasMul(n.left) || hasMul(n.right));

  const walk = (n: Node, inBrackets: boolean, parentMixed: boolean): number => {
    if (n.kind === 'num') return n.value;
    const br = inBrackets || n.brackets > 0;
    const m = n.brackets > 0 ? mixed(n) : parentMixed || mixed(n);
    const a = walk(n.left, br, m);
    const b = walk(n.right, br, m);
    if (n.op === '÷' && b === 0) zeroAt = n.at;
    const result = n.op === '÷' && b === 0 ? NaN : apply(n.op, a, b);
    if (!Number.isInteger(result)) whole = false;
    const reason: StepReason = br ? 'brackets' : (n.op === '×' || n.op === '÷') && m ? 'times-first' : 'left-to-right';
    steps.push({ op: n.op, left: a, right: b, result, at: n.at, from: n.from, to: n.to, reason });
    return result;
  };
  const value = walk(parsed.tree, false, false);
  if (zeroAt >= 0) return { ok: false, error: { code: 'divide-by-zero', at: zeroAt, message: MESSAGES['divide-by-zero'] } };
  return { ok: true, value, steps, tree: parsed.tree, whole };
}

/**
 * The classic mistake: no rules, just left to right (ignoring "× before +"
 * and the brackets). Returns the value and the steps as done that way.
 */
export function evaluateLeftToRight(pieces: readonly Piece[]): { value: number; steps: { left: number; op: BinOp; right: number; result: number }[] } | null {
  if (!parse(pieces).ok) return null;
  const flat = pieces.filter((p) => p.kind === 'num' || p.kind === 'op');
  const steps: { left: number; op: BinOp; right: number; result: number }[] = [];
  let acc = (flat[0] as { value: number }).value;
  for (let i = 1; i < flat.length; i += 2) {
    const op = (flat[i] as { op: BinOp }).op;
    const b = (flat[i + 1] as { value: number }).value;
    const r = apply(op, acc, b);
    steps.push({ left: acc, op, right: b, result: r });
    acc = r;
  }
  return { value: acc, steps };
}

/** Order number (1, 2, 3…) of each operator piece index, in evaluation order. */
export function operatorOrder(steps: readonly EvalStep[]): Map<number, number> {
  return new Map(steps.map((s, i) => [s.at, i + 1]));
}

export function stepText(s: { left: number; op: BinOp; right: number; result: number }): string {
  return `${s.left} ${opSymbol(s.op)} ${s.right} = ${Number.isInteger(s.result) ? s.result : s.result.toFixed(2)}`;
}

export const REASON_LABEL: Record<StepReason, string> = {
  brackets: 'Brackets first',
  'times-first': '× and ÷ before + and −',
  'left-to-right': 'Left to right',
};
