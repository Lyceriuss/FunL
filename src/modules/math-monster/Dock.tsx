import type { InputDevice } from '../../core/input/types';
import { RadialDial } from './Dial';
import type { EngineState } from './engine';
import { Keypad } from './Keypad';

/**
 * Bottom-left answer box + input, shared by all modes:
 * - touch/mouse: on-screen keypad
 * - controller: radial number dial (stick points, A types, X deletes, Y sends)
 * - keyboard: just the answer box
 */
export function AnswerDock({
  state,
  lastDevice,
  dial,
  dialFlash,
  pressed,
  onKeypadPress,
  onDialPick,
}: {
  state: EngineState;
  lastDevice: InputDevice;
  dial: number;
  dialFlash: number | null;
  pressed: number | null;
  onKeypadPress: (i: number, dev: InputDevice) => void;
  onDialPick: (digit: number, dev: InputDevice) => void;
}) {
  const latest = state.effects[state.effects.length - 1];
  const wrong = latest?.outcome === 'wrong' && state.time - latest.at < 400;
  const mode = lastDevice === 'gamepad' ? 'dial' : lastDevice === 'keyboard' ? 'compact' : 'keypad';
  return (
    <div className={`mm-dock mm-dock--${mode}`}>
      <div className={`mm-answer ${wrong ? 'is-wrong' : ''}`} key={wrong ? latest.id : 'a'}>
        <span className="mm-answer__label">ANSWER</span>
        <span className="mm-answer__value">{state.input || <span className="mm-answer__placeholder">?</span>}</span>
      </div>
      {mode === 'keypad' && (
        <Keypad cursor={null} pressed={pressed} disabled={state.phase !== 'playing'} onPress={onKeypadPress} />
      )}
      {mode === 'dial' && <RadialDial value={dial} flash={dialFlash} onPick={onDialPick} />}
    </div>
  );
}
