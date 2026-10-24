/** Radial number dial geometry: 0–9 around a circle, 0 at the top, clockwise. */

export const DIAL_DIGITS = 10;
export const DIAL_STEP = 360 / DIAL_DIGITS;
/** Stick must be pushed at least this far to pick a number. */
export const DIAL_DEADZONE = 0.5;

/** Digit the stick points at, for an angle in degrees (0 = up, clockwise). */
export function dialDigitAt(angle: number): number {
  return Math.round(((angle % 360) + 360) % 360 / DIAL_STEP) % DIAL_DIGITS;
}

export function rotateDial(digit: number, by: number): number {
  return (((digit + by) % DIAL_DIGITS) + DIAL_DIGITS) % DIAL_DIGITS;
}
