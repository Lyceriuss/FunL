import type { InputDevice } from '../../core/input/types';
import { NumberDock } from '../../core/ui/number-entry/NumberDock';
import type { EngineState } from './engine';

/** Math Monster's answer dock: the shared NumberDock fed from the engine state. */
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
  return (
    <NumberDock
      value={state.input}
      wrongKey={wrong ? latest.id : null}
      disabled={state.phase !== 'playing'}
      lastDevice={lastDevice}
      dial={dial}
      dialFlash={dialFlash}
      pressed={pressed}
      onKeypadPress={onKeypadPress}
      onDialPick={onDialPick}
    />
  );
}
