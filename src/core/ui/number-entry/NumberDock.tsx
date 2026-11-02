import type { InputDevice } from '../../input/types';
import '../game.css';
import { RadialDial } from './Dial';
import { Keypad } from './Keypad';

/**
 * Answer box + the right input for the device, shared by all math games:
 * - touch/mouse: on-screen keypad
 * - controller: radial number dial (stick points, A types, X deletes, Y sends)
 * - keyboard: just the answer box
 */
export function NumberDock({
  value,
  wrongKey,
  disabled,
  lastDevice,
  dial,
  dialFlash,
  pressed,
  onKeypadPress,
  onDialPick,
  label = 'ANSWER',
  className = '',
}: {
  value: string;
  /** Changes on every wrong answer (shakes the box); null when not wrong. */
  wrongKey: string | number | null;
  disabled: boolean;
  lastDevice: InputDevice;
  dial: number;
  dialFlash: number | null;
  pressed: number | null;
  onKeypadPress: (i: number, dev: InputDevice) => void;
  onDialPick: (digit: number, dev: InputDevice) => void;
  label?: string;
  className?: string;
}) {
  const mode = lastDevice === 'gamepad' ? 'dial' : lastDevice === 'keyboard' ? 'compact' : 'keypad';
  return (
    <div className={`mm-dock mm-dock--${mode} ${className}`}>
      <div className={`mm-answer ${wrongKey !== null ? 'is-wrong' : ''}`} key={wrongKey ?? 'a'}>
        <span className="mm-answer__label">{label}</span>
        <span className="mm-answer__value">{value || <span className="mm-answer__placeholder">?</span>}</span>
      </div>
      {mode === 'keypad' && <Keypad cursor={null} pressed={pressed} disabled={disabled} onPress={onKeypadPress} />}
      {mode === 'dial' && <RadialDial value={dial} flash={dialFlash} onPick={onDialPick} />}
    </div>
  );
}
