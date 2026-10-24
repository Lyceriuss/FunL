import { useEffect, useState } from 'react';
import type { InputDevice } from '../input/types';
import { loadPace } from '../pace';
import type { InputPace, PaceRow } from '../pace/InputPace';
import type { Profile } from '../telemetry/types';

const DEVICE: Record<InputDevice, string> = {
  keyboard: '⌨️ Keyboard',
  gamepad: '🎮 Controller',
  touch: '👆 Touch',
  mouse: '🖱 Mouse',
  pen: '✏️ Pen',
};

const s = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

/**
 * A player's input pace map: how long they need to *enter* an answer of 1–3
 * digits on each device they've used, and the extra time games give them.
 */
export function PaceTable({ profile }: { profile: Profile }) {
  const [pace, setPace] = useState<InputPace | null>(null);
  useEffect(() => {
    void loadPace(profile.id).then(setPace);
  }, [profile.id]);
  if (!pace) return null;
  const rows = pace.summary();
  if (rows.length === 0) {
    return (
      <p className="muted">
        {profile.avatar} {profile.name}: no answers measured yet.
      </p>
    );
  }
  const devices = [...new Set(rows.map((r) => r.device))];
  const cell = (r: PaceRow) => (
    <td key={r.units} title={`${r.samples} measured answers`}>
      {s(r.expectedMs)}
      <small className="muted">
        {' '}
        {r.source === 'measured' ? `(${r.samples})` : r.source === 'estimated' ? '(est.)' : '(default)'}
      </small>
      {pace.allowance(r.device, r.units) > 0 && <small className="pace-extra"> +{s(pace.allowance(r.device, r.units))}</small>}
    </td>
  );
  return (
    <div className="table-wrap">
      <table className="table">
        <caption className="pace-caption">
          {profile.avatar} {profile.name}: input time from first movement to answer (+ extra time given per equation)
        </caption>
        <thead>
          <tr>
            <th>Device</th>
            <th>1 digit</th>
            <th>2 digits</th>
            <th>3 digits</th>
          </tr>
        </thead>
        <tbody>
          {devices.map((d) => (
            <tr key={d}>
              <td>{DEVICE[d] ?? d}</td>
              {rows.filter((r) => r.device === d).map(cell)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
