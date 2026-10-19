import type { Action, NavDirection } from '../../core/input/types';
import { MathAction } from './controls';

export interface KeypadKey {
  label: string;
  hit: string;
  action: Action;
  kind?: 'erase' | 'fire';
}

export const KEYPAD_KEYS: KeypadKey[] = [
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => ({ label: String(d), hit: `key-${d}`, action: MathAction.digit(d) })),
  { label: '⌫', hit: 'key-erase', action: MathAction.backspace, kind: 'erase' as const },
  { label: '0', hit: 'key-0', action: MathAction.digit(0) },
  { label: '✓', hit: 'key-fire', action: MathAction.submit, kind: 'fire' as const },
];
const COLS = 3;
export const KEYPAD_START = 4; // "5", the middle

export function keypadIndexFor(action: Action): number {
  const value = 'value' in action ? action.value : undefined;
  return KEYPAD_KEYS.findIndex((k) => k.action.type === action.type && ('value' in k.action ? k.action.value : undefined) === value);
}

/** Move the controller cursor, wrapping around edges. */
export function moveKeypadCursor(i: number, dir: NavDirection): number {
  const rows = Math.ceil(KEYPAD_KEYS.length / COLS);
  let r = Math.floor(i / COLS);
  let c = i % COLS;
  if (dir === 'up') r = (r - 1 + rows) % rows;
  if (dir === 'down') r = (r + 1) % rows;
  if (dir === 'left') c = (c - 1 + COLS) % COLS;
  if (dir === 'right') c = (c + 1) % COLS;
  return r * COLS + c;
}
