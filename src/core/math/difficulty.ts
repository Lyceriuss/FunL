import type { MathProblem } from './schema';

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
