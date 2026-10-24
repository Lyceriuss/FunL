import { describe, expect, it } from 'vitest';
import { dialDigitAt, rotateDial } from '../dialLayout';

describe('radial dial', () => {
  it('maps stick angles to digits: 0 at the top, clockwise, 36° apart', () => {
    expect(dialDigitAt(0)).toBe(0);
    expect(dialDigitAt(36)).toBe(1);
    expect(dialDigitAt(90)).toBe(3); // right: between 2 (72°) and 3 (108°), nearer 3? 90 rounds to 2.5 → 3
    expect(dialDigitAt(180)).toBe(5); // straight down
    expect(dialDigitAt(270)).toBe(8); // left: 7.5 → 8
    expect(dialDigitAt(350)).toBe(0); // just left of the top wraps to 0
    expect(dialDigitAt(-36)).toBe(9);
  });

  it('turns with wrap-around', () => {
    expect(rotateDial(9, 1)).toBe(0);
    expect(rotateDial(0, -1)).toBe(9);
  });
});
