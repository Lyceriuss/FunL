import { useEffect, useState } from 'react';
import { getLogger } from '../../core/log/logger';
import { CreatureArt } from './Creature';
import { getCreature } from './creatures';
import { PASS_CORRECT, stageConfig } from './classroom';
import { MASTERY_MAX, PRACTICE_LENGTH } from './companion';
import type { MathOptions } from './options';
import { Stars } from './PracticeGame';
import { SpiritJournal } from './SpiritJournal';
import { classroomUnlocked, loadSpirits, masteryOf, saveSpirits, type SpiritProgress } from './spirits';

const log = getLogger('math-monster.hub');

/**
 * Math Monster's panel on the module screen: the practice classroom (with
 * your companion) and the Spirit Journal. Owns loading/saving spirit progress.
 */
export function MathHub({ profileId, onStart }: { profileId: string; onStart: (options: MathOptions) => void }) {
  const [progress, setProgress] = useState<SpiritProgress | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadSpirits(profileId)
      .then((p) => {
        // Render when the browser is idle, so the module screen's first frame
        // (and the controller's first press on it) isn't held up by the art.
        const show = () => !cancelled && setProgress(p);
        if ('requestIdleCallback' in window) requestIdleCallback(show, { timeout: 400 });
        else setTimeout(show, 50);
      })
      .catch((err: unknown) => log.error('could not load spirit progress', err));
    return () => {
      cancelled = true;
    };
  }, [profileId]);

  if (!progress) return null;

  const change = (next: SpiritProgress) => {
    setProgress(next);
    saveSpirits(profileId, next).catch((err: unknown) => log.error('could not save spirit progress', err));
    log.info('companion changed in journal', { creatureId: next.companion });
  };

  return (
    <>
      <PracticeSection progress={progress} onStart={onStart} />
      <SpiritJournal progress={progress} onChange={change} />
    </>
  );
}

function PracticeSection({ progress, onStart }: { progress: SpiritProgress; onStart: (o: MathOptions) => void }) {
  const pal = progress.companion ? getCreature(progress.companion) : undefined;

  if (!pal) {
    return (
      <section>
        <h2 className="section-title">Practice classroom</h2>
        <div className="panel practice-locked">
          <span className="practice-locked__icon">🔒</span>
          <div>
            <strong>Befriend a spirit in Adventure to unlock practice.</strong>
            <p className="muted">Then you can practise together in class, and help your companion get better at maths.</p>
          </div>
        </div>
      </section>
    );
  }

  const mastery = masteryOf(progress, pal.id);
  return (
    <section>
      <h2 className="section-title">Practice classroom</h2>
      <div className="practice-head">
        <CreatureArt creature={pal} form={4} lite className="practice-head__art" />
        <div>
          <strong>Practise with {pal.name}</strong>
          <div className="practice-head__mastery">
            {pal.name}'s maths <Stars value={mastery} /> {mastery}/{MASTERY_MAX}
          </div>
          <p className="muted">
            {mastery >= MASTERY_MAX
              ? `${pal.name} has mastered it. Practise anyway, together!`
              : `${pal.name} still struggles with the hard ones. Every finished lesson helps.`}
          </p>
        </div>
      </div>
      <StageLadder unlocked={classroomUnlocked(progress)} onPlay={(stage) => onStart({ mode: 'practice', stage, companionId: pal.id })} />
    </section>
  );
}

/** Continue at the highest unlocked stage, or replay any earlier one. */
function StageLadder({ unlocked, onPlay }: { unlocked: number; onPlay: (stage: number) => void }) {
  const next = stageConfig(unlocked);
  return (
    <>
      <button type="button" className="card card--practice practice-continue" data-focusable onClick={() => onPlay(unlocked)}>
        <span className="card__title">▶ {unlocked === 1 ? 'Start' : 'Continue'}: stage {unlocked}</span>
        <span className="card__desc">
          {next.topic} · {next.pace === 'quick' ? 'quick pace, 2 lanes' : 'calm pace'} · get {PASS_CORRECT} of {PRACTICE_LENGTH} right
          to unlock the next stage
        </span>
      </button>
      {unlocked > 1 && (
        <div className="stage-chips" role="group" aria-label="Replay a stage">
          <span className="muted">Replay:</span>
          {Array.from({ length: unlocked - 1 }, (_, i) => {
            const c = stageConfig(i + 1);
            return (
              <button key={c.stage} type="button" className="chip" data-focusable title={`${c.topic} · ${c.pace}`} onClick={() => onPlay(c.stage)}>
                {c.stage} · {c.topic}
                {c.pace === 'quick' ? ' ⚡' : ''}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
