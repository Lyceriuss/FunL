import { answer, plan } from './steps';
import type { Expr, Strategy } from './types';

/**
 * Rules for 0 and 1 (+0, −0, ×1, ×0, ÷1). Children learn these as rules,
 * and the classic slips are rule mix-ups: "×0 leaves it the same" (confusing
 * it with +0) or "×1 makes 1".
 */

const has = (e: Expr, n: number) => e.terms.length === 2 && e.terms.includes(n);
const other = (e: Expr, n: number) => (e.terms[0] === n ? e.terms[1] : e.terms[0]);

export const plusZero: Strategy = {
  id: 'plus-zero',
  name: 'Adding zero',
  label: 'Plus 0',
  op: '+',
  tier: 2,
  description: 'Adding 0 changes nothing.',
  applies: (e) => e.op === '+' && has(e, 0),
  slips: [{ id: 'zero-as-one', label: 'I added 1 instead of 0' }],
  run(e, slip) {
    const n = other(e, 0);
    if (slip === 'zero-as-one') return [plan('Adding 0 adds one more', { slip: true }), answer(n + 1)];
    if (slip) return null;
    return [plan('Adding 0 changes nothing'), answer(n)];
  },
};

export const minusZero: Strategy = {
  id: 'minus-zero',
  name: 'Taking away zero',
  label: 'Minus 0',
  op: '-',
  tier: 2,
  description: 'Taking away 0 changes nothing.',
  applies: (e) => e.op === '-' && e.terms.length === 2 && e.terms[1] === 0,
  slips: [{ id: 'zero-is-zero', label: 'I thought taking away 0 makes 0' }],
  run(e, slip) {
    const [a] = e.terms;
    if (slip === 'zero-is-zero') return a === 0 ? null : [plan('Anything minus 0 is 0', { slip: true }), answer(0)];
    if (slip) return null;
    return [plan('Taking away 0 changes nothing'), answer(a)];
  },
};

export const timesOneOrZero: Strategy = {
  id: 'times-one-zero',
  name: 'Multiplying by 1 or 0',
  label: '×1 and ×0',
  op: '×',
  tier: 2,
  description: '×1 keeps the number; ×0 always makes 0.',
  applies: (e) => e.op === '×' && (has(e, 0) || has(e, 1)),
  slips: [
    { id: 'times-zero-same', label: 'I thought ×0 leaves the number the same' },
    { id: 'times-one-is-one', label: 'I thought ×1 makes 1' },
  ],
  run(e, slip) {
    if (has(e, 0)) {
      const n = other(e, 0);
      if (slip === 'times-zero-same') return n === 0 ? null : [plan('×0 leaves it the same, like +0', { slip: true }), answer(n)];
      if (slip) return null;
      return [plan('Anything × 0 is 0'), answer(0)];
    }
    const n = other(e, 1);
    if (slip === 'times-one-is-one') return n === 1 ? null : [plan('Anything × 1 is 1', { slip: true }), answer(1)];
    if (slip) return null;
    return [plan(`1 group of ${n} is ${n}`), answer(n)];
  },
};

export const divideByOne: Strategy = {
  id: 'divide-one',
  name: 'Dividing by 1',
  label: '÷1',
  op: '÷',
  tier: 2,
  description: 'Sharing into 1 group leaves the number the same.',
  applies: (e) => e.op === '÷' && e.terms.length === 2 && e.terms[1] === 1,
  slips: [{ id: 'divide-one-is-one', label: 'I thought ÷1 makes 1' }],
  run(e, slip) {
    const [a] = e.terms;
    if (slip === 'divide-one-is-one') return a === 1 ? null : [plan('Anything ÷ 1 is 1', { slip: true }), answer(1)];
    if (slip) return null;
    return [plan(`${a} shared into 1 group is ${a}`), answer(a)];
  },
};

export const SPECIAL: Strategy[] = [plusZero, minusZero, timesOneOrZero, divideByOne];
