import type { Calc, Expr, Op, Step } from './types';

/** Left-to-right value of an expression (exact division assumed). */
export function evaluate(terms: number[], op: Op): number {
  return terms.slice(1).reduce((acc, t) => {
    switch (op) {
      case '+':
        return acc + t;
      case '-':
        return acc - t;
      case '×':
        return acc * t;
      case '÷':
        return acc / t;
    }
  }, terms[0]);
}

export function exprValue(e: Expr): number {
  return evaluate(e.terms, e.op);
}

export function exprText(e: Expr): string {
  return e.terms.join(` ${e.op} `);
}

interface Mark {
  /** Write the result down as a note. */
  note?: boolean;
  slip?: boolean;
}

/** "a op b = result" (result may be wrong when marked as a slip). */
export function calc(terms: number[], op: Op, result: number, mark: Mark = {}): Step {
  const c: Calc = { terms, op, result };
  return {
    kind: 'calc',
    say: `${terms.join(` ${op} `)} = ${result}`,
    calc: c,
    value: result,
    note: mark.note ? result : undefined,
    slip: mark.slip || undefined,
  };
}

/** "I know a op b = result": a fact from memory. */
export function recall(terms: number[], op: Op, result: number, mark: Mark = {}): Step {
  return { ...calc(terms, op, result, mark), kind: 'recall', say: `I know ${terms.join(` ${op} `)} = ${result}` };
}

export function plan(say: string, mark: Mark = {}): Step {
  return { kind: 'plan', say, slip: mark.slip || undefined };
}

export function answer(value: number, say = `So it's ${value}`, mark: Mark = {}): Step {
  return { kind: 'answer', say, value, slip: mark.slip || undefined };
}

/** The final value a list of steps arrives at. */
export function finalValue(steps: Step[]): number {
  for (let i = steps.length - 1; i >= 0; i--) {
    const v = steps[i].value;
    if (v !== undefined) return v;
  }
  return NaN;
}

export const tensOf = (n: number) => n - (n % 10);
export const onesOf = (n: number) => n % 10;
