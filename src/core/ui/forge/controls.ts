import { baseScheme, extendScheme, PadButton, type Action } from '../../input/types';

/** Actions on a Forge board (shared by every game that uses forge puzzles). */
export const ForgeAction = {
  /** A: pick up the piece at the cursor / drop the held piece at the cursor. */
  primary: { type: 'forge.a' } as Action,
  /** X: put the held piece back, or send a placed piece back to the tray. */
  secondary: { type: 'forge.x' } as Action,
  /** Y: check the row. */
  check: { type: 'forge.y' } as Action,
  /** Keyboard shortcut: pick the piece showing this symbol. */
  quick: (symbol: string): Action => ({ type: 'forge.key', value: symbol }),
};

const quickKeys: Record<string, Action> = {};
for (const k of ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '+', '-', '*', '/', 'x', '(', ')']) quickKeys[k] = ForgeAction.quick(k);

/**
 * Forge controls.
 * Controller: stick / D-pad move, A picks up / places, X puts back, Y checks.
 * Keyboard: arrows move, Enter picks up / places, Backspace puts back,
 * Space or = checks; typing a number or sign (+ - * / x ( )) picks that piece.
 * Touch: tap a piece, then tap where it goes; ✓ checks.
 */
export const forgeControls = extendScheme(baseScheme, {
  id: 'forge',
  keyboard: {
    ...quickKeys,
    Enter: ForgeAction.primary,
    Backspace: ForgeAction.secondary,
    Delete: ForgeAction.secondary,
    ' ': ForgeAction.check,
    '=': ForgeAction.check,
    Escape: { type: 'pause' },
    p: { type: 'pause' },
  },
  gamepadButtons: {
    [PadButton.A]: ForgeAction.primary,
    [PadButton.X]: ForgeAction.secondary,
    [PadButton.B]: ForgeAction.secondary,
    [PadButton.Y]: ForgeAction.check,
    [PadButton.RT]: ForgeAction.check,
    [PadButton.Start]: { type: 'pause' },
  },
  stickAsNav: true,
  help: {
    keyboard: ['Arrows move, Enter picks up / places', 'Type a number or sign to grab it', 'Backspace puts back, Space checks'],
    gamepad: ['Stick / D-pad move', 'A picks up, A again places', 'X puts back, Y checks'],
    touch: ['Tap a piece, then tap where it goes', 'Tap a placed piece to move it', 'Tap ✓ to check'],
  },
});
