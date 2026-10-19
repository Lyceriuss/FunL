import { answer, calc, onesOf, plan, recall, tensOf } from './steps';
import type { Expr, Step, Strategy } from './types';

const two = (e: Expr) => e.op === '-' && e.terms.length === 2 && e.terms[0] >= e.terms[1];

/** 9 − 2 = 9 − 1 − 1: count back one at a time. */
export const countBack: Strategy = {
  id: 'count-back',
  name: 'Counting back',
  label: 'Count back',
  op: '-',
  tier: 1,
  description: 'Start at the first number and count back one at a time.',
  applies: (e) => two(e) && e.terms[1] >= 1 && e.terms[1] <= 4,
  slips: [
    { id: 'counted-start', label: 'I counted the number I started on' },
    { id: 'extra-count', label: 'I counted back one too many' },
  ],
  run(e, slip) {
    const [a, b] = e.terms;
    if (slip === 'extra-count' && a - b - 1 < 0) return null;
    if (slip && slip !== 'counted-start' && slip !== 'extra-count') return null;
    const steps: Step[] = [];
    if (b > 1) steps.push(plan(`${a} - ${b} = ${a} - ${Array(b).fill(1).join(' - ')}`));
    let cur = a;
    for (let i = 0; i < b; i++) {
      if (slip === 'counted-start' && i === 0) {
        steps.push(calc([cur, 1], '-', cur, { slip: true }));
        continue;
      }
      steps.push(calc([cur, 1], '-', cur - 1));
      cur--;
    }
    if (slip === 'extra-count') steps.push(calc([cur, 1], '-', cur - 1, { slip: true }));
    return steps;
  },
};

/** 13 − 8: 8 + 2 = 10, 10 + 3 = 13, so 2 + 3 = 5 (count up). */
export const thinkAddition: Strategy = {
  id: 'think-addition',
  name: 'Counting up (think addition)',
  label: 'Count up',
  op: '-',
  tier: 2,
  description: 'Turn it round: how much do I add to the small number to reach the big one?',
  applies: (e) => two(e) && e.terms[1] >= 1 && e.terms[0] - e.terms[1] <= 20 && e.terms[0] - e.terms[1] >= 1,
  slips: [
    { id: 'answered-jump', label: (e) => `I only counted from ${Math.ceil(e.terms[1] / 10) * 10}` },
    { id: 'count-up-wrong', label: (e) => `I counted up to ${Math.ceil(e.terms[1] / 10) * 10} wrong` },
  ],
  run(e, slip) {
    const [a, b] = e.terms;
    const ten = Math.ceil(b / 10) * 10;
    const crosses = onesOf(b) !== 0 && ten < a;
    if (!crosses) {
      if (slip) return null;
      return [plan(`${b} + ? = ${a}`), calc([b, a - b], '+', a), answer(a - b)];
    }
    const up1 = ten - b;
    const up2 = a - ten;
    if (slip && slip !== 'answered-jump' && slip !== 'count-up-wrong') return null;
    const u1 = slip === 'count-up-wrong' ? up1 + 1 : up1;
    const steps: Step[] = [
      plan(`${b} + ? = ${a}`),
      calc([b, u1], '+', ten, { note: true, slip: slip === 'count-up-wrong' }),
      calc([ten, up2], '+', a, { note: true }),
    ];
    if (slip === 'answered-jump') steps.push(answer(up2, `So it's ${up2}`, { slip: true }));
    else steps.push(calc([u1, up2], '+', u1 + up2));
    return steps;
  },
};

/** 13 − 5: 13 − 3 = 10, then 10 − 2 = 8 (bridge back through ten). */
export const bridgeBack: Strategy = {
  id: 'bridge-back',
  name: 'Bridging back through ten',
  label: 'Back to 10',
  op: '-',
  tier: 2,
  description: 'Take away just enough to land on a ten, then take away the rest.',
  applies: (e) => two(e) && e.terms[0] > 10 && onesOf(e.terms[0]) > 0 && e.terms[1] < 10 && e.terms[1] > onesOf(e.terms[0]),
  slips: [{ id: 'split-wrong', label: (e) => `I split the ${e.terms[1]} wrong` }],
  run(e, slip) {
    if (slip && slip !== 'split-wrong') return null;
    const [a, b] = e.terms;
    const first = onesOf(a);
    const second = slip ? b - first + 1 : b - first;
    const mid = a - first;
    return [
      plan(`${b} = ${first} + ${second}`, { slip: !!slip }),
      calc([a, first], '-', mid, { note: true }),
      calc([mid, second], '-', mid - second),
    ];
  },
};

/** 64 − 27: 64 − 20 = 44, 44 − 7 = 37 (jump back on the number line). */
export const jumpBack: Strategy = {
  id: 'jump-back',
  name: 'Jumping back',
  label: 'Jump back',
  op: '-',
  tier: 2,
  description: 'Take away the tens first, then the ones.',
  applies: (e) => two(e) && e.terms[0] >= 20 && e.terms[1] >= 10,
  slips: [
    { id: 'forgot-ones', label: (e) => `I forgot to take away the ${onesOf(e.terms[1])}` },
    { id: 'added-ones', label: (e) => `I added the ${onesOf(e.terms[1])} instead of taking it away` },
  ],
  run(e, slip) {
    const [a, b] = e.terms;
    const tens = tensOf(b);
    const ones = onesOf(b);
    if ((slip === 'forgot-ones' || slip === 'added-ones') && ones === 0) return null;
    if (slip && slip !== 'forgot-ones' && slip !== 'added-ones') return null;
    const mid = a - tens;
    const steps: Step[] = [calc([a, tens], '-', mid, { note: ones > 0 })];
    if (slip === 'forgot-ones') steps.push(answer(mid, `So it's ${mid}`, { slip: true }));
    else if (slip === 'added-ones') steps.push(calc([mid, ones], '+', mid + ones, { slip: true }));
    else if (ones > 0) steps.push(calc([mid, ones], '-', mid - ones));
    return steps;
  },
};

/** 64 − 27 in columns: exchange a ten when the ones are too small. */
export const columnSub: Strategy = {
  id: 'column-sub',
  name: 'Column subtraction with exchange',
  label: 'Columns',
  op: '-',
  tier: 3,
  description: 'Tens from tens and ones from ones; if the ones are too small, swap a ten for ten ones.',
  applies: (e) => two(e) && e.terms[0] >= 10 && e.terms[0] < 100 && e.terms[1] >= 10,
  slips: [{ id: 'smaller-from-larger', label: (e) => `I did ${onesOf(e.terms[1])} - ${onesOf(e.terms[0])} instead of ${onesOf(e.terms[0])} - ${onesOf(e.terms[1])}` }],
  run(e, slip) {
    const [a, b] = e.terms;
    const ta = tensOf(a);
    const tb = tensOf(b);
    const oa = onesOf(a);
    const ob = onesOf(b);
    if (slip === 'smaller-from-larger') {
      if (oa >= ob) return null;
      // The classic bug: can't do 4 − 7, so do 7 − 4 instead.
      return [
        calc([ta, tb], '-', ta - tb, { note: true }),
        calc([ob, oa], '-', ob - oa, { note: true, slip: true }),
        calc([ta - tb, ob - oa], '+', ta - tb + ob - oa),
      ];
    }
    if (slip) return null;
    if (oa >= ob) {
      return [
        calc([ta, tb], '-', ta - tb, { note: true }),
        calc([oa, ob], '-', oa - ob, { note: true }),
        calc([ta - tb, oa - ob], '+', a - b),
      ];
    }
    return [
      plan(`${oa} - ${ob}: not enough ones, swap a ten`),
      calc([ta - 10, tb], '-', ta - 10 - tb, { note: true }),
      calc([oa + 10, ob], '-', oa + 10 - ob, { note: true }),
      calc([ta - 10 - tb, oa + 10 - ob], '+', a - b),
    ];
  },
};

/** 95 − 5: only the ones change (5 − 5 = 0), the tens stay 90. */
export const takeOnes: Strategy = {
  id: 'take-ones',
  name: 'Subtracting ones within a ten',
  label: 'Just the ones',
  op: '-',
  tier: 2,
  description: 'When the ones are big enough, only the ones digit changes.',
  applies: (e) => two(e) && e.terms[0] >= 10 && e.terms[0] < 100 && e.terms[1] < 10 && e.terms[1] <= onesOf(e.terms[0]),
  slips: [{ id: 'ones-wrong', label: (e) => `I took ${e.terms[1]} from ${onesOf(e.terms[0])} wrong` }],
  run(e, slip) {
    if (slip && slip !== 'ones-wrong') return null;
    const [a, b] = e.terms;
    const ta = tensOf(a);
    const oa = onesOf(a);
    const ones = slip ? (oa - b > 0 ? oa - b - 1 : oa - b + 1) : oa - b;
    return [calc([oa, b], '-', ones, { note: true, slip: !!slip }), calc([ta, ones], '+', ta + ones)];
  },
};

/** 70 − 6: break a ten: 70 = 60 + 10, 10 − 6 = 4, so 64. */
export const fromTen: Strategy = {
  id: 'from-ten',
  name: 'Subtracting from a whole ten',
  label: 'Break a ten',
  op: '-',
  tier: 2,
  description: 'Take the small number from one of the tens, keep the other tens.',
  applies: (e) => two(e) && e.terms[0] >= 20 && e.terms[0] < 100 && onesOf(e.terms[0]) === 0 && e.terms[1] >= 1 && e.terms[1] <= 9,
  slips: [{ id: 'kept-the-ten', label: 'I forgot that I used up one of the tens' }],
  run(e, slip) {
    if (slip && slip !== 'kept-the-ten') return null;
    const [a, b] = e.terms;
    const keep = slip ? a : a - 10;
    return [
      plan(`${a} = ${a - 10} + 10`),
      calc([10, b], '-', 10 - b, { note: true }),
      calc([keep, 10 - b], '+', keep + 10 - b, { slip: !!slip }),
    ];
  },
};

/** 9 − 4 = 5: a fact you just know. */
export const recallSub: Strategy = {
  id: 'recall-sub',
  name: 'Known fact',
  label: 'I know it',
  op: '-',
  tier: 3,
  description: 'Remember the answer straight away (number bonds).',
  applies: (e) => two(e) && e.terms[0] <= 20 && e.terms[1] <= 10,
  slips: [{ id: 'near-fact', label: 'I remembered it wrong' }],
  run(e, slip) {
    const [a, b] = e.terms;
    if (slip === 'near-fact') {
      const v = a - b > 0 ? a - b - 1 : a - b + 1;
      return [recall([a, b], '-', v, { slip: true })];
    }
    if (slip) return null;
    return [recall([a, b], '-', a - b)];
  },
};

export const SUBTRACTION: Strategy[] = [countBack, thinkAddition, bridgeBack, takeOnes, fromTen, jumpBack, columnSub, recallSub];
