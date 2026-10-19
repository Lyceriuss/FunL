import type { InputDevice } from '../../core/input/types';
import { KEYPAD_KEYS } from './keypadLayout';

interface Props {
  cursor: number | null;
  pressed: number | null;
  disabled?: boolean;
  onPress: (index: number, device: InputDevice) => void;
}

/**
 * On-screen keypad, used directly by touch/mouse and navigated with a
 * controller cursor. Keyboard presses light up the matching key, so every
 * input method gets the same visual feedback.
 */
export function Keypad({ cursor, pressed, disabled, onPress }: Props) {
  return (
    <div className={`mm-keypad ${disabled ? 'is-disabled' : ''}`} role="group" aria-label="Number pad">
      {KEYPAD_KEYS.map((k, i) => (
        <button
          key={k.hit}
          type="button"
          tabIndex={-1}
          data-hit={k.hit}
          aria-label={k.kind === 'erase' ? 'Erase' : k.kind === 'fire' ? 'Fire' : k.label}
          className={[
            'mm-key',
            k.kind ? `mm-key--${k.kind}` : '',
            pressed === i ? 'is-pressed' : '',
            cursor === i ? 'has-cursor' : '',
          ].join(' ')}
          onPointerDown={(e) => {
            // pointerdown (not click) keeps latency low and lets us log the device.
            e.preventDefault();
            onPress(i, e.pointerType === 'touch' ? 'touch' : e.pointerType === 'pen' ? 'pen' : 'mouse');
          }}
        >
          {k.label}
        </button>
      ))}
    </div>
  );
}
