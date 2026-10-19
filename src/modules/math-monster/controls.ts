import { baseScheme, extendScheme, PadButton, type Action } from '../../core/input/types';

/** Module actions. The on-screen keypad dispatches the same ones on touch. */
export const MathAction = {
  digit: (value: number): Action => ({ type: 'math.digit', value }),
  backspace: { type: 'math.backspace' } as Action,
  submit: { type: 'math.submit' } as Action,
  /** Press whichever keypad key has controller focus. */
  press: { type: 'math.press' } as Action,
};

const digitKeys: Record<string, Action> = {};
for (let d = 0; d <= 9; d++) digitKeys[String(d)] = MathAction.digit(d);

/**
 * Keyboard: type digits, Backspace to erase, Enter to fire, Esc/P to pause.
 * Controller: move over the on-screen keypad with D-pad/stick, A presses a
 * key, B/X erase, Y (or RT) fires, Start pauses.
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
    [PadButton.B]: MathAction.backspace,
    [PadButton.X]: MathAction.backspace,
    [PadButton.Y]: MathAction.submit,
    [PadButton.RT]: MathAction.submit,
    [PadButton.Start]: { type: 'pause' },
  },
  help: {
    keyboard: ['0–9 type the answer', 'Enter fires', 'Backspace erases', 'Esc pauses'],
    gamepad: ['D-pad / stick moves on the keypad', 'A presses a key', 'B erases', 'Y or RT fires', 'Start pauses'],
    touch: ['Tap the numbers', 'Tap ✓ to fire', 'Tap ⌫ to erase'],
  },
});
