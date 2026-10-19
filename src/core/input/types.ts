/**
 * Device-agnostic input model.
 *
 * Physical inputs (a key, a gamepad button, a tap) are translated into
 * semantic *actions* by a ControlScheme. Game modules only ever see actions,
 * so every module works with every device, and each module can define its own
 * bindings.
 */

export type InputDevice = 'keyboard' | 'gamepad' | 'touch' | 'mouse' | 'pen';

export type NavDirection = 'up' | 'down' | 'left' | 'right';

/** Actions shared by every screen (menus, pause, focus navigation). */
export type CoreAction =
  | { type: 'nav'; dir: NavDirection }
  | { type: 'confirm' }
  | { type: 'back' }
  | { type: 'pause' };

/**
 * A module-defined action. `type` is namespaced by convention
 * (e.g. "math.digit") and `value` carries an optional payload.
 */
export interface ModuleAction {
  type: string;
  value?: number | string;
}

export type Action = CoreAction | ModuleAction;

export interface ActionEvent {
  action: Action;
  device: InputDevice;
  /** High-resolution timestamp (performance.now()). */
  t: number;
  /** The raw input that produced it, e.g. "Key:Enter" or "Pad:0". */
  source: string;
}

/** Standard Gamepad API button indices (https://w3c.github.io/gamepad/#remapping). */
export const PadButton = {
  A: 0,
  B: 1,
  X: 2,
  Y: 3,
  LB: 4,
  RB: 5,
  LT: 6,
  RT: 7,
  Back: 8,
  Start: 9,
  LStick: 10,
  RStick: 11,
  Up: 12,
  Down: 13,
  Left: 14,
  Right: 15,
} as const;

export interface ControlScheme {
  id: string;
  /** Keyed by KeyboardEvent.key (case-sensitive, e.g. "Enter", "a", "7"). */
  keyboard: Record<string, Action>;
  /** Keyed by standard gamepad button index. */
  gamepadButtons: Record<number, Action>;
  /** When true the left stick emits nav actions. */
  stickAsNav: boolean;
  /** Human-readable help shown in the UI, per device. */
  help: Partial<Record<InputDevice, string[]>>;
}

/** Bindings used outside of games (menus etc). Modules usually extend this. */
export const baseScheme: ControlScheme = {
  id: 'base',
  keyboard: {
    ArrowUp: { type: 'nav', dir: 'up' },
    ArrowDown: { type: 'nav', dir: 'down' },
    ArrowLeft: { type: 'nav', dir: 'left' },
    ArrowRight: { type: 'nav', dir: 'right' },
    Enter: { type: 'confirm' },
    ' ': { type: 'confirm' },
    Escape: { type: 'back' },
  },
  gamepadButtons: {
    [PadButton.Up]: { type: 'nav', dir: 'up' },
    [PadButton.Down]: { type: 'nav', dir: 'down' },
    [PadButton.Left]: { type: 'nav', dir: 'left' },
    [PadButton.Right]: { type: 'nav', dir: 'right' },
    [PadButton.A]: { type: 'confirm' },
    [PadButton.B]: { type: 'back' },
    [PadButton.Start]: { type: 'pause' },
  },
  stickAsNav: true,
  help: {},
};

export function extendScheme(
  base: ControlScheme,
  patch: Partial<Omit<ControlScheme, 'keyboard' | 'gamepadButtons'>> & {
    keyboard?: Record<string, Action>;
    gamepadButtons?: Record<number, Action>;
  },
): ControlScheme {
  return {
    ...base,
    ...patch,
    keyboard: { ...base.keyboard, ...patch.keyboard },
    gamepadButtons: { ...base.gamepadButtons, ...patch.gamepadButtons },
    help: { ...base.help, ...patch.help },
  };
}
