import { useState } from 'react';
import { CreatureArt } from './Creature';
import { getCreature, type Creature } from './creatures';
import { PASS_CORRECT, TOPIC_LADDER, stageConfig } from './classroom';
import { MASTERY_MAX, PRACTICE_LENGTH } from './companion';
import type { PanelProps } from '../../core/modules/types';
import { PathMap, type PathNode, type PathNodeState, type PathRegion } from '../../core/ui/PathMap';
import type { MathOptions } from './options';
import { Stars } from './PracticeGame';
import { SpiritJournal } from './SpiritJournal';
import { classroomUnlocked, forgeUnlockedOf, masteryOf, type SpiritProgress } from './spirits';
import { FORGE_MAX_TIER, FORGE_TIERS, type ForgeTier } from '../../core/math/forge';
import { CLEAN_TRIES, FORGE_PRACTICE_LENGTH, PASS_CLEAN } from './forgePractice';
import { useSpiritProgress } from './useSpiritProgress';

/**
 * Math Monster's pages on the module screen: Practice (an overview of blocks,
 * each opening its own page: Classroom, Forge workshop), and from the settings
 * bar the Spirit Journal and Progress. Adventure's world map is AdventureMap.
 */

/** Stages on the classroom map before "beyond" (each topic: calm, then quick). */
const CLASSROOM_STAGES = TOPIC_LADDER.length * 2;
/** Topics per row of the classroom map. */
const TOPICS_PER_ROW = 3;

/** Practice mode: an overview of what you can practise; each block opens its page. */
export function PracticePanel({ profileId, onStart, page, openPage }: PanelProps<MathOptions>) {
  const { progress } = useSpiritProgress(profileId);
  if (!progress) return <div className="pmap-placeholder" />;
  const pal = progress.companion ? getCreature(progress.companion) : undefined;
  if (page === 'classroom') return <ClassroomPage progress={progress} pal={pal} onStart={onStart} />;
  if (page === 'forge') return <ForgePage progress={progress} pal={pal} onStart={onStart} />;
  return <PracticeBlocks progress={progress} pal={pal} onOpen={(p) => openPage?.(p)} />;
}

/** Settings bar → Journal: the spirits met and freed; choose the companion. */
export function JournalPanel({ profileId }: PanelProps<MathOptions>) {
  const { progress, change } = useSpiritProgress(profileId);
  if (!progress) return null;
  return <SpiritJournal progress={progress} onChange={change} />;
}

/** Settings bar → Progress: start the adventure over. */
export function ProgressPanel({ profileId }: PanelProps<MathOptions>) {
  const { reset } = useSpiritProgress(profileId);
  return <ResetProgress onReset={reset} />;
}

/** The overview: one big block per kind of practice, with how far you are. */
function PracticeBlocks({ progress, pal, onOpen }: { progress: SpiritProgress; pal?: Creature; onOpen: (page: string) => void }) {
  const stage = classroomUnlocked(progress);
  const next = stageConfig(stage);
  const forge = forgeUnlockedOf(progress) as ForgeTier;
  return (
    <div className="mode-grid practice-blocks">
      <button type="button" className="card mode-card practice-block practice-block--classroom" data-focusable data-autofocus onClick={() => onOpen('classroom')}>
        <span className="mode-card__icon practice-block__art" aria-hidden>
          {pal ? <CreatureArt creature={pal} form={4} lite className="practice-block__pal" /> : '🏫'}
        </span>
        <span className="card__title">Classroom</span>
        <span className="card__desc">
          {pal
            ? `Answer equations side by side with ${pal.name}. Next: stage ${stage} · ${next.topic}${next.pace === 'quick' ? ' ⚡' : ''}`
            : '🔒 Befriend a spirit in Adventure, and it will practise here with you.'}
        </span>
        {pal && <Meter value={Math.min(stage - 1, CLASSROOM_STAGES)} max={CLASSROOM_STAGES} label="stages passed" />}
      </button>
      <button type="button" className="card mode-card practice-block practice-block--forge" data-focusable onClick={() => onOpen('forge')}>
        <span className="mode-card__icon practice-block__art" aria-hidden>
          🔨
        </span>
        <span className="card__title">Forge workshop</span>
        <span className="card__desc">
          Put numbers, signs and brackets in the right order. Next: level {forge} · {FORGE_TIERS[forge].label}
        </span>
        <Meter value={forge - 1} max={FORGE_MAX_TIER} label="levels passed" />
      </button>
    </div>
  );
}

function Meter({ value, max, label }: { value: number; max: number; label: string }) {
  return (
    <span className="practice-meter">
      <span className="practice-meter__bar">
        <span style={{ width: `${(100 * value) / max}%` }} />
      </span>
      <small>
        {value} of {max} {label}
      </small>
    </span>
  );
}

const stateFor = (n: number, unlocked: number): PathNodeState => (n < unlocked ? 'done' : n === unlocked ? 'next' : 'locked');

/** Classroom page: the companion and the stage map. */
function ClassroomPage({ progress, pal, onStart }: { progress: SpiritProgress; pal?: Creature; onStart: (o: MathOptions) => void }) {
  if (!pal) {
    // No companion yet: the practice hall stands empty.
    return (
      <div className="panel practice-empty">
        <div className="practice-empty__room" aria-hidden>
          <div className="practice-empty__board" />
          <div className="practice-empty__desks">
            <span />
            <span />
          </div>
        </div>
        <div>
          <strong>🔒 The classroom is empty.</strong>
          <p className="muted">Befriend a spirit in Adventure, and it will come and practise maths here with you.</p>
        </div>
      </div>
    );
  }

  const unlocked = classroomUnlocked(progress);
  const mastery = masteryOf(progress, pal.id);
  const perRow = TOPICS_PER_ROW * 2;
  const regions: PathRegion[] = [];
  for (let first = 1; first <= CLASSROOM_STAGES; first += perRow) {
    const stages = Array.from({ length: perRow }, (_, i) => stageConfig(first + i));
    regions.push({
      id: `stages-${first}`,
      title: (
        <span>
          <strong>
            Stages {first}–{first + perRow - 1}
          </strong>{' '}
          · {[...new Set(stages.map((s) => s.topic))].join(', ')}
        </span>
      ),
      nodes: stages.map((c) => ({
        id: String(c.stage),
        label: String(c.stage),
        state: stateFor(c.stage, unlocked),
        badge: c.pace === 'quick' ? '⚡' : undefined,
        title: `Stage ${c.stage}, ${c.topic}, ${c.pace} pace`,
      })),
    });
  }
  const beyond = Math.max(CLASSROOM_STAGES + 1, unlocked);
  regions.push({
    id: 'beyond',
    title: (
      <span>
        <strong>∞ Beyond</strong> · faster every stage
      </span>
    ),
    nodes: [{ id: String(beyond), label: '∞', big: true, state: unlocked > CLASSROOM_STAGES ? 'next' : 'locked', title: 'Beyond: harder stages' }],
  });

  return (
    <>
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
      <PathMap
        regions={regions}
        columns={perRow}
        initialId={String(Math.min(unlocked, beyond))}
        details={(node) => <StageDetails stage={Number(node.id)} state={node.state} />}
        onPlay={(node) => onStart({ mode: 'practice', stage: Number(node.id), companionId: pal.id })}
      />
    </>
  );
}

function StageDetails({ stage, state }: { stage: number; state: PathNode['state'] }) {
  const c = stageConfig(stage);
  const beyond = stage > CLASSROOM_STAGES;
  return (
    <>
      <h3>{beyond ? `∞ Stage ${stage}` : `Stage ${stage} · ${c.topic}`}</h3>
      <p>
        {beyond
          ? 'The last topic again, a little faster every stage.'
          : c.pace === 'quick'
            ? '⚡ Quick pace · 2 equations at a time'
            : 'Calm pace · 1 equation at a time'}
      </p>
      <p className="muted">
        {state === 'locked'
          ? `🔒 Pass stage ${beyond ? CLASSROOM_STAGES : stage - 1} first.`
          : state === 'done'
            ? '✓ Passed. Play it again any time.'
            : `Get ${PASS_CORRECT} of ${PRACTICE_LENGTH} right to unlock the next stage.`}
      </p>
    </>
  );
}

/**
 * Forge workshop page: order-of-operations practice with its own ladder of
 * levels (separate from the classroom stages). Open to everyone; the
 * companion joins once there is one.
 */
function ForgePage({ progress, pal, onStart }: { progress: SpiritProgress; pal?: Creature; onStart: (o: MathOptions) => void }) {
  const unlocked = forgeUnlockedOf(progress) as ForgeTier;
  const tiers = Array.from({ length: FORGE_MAX_TIER }, (_, i) => (i + 1) as ForgeTier);
  return (
    <>
      <p className="muted forge-intro">
        Put numbers, signs and brackets in the right order so they make the target number.{' '}
        {pal ? `${pal.name} forges with you and thinks out loud.` : 'You practise alone for now: befriend a spirit in Adventure and it will join you.'}
      </p>
      <PathMap
        regions={[
          {
            id: 'forge',
            title: <strong>Forge levels</strong>,
            nodes: tiers.map((t) => ({
              id: String(t),
              label: String(t),
              state: stateFor(t, unlocked),
              big: t === FORGE_MAX_TIER || undefined,
              title: `Level ${t}, ${FORGE_TIERS[t].label}`,
            })),
          },
        ]}
        columns={FORGE_MAX_TIER}
        initialId={String(unlocked)}
        playLabel="🔨 Forge"
        details={(node) => <ForgeDetails tier={Number(node.id) as ForgeTier} state={node.state} />}
        onPlay={(node) => onStart({ mode: 'forge', companionId: pal?.id ?? null, tier: Number(node.id) })}
      />
    </>
  );
}

function ForgeDetails({ tier, state }: { tier: ForgeTier; state: PathNode['state'] }) {
  return (
    <>
      <h3>
        Level {tier} · {FORGE_TIERS[tier].label}
      </h3>
      <p>{FORGE_TIERS[tier].hint}</p>
      <p className="muted">
        {state === 'locked'
          ? `🔒 Pass level ${tier - 1} first.`
          : state === 'done'
            ? '✓ Passed. Play it again any time.'
            : tier >= FORGE_MAX_TIER
              ? `${FORGE_PRACTICE_LENGTH} puzzles · the top level`
              : `${FORGE_PRACTICE_LENGTH} puzzles · forge ${PASS_CLEAN} cleanly (within ${CLEAN_TRIES} tries, no hint) to unlock level ${tier + 1}`}
      </p>
    </>
  );
}

/**
 * Start the adventure over: forgets befriended spirits, the companion, its
 * maths stars, classroom stages, Forge levels and the world map. Two steps
 * (no browser dialog), so it works with a controller too. Play history
 * (sessions) is kept.
 */
function ResetProgress({ onReset }: { onReset: () => Promise<void> }) {
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);
  return (
    <section>
      <h2 className="section-title">Progress</h2>
      <div className="panel reset-progress">
        {!confirming ? (
          <>
            <div>
              <strong>Start the adventure over</strong>
              <p className="muted">
                {done
                  ? 'Progress reset. The spirits are waiting in Adventure again.'
                  : 'Forget the world map, befriended spirits, your companion, its maths stars, classroom stages and Forge levels. Play history is kept.'}
              </p>
            </div>
            <button type="button" className="btn" data-focusable onClick={() => setConfirming(true)}>
              ↺ Reset progress
            </button>
          </>
        ) : (
          <>
            <div>
              <strong>Are you sure?</strong>
              <p className="muted">This can't be undone.</p>
            </div>
            <div className="row">
              <button
                type="button"
                className="btn btn--danger"
                data-focusable
                onClick={async () => {
                  await onReset();
                  setConfirming(false);
                  setDone(true);
                }}
              >
                Yes, reset
              </button>
              <button type="button" className="btn" data-focusable onClick={() => setConfirming(false)}>
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
