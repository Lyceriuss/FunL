import { answer, calc, onesOf, plan, recall, tensOf } from './steps';
import type { Expr, Step, Strategy } from './types';

const two = (e: Expr) => e.op === '+' && e.terms.length === 2;
const ordered = (e: Expr) => {
  const [a, b] = e.terms;
  return a >= b ? { big: a, small: b } : { big: b, small: a };
};

/** 3 + 2 = 3 + 1 + 1: count on from the bigger number, one at a time. */
export const countOn: Strategy = {
  id: 'count-on',
  name: 'Counting on',
  label: 'Count on',
  op: '+',
  tier: 1,
  description: 'Start at the bigger number and count on one at a time.',
  applies: (e) => two(e) && ordered(e).small >= 1 && ordered(e).small <= 4 && ordered(e).big <= 99,
  slips: [
    { id: 'counted-start', label: 'I counted the number I started on' },
    { id: 'extra-count', label: 'I counted one too many' },
  ],
  run(e, slip) {
    const { big, small } = ordered(e);
    const steps: Step[] = [];
    if (small > 1) steps.push(plan(`${big} + ${small} = ${big} + ${Array(small).fill(1).join(' + ')}`));
    let cur = big;
    for (let i = 0; i < small; i++) {
      if (slip === 'counted-start' && i === 0) {
        // Says the start number again: "3 + 1 = 3".
        steps.push(calc([cur, 1], '+', cur, { slip: true }));
        continue;
      }
      steps.push(calc([cur, 1], '+', cur + 1));
      cur++;
    }
    if (slip === 'extra-count') {
      steps.push(calc([cur, 1], '+', cur + 1, { slip: true }));
      cur++;
    } else if (slip && slip !== 'counted-start') return null;
    return steps;
  },
};

/** 6 + 7 = 6 + 6 + 1: use a double you know. */
export const doubles: Strategy = {
  id: 'doubles',
  name: 'Doubles and near doubles',
  label: 'Doubles',
  op: '+',
  tier: 2,
  description: 'Use a known double (6 + 6), then adjust by one.',
  applies: (e) => {
    if (!two(e)) return false;
    const { big, small } = ordered(e);
    return small >= 2 && big <= 20 && big - small <= 1;
  },
  slips: [
    { id: 'double-wrong', label: 'I got the double wrong' },
    { id: 'adjust-wrong-way', label: 'I went down by one instead of up' },
  ],
  run(e, slip) {
    const { big, small } = ordered(e);
    const d = small * 2;
    if (big === small) {
      if (slip === 'double-wrong') return [calc([small, small], '+', d + 2, { slip: true })];
      if (slip) return null;
      return [plan(`Double ${small}`), calc([small, small], '+', d)];
    }
    const steps: Step[] = [plan(`${small} + ${big} = ${small} + ${small} + 1`)];
    const dv = slip === 'double-wrong' ? d - 1 : d;
    steps.push(calc([small, small], '+', dv, { note: true, slip: slip === 'double-wrong' }));
    if (slip === 'adjust-wrong-way') steps.push(calc([dv, 1], '-', dv - 1, { slip: true }));
    else if (slip && slip !== 'double-wrong') return null;
    else steps.push(calc([dv, 1], '+', dv + 1));
    return steps;
  },
};

/** 8 + 5: 8 needs 2 to make 10, 5 = 2 + 3, 10 + 3 = 13. */
export const makeTen: Strategy = {
  id: 'make-ten',
  name: 'Bridging through ten',
  label: 'Make 10',
  op: '+',
  tier: 2,
  description: 'Fill up to 10 first, then add what is left.',
  applies: (e) => {
    if (!two(e)) return false;
    const { big, small } = ordered(e);
    return big <= 9 && small >= 1 && big + small > 10;
  },
  slips: [
    { id: 'wrong-complement', label: (e) => `I thought ${ordered(e).big} needed ${11 - ordered(e).big} to make 10` },
    { id: 'last-bit', label: 'I added the last bit wrong' },
  ],
  run(e, slip) {
    const { big, small } = ordered(e);
    let need = 10 - big;
    if (slip === 'wrong-complement') {
      need += 1;
      if (need > small) return null;
    } else if (slip && slip !== 'last-bit') return null;
    const rest = small - need;
    const wrongNeed = slip === 'wrong-complement';
    return [
      plan(`${big} needs ${need} to make 10`, { slip: wrongNeed }),
      plan(`${small} = ${need} + ${rest}`),
      // With the wrong complement the child still believes this makes 10.
      calc([big, need], '+', 10, { note: true, slip: wrongNeed }),
      slip === 'last-bit' ? calc([10, rest], '+', 10 + rest - 1, { slip: true }) : calc([10, rest], '+', 10 + rest),
    ];
  },
};

function findTenPair(terms: number[]): [number, number] | null {
  for (let i = 0; i < terms.length; i++) {
    for (let j = i + 1; j < terms.length; j++) {
      const s = terms[i] + terms[j];
      if (s > 0 && s % 10 === 0) return [i, j];
    }
  }
  return null;
}

function tenPairParts(e: Expr): { x: number; y: number; rest: number[] } {
  const [i, j] = findTenPair(e.terms) ?? [0, 1];
  return { x: e.terms[i], y: e.terms[j], rest: e.terms.filter((_, k) => k !== i && k !== j) };
}

/** 3 + 6 + 4: spot 6 + 4 = 10 first, then add the 3. */
export const tenPair: Strategy = {
  id: 'ten-pair',
  name: 'Grouping to make ten (associativity)',
  label: 'Find a 10',
  op: '+',
  tier: 3,
  description: 'Look for numbers that make 10 together, add those first, then the rest.',
  applies: (e) => e.op === '+' && e.terms.length >= 3 && findTenPair(e.terms) !== null,
  slips: [
    { id: 'forgot-term', label: (e) => `I forgot to add the ${tenPairParts(e).rest.join(' and ')}` },
    { id: 'pair-wrong', label: (e) => `I added ${tenPairParts(e).x} + ${tenPairParts(e).y} wrong` },
  ],
  run(e, slip) {
    const pair = findTenPair(e.terms);
    if (!pair) return null;
    const [i, j] = pair;
    const x = e.terms[i];
    const y = e.terms[j];
    const rest = e.terms.filter((_, k) => k !== i && k !== j);
    if (slip && slip !== 'forgot-term' && slip !== 'pair-wrong') return null;
    const pv = slip === 'pair-wrong' ? x + y + 1 : x + y;
    const steps: Step[] = [plan(`Look for a 10: ${x} + ${y}`), calc([x, y], '+', pv, { note: true, slip: slip === 'pair-wrong' })];
    if (slip === 'forgot-term') {
      steps.push(answer(pv, `So it's ${pv}`, { slip: true }));
      return steps;
    }
    let acc = pv;
    rest.forEach((r, k) => {
      steps.push(calc([acc, r], '+', acc + r, { note: k < rest.length - 1 }));
      acc += r;
    });
    return steps;
  },
};

/** 3 + 6 + 4 = 9 + 4 = 13: just go left to right. */
export const leftToRight: Strategy = {
  id: 'left-to-right',
  name: 'Adding in order',
  label: 'One at a time',
  op: '+',
  tier: 1,
  description: 'Add the numbers in order, keeping a running total.',
  applies: (e) => e.op === '+' && e.terms.length >= 3,
  slips: [{ id: 'step-slip', label: 'I made a mistake on the way' }],
  run(e, slip, rng = Math.random) {
    if (slip && slip !== 'step-slip') return null;
    const n = e.terms.length - 1;
    const bad = slip ? Math.floor(rng() * n) : -1;
    const steps: Step[] = [];
    let acc = e.terms[0];
    for (let k = 1; k <= n; k++) {
      const t = e.terms[k];
      const v = k - 1 === bad ? acc + t + (rng() < 0.5 && acc + t > 0 ? -1 : 1) : acc + t;
      steps.push(calc([acc, t], '+', v, { note: k < n, slip: k - 1 === bad }));
      acc = v;
    }
    return steps;
  },
};

/** 47 + 38: 40 + 30 = 70, 7 + 8 = 15, 70 + 15 = 85. */
export const splitTens: Strategy = {
  id: 'split-tens',
  name: 'Partitioning into tens and ones',
  label: 'Tens and ones',
  op: '+',
  tier: 3,
  description: 'Add the tens, add the ones, then put them together.',
  applies: (e) => two(e) && e.terms.every((t) => t >= 10 && t < 100),
  slips: [
    { id: 'dropped-ten', label: (e) => `I forgot the ten inside ${onesOf(e.terms[0]) + onesOf(e.terms[1])}` },
    { id: 'tens-wrong', label: 'I added the tens wrong' },
  ],
  run(e, slip) {
    const [a, b] = e.terms;
    const T = tensOf(a) + tensOf(b);
    const O = onesOf(a) + onesOf(b);
    if (slip === 'dropped-ten' && O < 10) return null;
    if (slip && slip !== 'dropped-ten' && slip !== 'tens-wrong') return null;
    const tv = slip === 'tens-wrong' ? T + 10 : T;
    const steps: Step[] = [
      plan(`${a} = ${tensOf(a)} + ${onesOf(a)}, ${b} = ${tensOf(b)} + ${onesOf(b)}`),
      calc([tensOf(a), tensOf(b)], '+', tv, { note: true, slip: slip === 'tens-wrong' }),
      calc([onesOf(a), onesOf(b)], '+', O, { note: true }),
    ];
    if (slip === 'dropped-ten') steps.push(calc([tv, O - 10], '+', tv + O - 10, { slip: true }));
    else steps.push(calc([tv, O], '+', tv + O));
    return steps;
  },
};

/** 47 + 38: 47 + 30 = 77, 77 + 8 = 85 (jumps on a number line). */
export const jump: Strategy = {
  id: 'jump',
  name: 'Jumping on the number line',
  label: 'Jumps',
  op: '+',
  tier: 2,
  description: 'Keep the bigger number, jump on by the tens, then the ones (via the next ten).',
  applies: (e) => two(e) && ordered(e).big >= 10 && ordered(e).big < 100 && ordered(e).small >= 1,
  slips: [{ id: 'jump-wrong', label: 'I jumped the wrong amount' }],
  run(e, slip) {
    if (slip && slip !== 'jump-wrong') return null;
    const { big, small } = ordered(e);
    const tens = tensOf(small);
    const ones = onesOf(small);
    const steps: Step[] = [];
    let cur = big;
    let slipped = false;
    if (tens > 0) {
      const v = slip ? cur + tens + 10 : cur + tens;
      slipped = !!slip;
      steps.push(calc([cur, tens], '+', v, { note: ones > 0, slip: !!slip }));
      cur = v;
    }
    if (ones > 0) {
      const toTen = 10 - onesOf(cur);
      if (onesOf(cur) !== 0 && ones > toTen) {
        // Bridge: 77 + 8 = 77 + 3 + 5.
        const next = cur + toTen;
        steps.push(calc([cur, toTen], '+', next, { note: true }));
        const v = slip && !slipped ? next + (ones - toTen) + 1 : next + (ones - toTen);
        steps.push(calc([next, ones - toTen], '+', v, { slip: !!slip && !slipped }));
        slipped = slipped || !!slip;
        cur = v;
      } else {
        const v = slip && !slipped ? cur + ones + 1 : cur + ones;
        steps.push(calc([cur, ones], '+', v, { slip: !!slip && !slipped }));
        slipped = slipped || !!slip;
        cur = v;
      }
    }
    return steps;
  },
};

/** 3 + 4 = 7: a fact you just know. */
export const recallAdd: Strategy = {
  id: 'recall-add',
  name: 'Known fact',
  label: 'I know it',
  op: '+',
  tier: 3,
  description: 'Remember the answer straight away (number bonds, facts to 20).',
  applies: (e) => two(e) && e.terms.every((t) => t <= 10),
  slips: [{ id: 'near-fact', label: 'I remembered it wrong' }],
  run(e, slip) {
    const [a, b] = e.terms;
    if (slip === 'near-fact') return [recall([a, b], '+', a + b + 1, { slip: true })];
    if (slip) return null;
    return [recall([a, b], '+', a + b)];
  },
};

export const ADDITION: Strategy[] = [countOn, leftToRight, doubles, makeTen, jump, tenPair, splitTens, recallAdd];
