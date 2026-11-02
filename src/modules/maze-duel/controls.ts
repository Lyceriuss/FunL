import { baseScheme, extendScheme, PadButton, type Action } from '../../core/input/types';
import { NumberAction } from '../../core/ui/number-entry/actions';

/** Actions while spending a piece. */
export const DuelAction = {
  place: { type: 'duel.place' } as Action,
  mode: { type: 'duel.mode' } as Action,
  back: { type: 'duel.back' } as Action,
};

const digitKeys: Record<string, Action> = {};
for (let d = 0; d <= 9; d++) digitKeys[String(d)] = NumberAction.digit(d);

/**
 * Answering an equation (same as every math game):
 * keyboard digits/Backspace/Enter; controller radial dial (stick points,
 * A types, X deletes, Y sends); in this stage the stick drives the dial.
 */
export const answerControls = extendScheme(baseScheme, {
  id: 'maze-duel.answer',
  keyboard: {
    ...digitKeys,
    Backspace: NumberAction.backspace,
    Delete: NumberAction.backspace,
    Enter: NumberAction.submit,
    ' ': NumberAction.submit,
    Escape: { type: 'pause' },
    p: { type: 'pause' },
  },
  gamepadButtons: {
    [PadButton.A]: NumberAction.press,
    [PadButton.X]: NumberAction.backspace,
    [PadButton.B]: NumberAction.backspace,
    [PadButton.Y]: NumberAction.submit,
    [PadButton.RT]: NumberAction.submit,
    [PadButton.Start]: { type: 'pause' },
  },
  stickAsNav: false,
  help: {
    keyboard: ['0–9 type the answer, Enter sends', 'Then arrows pick a square, Enter places', 'Tab: build ↔ stone, Backspace: step back'],
    gamepad: ['Dial: stick points, A types, X deletes, Y sends', 'Then stick/D-pad picks a square, A places', 'X: build ↔ stone, B: step back'],
    touch: ['Tap the numbers, ✓ sends', 'Then tap a glowing square'],
  },
});

/**
 * Spending a piece: arrows / stick / D-pad point at a square next to the
 * path head, Enter / A places, Tab / X switches build ↔ stone, Backspace /
 * B steps back.
 */
export const pieceControls = extendScheme(baseScheme, {
  id: 'maze-duel.piece',
  keyboard: {
    w: { type: 'nav', dir: 'up' },
    a: { type: 'nav', dir: 'left' },
    s: { type: 'nav', dir: 'down' },
    d: { type: 'nav', dir: 'right' },
    Enter: DuelAction.place,
    ' ': DuelAction.place,
    Tab: DuelAction.mode,
    m: DuelAction.mode,
    Backspace: DuelAction.back,
    Escape: { type: 'pause' },
    p: { type: 'pause' },
  },
  gamepadButtons: {
    [PadButton.A]: DuelAction.place,
    [PadButton.Y]: DuelAction.place,
    [PadButton.X]: DuelAction.mode,
    [PadButton.B]: DuelAction.back,
    [PadButton.Start]: { type: 'pause' },
  },
  stickAsNav: true,
  help: answerControls.help,
});
