import { useEffect, useState } from 'react';
import { getLogger } from '../../core/log/logger';
import { RIVAL_LEVELS } from './ai';
import type { DuelGameOptions } from './DuelGame';
import { GlitchArt } from './Glitch';
import { loadRecord, type DuelRecord } from './progress';
import './duel.css';

const log = getLogger('maze-duel.hub');

/** Maze Duel's panel on the module screen: who Glitch is, the rules, your record. */
export function DuelHub({ profileId }: { profileId: string; onStart: (options: DuelGameOptions) => void }) {
  const [record, setRecord] = useState<DuelRecord | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadRecord(profileId)
      .then((r) => !cancelled && setRecord(r))
      .catch((err: unknown) => log.error('could not load duel record', err));
    return () => {
      cancelled = true;
    };
  }, [profileId]);

  return (
    <section>
      <h2 className="section-title">Your rival</h2>
      <div className="panel dd-hub">
        <GlitchArt mood="smug" className="dd-hub__art" />
        <div>
          <strong>Glitch, the Static imp</strong>
          <p className="muted">
            A cheeky crumb of the Static that loves mazes and hates losing. It thinks out loud, so watch its bubble: it makes mistakes
            too!
          </p>
          <ul className="dd-hub__rules">
            <li>Answer right → place one square of your path.</li>
            <li>
              Squares like <b>+3</b>, <b>−2</b>, <b>×2</b>, <b>÷2</b> change your number (it starts at 1).
            </li>
            <li>
              Reach the <b>★ gate</b> with <i>exactly</i> its number to win.
            </li>
            <li>Or drop one of your 3 stones 🪨 next to Glitch to block it. Stuck? Step back.</li>
          </ul>
        </div>
        {record && (
          <table className="dd-hub__record">
            <thead>
              <tr>
                <th>Glitch</th>
                <th>Won</th>
                <th>Lost</th>
              </tr>
            </thead>
            <tbody>
              {Object.values(RIVAL_LEVELS).map((l) => (
                <tr key={l.id}>
                  <td>{l.label}</td>
                  <td>{record.record[l.id].won}</td>
                  <td>{record.record[l.id].lost}</td>
                </tr>
              ))}
            </tbody>
            {record.bestWinAnswers !== null && (
              <tfoot>
                <tr>
                  <td colSpan={3}>Fastest win: {record.bestWinAnswers} answers</td>
                </tr>
              </tfoot>
            )}
          </table>
        )}
      </div>
    </section>
  );
}
