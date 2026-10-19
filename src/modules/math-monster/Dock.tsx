import type { InputDevice } from '../../core/input/types';
import type { EngineState } from './engine';
import { Keypad } from './Keypad';

/**
 * Bottom-left answer box + on-screen keypad, shared by all modes. The keypad
 * hides while a physical keyboard is in use.
 */
export function AnswerDock({
  state,
  lastDevice,
  cursor,
  pressed,
  onKeypadPress,
}: {
  state: EngineState;
  lastDevice: InputDevice;
  cursor: number;
  pressed: number | null;
  onKeypadPress: (i: number, dev: InputDevice) => void;
}) {
  const latest = state.effects[state.effects.length - 1];
  const wrong = latest?.outcome === 'wrong' && state.time - latest.at < 400;
  const showKeypad = lastDevice !== 'keyboard';
  return (
    <div className={`mm-dock ${showKeypad ? '' : 'mm-dock--compact'}`}>
      <div className={`mm-answer ${wrong ? 'is-wrong' : ''}`} key={wrong ? latest.id : 'a'}>
        <span className="mm-answer__label">ANSWER</span>
        <span className="mm-answer__value">{state.input || <span className="mm-answer__placeholder">?</span>}</span>
      </div>
      {showKeypad && (
        <Keypad
          cursor={lastDevice === 'gamepad' ? cursor : null}
          pressed={pressed}
          disabled={state.phase !== 'playing'}
          onPress={onKeypadPress}
        />
      )}
    </div>
  );
}
