import type { InputDevice } from '../../core/input/types';
import { DIAL_DIGITS, DIAL_STEP } from './dialLayout';

/**
 * Radial number dial for controllers: 0–9 around a circle (0 at the top,
 * clockwise). Point the left stick at a number (or turn with the D-pad),
 * A types it, X deletes, Y sends.
 */

export function RadialDial({
  value,
  flash,
  onPick,
}: {
  value: number;
  flash: number | null;
  /** Mouse/touch on the dial types that digit too. */
  onPick: (digit: number, device: InputDevice) => void;
}) {
  return (
    <div className="mm-dial" role="group" aria-label={`Number dial, ${value} selected`}>
      <div className="mm-dial__needle" style={{ transform: `rotate(${value * DIAL_STEP}deg)` }} aria-hidden />
      {Array.from({ length: DIAL_DIGITS }, (_, d) => {
        const a = ((d * DIAL_STEP - 90) * Math.PI) / 180;
        return (
          <button
            key={d}
            type="button"
            tabIndex={-1}
            data-hit={`dial-${d}`}
            className={['mm-dial__num', d === value ? 'is-selected' : '', d === flash ? 'is-pressed' : ''].join(' ')}
            style={{ left: `${50 + 40 * Math.cos(a)}%`, top: `${50 + 40 * Math.sin(a)}%` }}
            onPointerDown={(e) => {
              e.preventDefault();
              onPick(d, e.pointerType === 'touch' ? 'touch' : 'mouse');
            }}
          >
            {d}
          </button>
        );
      })}
      <div className="mm-dial__hub" aria-hidden>
        <span>
          <b className="mm-btn mm-btn--a">A</b> type
        </span>
        <span>
          <b className="mm-btn mm-btn--x">X</b> delete
        </span>
        <span>
          <b className="mm-btn mm-btn--y">Y</b> send
        </span>
      </div>
    </div>
  );
}
