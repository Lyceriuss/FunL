import { baseScheme, extendScheme, PadButton, type Action } from '../../core/input/types';

/** Module actions. The on-screen keypad dispatches the same ones on touch. */
export const MathAction = {
  digit: (value: number): Action => ({ type: 'math.digit', value }),
  backspace: { type: 'math.backspace' } as Action,
  submit: { type: 'math.submit' } as Action,
  /** Controller: type the digit selected on the radial dial. */
  press: { type: 'math.press' } as Action,
};

const digitKeys: Record<string, Action> = {};
for (let d = 0; d <= 9; d++) digitKeys[String(d)] = MathAction.digit(d);

/**
 * Keyboard: type digits, Backspace to erase, Enter to fire, Esc/P to pause.
 * Controller: radial number dial: point the left stick at a number (D-pad
 * turns the dial), A types it, X deletes, Y sends (RT also sends, B also
 * deletes), Start pauses. In-game the stick drives the dial, not navigation.
 */
export const mathControls = extendScheme(baseScheme, {
  id: 'math-monster',
  keyboard: {
    ...digitKeys,
    Backspace: MathAction.backspace,
    Delete: MathAction.backspace,
    Enter: MathAction.submit,
    ' ': MathAction.submit,
    Escape: { type: 'pause' },
    p: { type: 'pause' },
  },
  gamepadButtons: {
    [PadButton.A]: MathAction.press,
    [PadButton.X]: MathAction.backspace,
    [PadButton.B]: MathAction.backspace,
    [PadButton.Y]: MathAction.submit,
    [PadButton.RT]: MathAction.submit,
    [PadButton.Start]: { type: 'pause' },
  },
  stickAsNav: false,
  help: {
    keyboard: ['0–9 type the answer', 'Enter fires', 'Backspace erases', 'Esc pauses'],
    gamepad: ['Left stick points at a number on the dial (D-pad turns it)', 'A types the number', 'X deletes', 'Y sends the answer', 'Start pauses'],
    touch: ['Tap the numbers', 'Tap ✓ to fire', 'Tap ⌫ to erase'],
  },
});
