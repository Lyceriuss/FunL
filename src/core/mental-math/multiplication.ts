import { answer, calc, plan, recall } from './steps';
import type { Expr, Step, Strategy } from './types';

const two = (e: Expr, op: '×' | '÷') => e.op === op && e.terms.length === 2;
const SKIP = [10, 5, 2];

/** 3 × 4 = 4 + 4 + 4. */
export const repeatedAdd: Strategy = {
  id: 'repeated-add',
  name: 'Repeated addition',
  label: 'Add again',
  op: '×',
  tier: 1,
  description: 'Add the same number again and again.',
  applies: (e) => two(e, '×') && Math.min(...e.terms) >= 2 && Math.min(...e.terms) <= 4 && Math.max(...e.terms) <= 10,
  slips: [{ id: 'one-too-many', label: (e) => `I added one ${Math.max(...e.terms)} too many` }],
  run(e, slip) {
    if (slip && slip !== 'one-too-many') return null;
    const count = Math.min(...e.terms);
    const size = Math.max(...e.terms);
    const times = slip ? count + 1 : count;
    const steps: Step[] = [plan(`${count} × ${size} = ${Array(count).fill(size).join(' + ')}`)];
    let acc = size;
    for (let i = 1; i < times; i++) {
      steps.push(calc([acc, size], '+', acc + size, { note: i < times - 1, slip: !!slip && i === times - 1 }));
      acc += size;
    }
    return steps;
  },
};

/** 3 × 5: 5, 10, 15. */
export const skipCount: Strategy = {
  id: 'skip-count',
  name: 'Counting in steps',
  label: 'Count in 5s',
  op: '×',
  tier: 1,
  description: 'Count in 2s, 5s or 10s as many times as needed.',
  applies: (e) => two(e, '×') && e.terms.some((t) => SKIP.includes(t)) && Math.max(...e.terms) <= 10 && Math.min(...e.terms) >= 1,
  slips: [{ id: 'extra-jump', label: (e) => `I counted one ${SKIP.find((s) => e.terms.includes(s))} too many` }],
  run(e, slip) {
    if (slip && slip !== 'extra-jump') return null;
    const [a, b] = e.terms;
    const size = SKIP.find((s) => s === a || s === b)!;
    const count = size === a ? b : a;
    const jumps = slip ? count + 1 : count;
    const list = Array.from({ length: jumps }, (_, i) => size * (i + 1));
    return [plan(`Count in ${size}s, ${count} times`), plan(list.join(', '), { slip: !!slip }), answer(list[list.length - 1])];
  },
};

/** 4 × 7: 2 × 7 = 14, double 14 = 28. */
export const doubling: Strategy = {
  id: 'doubling',
  name: 'Doubling',
  label: 'Double it',
  op: '×',
  tier: 2,
  description: '×4 is double, double again; ×8 is double three times.',
  applies: (e) => two(e, '×') && e.terms.some((t) => t === 4 || t === 8) && Math.max(...e.terms) <= 12,
  slips: [{ id: 'double-wrong', label: 'I doubled it wrong' }],
  run(e, slip) {
    if (slip && slip !== 'double-wrong') return null;
    const [a, b] = e.terms;
    const f = a === 4 || a === 8 ? a : b;
    const o = f === a ? b : a;
    const times = f === 4 ? 2 : 3;
    const steps: Step[] = [calc([2, o], '×', 2 * o, { note: true })];
    let v = 2 * o;
    for (let i = 2; i <= times; i++) {
      const last = i === times;
      const wrong = !!slip && last;
      // Typical slip: dropping the carried ten (double 14 = 18) or an off-by-two.
      const nv = wrong ? (v * 2 >= 20 ? v * 2 - 10 : v * 2 + 2) : v * 2;
      steps.push({ ...calc([v, v], '+', nv, { note: !last, slip: wrong }), say: `Double ${v} = ${nv}` });
      v = nv;
    }
    return steps;
  },
};

/** 9 × 7 = 10 × 7 − 7; 5 × 8 = half of 10 × 8. */
export const derivedTen: Strategy = {
  id: 'derived-ten',
  name: 'Derived facts from ×10',
  label: 'Use ×10',
  op: '×',
  tier: 3,
  description: '×9 is ×10 take away one group; ×5 is half of ×10.',
  applies: (e) => two(e, '×') && e.terms.some((t) => t === 9 || t === 5) && Math.max(...e.terms) <= 12,
  slips: [
    { id: 'took-wrong-group', label: (e) => `I took away 9 instead of ${e.terms[0] === 9 ? e.terms[1] : e.terms[0]}` },
    { id: 'half-wrong', label: (e) => `I halved ${10 * (e.terms[0] === 5 ? e.terms[1] : e.terms[0])} wrong` },
  ],
  run(e, slip) {
    const [a, b] = e.terms;
    const f = a === 9 || a === 5 ? a : b;
    const o = f === a ? b : a;
    const ten = 10 * o;
    if (f === 9) {
      if (slip === 'took-wrong-group') {
        if (o === 9) return null;
        return [calc([10, o], '×', ten, { note: true }), calc([ten, 9], '-', ten - 9, { slip: true })];
      }
      if (slip) return null;
      return [calc([10, o], '×', ten, { note: true }), calc([ten, o], '-', ten - o)];
    }
    if (slip === 'half-wrong') {
      return [calc([10, o], '×', ten, { note: true }), { ...calc([ten, 2], '÷', ten / 2 + 5, { slip: true }), say: `Half of ${ten} = ${ten / 2 + 5}` }];
    }
    if (slip) return null;
    return [calc([10, o], '×', ten, { note: true }), { ...calc([ten, 2], '÷', ten / 2), say: `Half of ${ten} = ${ten / 2}` }];
  },
};

/** 12 × 6 = 10 × 6 + 2 × 6 (split a factor into tens and ones: distributive law). */
export const splitFactor: Strategy = {
  id: 'split-factor',
  name: 'Splitting a factor (distributive)',
  label: 'Split it',
  op: '×',
  tier: 3,
  description: 'Split the bigger number into tens and ones, multiply both parts, add them.',
  applies: (e) => two(e, '×') && Math.max(...e.terms) > 10 && Math.max(...e.terms) < 100 && Math.min(...e.terms) >= 1 && Math.min(...e.terms) <= 12,
  slips: [{ id: 'forgot-part', label: (e) => `I forgot the ${Math.max(...e.terms) % 10} × ${Math.min(...e.terms)} part` }],
  run(e, slip) {
    if (slip && slip !== 'forgot-part') return null;
    const big = Math.max(...e.terms);
    const small = Math.min(...e.terms);
    const t = big - (big % 10);
    const o = big % 10;
    if (o === 0 && slip) return null;
    const steps: Step[] = [plan(`${big} × ${small} = ${t} × ${small} + ${o} × ${small}`), calc([t, small], '×', t * small, { note: true })];
    if (slip) {
      steps.push(answer(t * small, `So it's ${t * small}`, { slip: true }));
      return steps;
    }
    if (o === 0) return steps;
    steps.push(calc([o, small], '×', o * small, { note: true }), calc([t * small, o * small], '+', big * small));
    return steps;
  },
};

/** 7 × 8 = 56: a table fact you just know. */
export const recallMul: Strategy = {
  id: 'recall-mul',
  name: 'Known fact',
  label: 'I know it',
  op: '×',
  tier: 3,
  description: 'Remember the times-table fact straight away.',
  applies: (e) => two(e, '×') && e.terms.every((t) => t <= 10),
  slips: [{ id: 'neighbour-fact', label: (e) => `I mixed it up with ${e.terms[0]} × ${e.terms[1] > 1 ? e.terms[1] - 1 : e.terms[1] + 1}` }],
  run(e, slip) {
    const [a, b] = e.terms;
    if (slip === 'neighbour-fact') return [recall([a, b], '×', a * (b > 1 ? b - 1 : b + 1), { slip: true })];
    if (slip) return null;
    return [recall([a, b], '×', a * b)];
  },
};

/** 56 ÷ 8: 8 × ? = 56, 8 × 7 = 56, so 7. */
export const thinkMultiplication: Strategy = {
  id: 'think-multiplication',
  name: 'Inverse: think multiplication',
  label: 'Times backwards',
  op: '÷',
  tier: 2,
  description: 'Which times-table fact makes this number?',
  applies: (e) => two(e, '÷') && e.terms[1] >= 1 && e.terms[1] <= 10 && e.terms[0] / e.terms[1] <= 12,
  slips: [{ id: 'wrong-fact', label: 'I used the wrong times fact' }],
  run(e, slip) {
    if (slip && slip !== 'wrong-fact') return null;
    const [a, b] = e.terms;
    const q = a / b;
    const used = slip ? (q > 1 ? q - 1 : q + 1) : q;
    return [plan(`${b} × ? = ${a}`), calc([b, used], '×', a, { slip: !!slip }), answer(used)];
  },
};

/** 15 ÷ 5: count in 5s up to 15: 5, 10, 15 → 3 jumps. */
export const shareSkip: Strategy = {
  id: 'share-skip',
  name: 'Counting jumps',
  label: 'Count jumps',
  op: '÷',
  tier: 1,
  description: 'Count in steps of the divisor and count how many jumps it takes.',
  applies: (e) => two(e, '÷') && e.terms[1] >= 2 && e.terms[1] <= 10 && e.terms[0] / e.terms[1] <= 6,
  slips: [{ id: 'counted-zero', label: 'I counted the 0 as a jump' }],
  run(e, slip) {
    if (slip && slip !== 'counted-zero') return null;
    const [a, b] = e.terms;
    const q = a / b;
    const list = Array.from({ length: q }, (_, i) => b * (i + 1));
    if (slip) return [plan(`Count in ${b}s to ${a}`), plan(['0', ...list].join(', '), { slip: true }), answer(q + 1, `That's ${q + 1} jumps`)];
    return [plan(`Count in ${b}s to ${a}`), plan(list.join(', ')), answer(q, `That's ${q} jumps`)];
  },
};

export const MULTIPLICATION: Strategy[] = [repeatedAdd, skipCount, doubling, derivedTen, splitFactor, recallMul];
export const DIVISION: Strategy[] = [shareSkip, thinkMultiplication];
