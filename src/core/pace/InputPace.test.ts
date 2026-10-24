import { describe, expect, it } from 'vitest';
import { ALLOWANCE_MARGIN, InputPace, priorMs } from './InputPace';

describe('InputPace', () => {
  it('starts from device priors: a keyboard player gets no extra time, the dial does', () => {
    const p = new InputPace();
    expect(p.expected('keyboard', 2)).toBe(priorMs('keyboard', 2));
    expect(p.allowance('keyboard', 2)).toBe(0);
    expect(p.allowance('gamepad', 1)).toBeGreaterThan(0);
    expect(p.allowance('gamepad', 2)).toBeGreaterThan(p.allowance('gamepad', 1));
  });

  it('learns a player\'s real pace as a median of recent answers', () => {
    const p = new InputPace();
    for (const ms of [2600, 2400, 2500, 2700, 2500]) p.observe('gamepad', 1, ms);
    expect(p.expected('gamepad', 1)).toBe(2500);
    expect(p.row('gamepad', 1).source).toBe('measured');
    expect(p.allowance('gamepad', 1)).toBe(Math.round((2500 - priorMs('keyboard', 1)) * ALLOWANCE_MARGIN));
  });

  it('ignores impossible and distracted samples', () => {
    const p = new InputPace();
    for (const ms of [1000, 1100, 900]) p.observe('touch', 1, ms);
    expect(p.observe('touch', 1, 50)).toBe(false); // too fast to be real
    expect(p.observe('touch', 1, 9000)).toBe(false); // looked away
    expect(p.expected('touch', 1)).toBe(1000);
  });

  it('estimates unmeasured lengths from measured ones on the same device', () => {
    const p = new InputPace();
    for (const ms of [3000, 3000, 3000]) p.observe('gamepad', 1, ms); // slower than the prior 2200
    const est = p.row('gamepad', 2);
    expect(est.source).toBe('estimated');
    expect(est.expectedMs).toBeGreaterThan(priorMs('gamepad', 2)); // slow at 1 digit → slow at 2
  });

  it('a fast player never gets negative allowance, and allowance is capped', () => {
    const fast = new InputPace();
    for (const ms of [300, 320, 310]) fast.observe('keyboard', 2, ms);
    expect(fast.allowance('keyboard', 2)).toBe(0);
    const slow = new InputPace();
    for (const ms of [15000, 15000, 15000]) slow.observe('pen', 3, ms);
    expect(slow.allowance('pen', 3)).toBe(8000);
  });

  it('keeps only recent samples and round-trips through JSON', () => {
    const p = new InputPace();
    for (let i = 0; i < 30; i++) p.observe('keyboard', 1, 800 + i);
    expect(p.samplesOf('keyboard', 1)).toHaveLength(15);
    const q = new InputPace(JSON.parse(JSON.stringify(p.toJSON())));
    expect(q.expected('keyboard', 1)).toBe(p.expected('keyboard', 1));
  });
});
