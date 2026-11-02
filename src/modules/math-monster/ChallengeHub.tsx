import { useEffect, useRef, useState } from 'react';
import { getLogger } from '../../core/log/logger';
import type { PanelProps } from '../../core/modules/types';
import { ConfirmButton } from '../../core/ui/ConfirmButton';
import { OnScreenKeyboard } from '../../core/ui/OnScreenKeyboard';
import { PathMap, type PathNode, type PathRegion } from '../../core/ui/PathMap';
import { stageConfig } from './classroom';
import { getCreature, type Creature } from './creatures';
import type { MathOptions } from './options';
import { useSpiritProgress } from './useSpiritProgress';
import {
  KIND_INFO,
  MAX_STAGES,
  MIN_STAGES,
  PACE_INFO,
  addStage,
  deleteChallenge,
  emptyBook,
  isComplete,
  levelCount,
  levelName,
  levelOf,
  loadChallenges,
  moveStage,
  newChallenge,
  nextTitle,
  putChallenge,
  removeStage,
  renameChallenge,
  restartChallenge,
  saveChallenges,
  setStage,
  stageOfKind,
  stageState,
  stageTitle,
  withLevel,
  type Challenge,
  type ChallengeBook,
  type ChallengeStage,
  type Pace,
  type StageKind,
} from './challenges';

const log = getLogger('math-monster.challenge');

/** Nodes per row on a challenge's map. */
const PER_ROW = 5;
const KINDS: StageKind[] = ['battle', 'boss', 'forge', 'classroom'];
const PACES: Pace[] = ['calm', 'normal', 'fast'];

/** Load and change the player's custom challenges (saved on every change). */
function useChallengeBook(profileId: string) {
  const [book, setBook] = useState<ChallengeBook | null>(null);
  const ref = useRef<ChallengeBook | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadChallenges(profileId)
      .catch((err: unknown) => {
        log.error('could not load challenges', err);
        return emptyBook();
      })
      .then((b) => {
        if (cancelled) return;
        ref.current = b;
        setBook(b);
      });
    return () => {
      cancelled = true;
    };
  }, [profileId]);
  const update = (fn: (b: ChallengeBook) => ChallengeBook) => {
    if (!ref.current) return;
    const next = fn(ref.current);
    ref.current = next;
    setBook(next);
    saveChallenges(profileId, next).catch((err: unknown) => log.error('could not save challenges', err));
  };
  return { book, update };
}

/**
 * Custom mode: challenges a grown-up builds for the player. The overview
 * lists them (and makes new ones); "play" shows one as a map of its stages;
 * "build" is the builder.
 */
export function CustomPanel({ profileId, onStart, page, openPage }: PanelProps<MathOptions>) {
  const { book, update } = useChallengeBook(profileId);
  const { progress } = useSpiritProgress(profileId);
  if (!book || !progress) return <div className="pmap-placeholder" />;
  const pal = progress.companion ? getCreature(progress.companion) : undefined;
  const open = book.challenges.find((c) => c.id === book.openId);
  const go = (id: string, p: 'play' | 'build') => {
    update((b) => ({ ...b, openId: id }));
    openPage?.(p);
  };

  if (page && !open) {
    return (
      <div className="panel">
        <p>That challenge is gone.</p>
        <button type="button" className="btn btn--primary" data-focusable data-autofocus onClick={() => openPage?.(null)}>
          ← All challenges
        </button>
      </div>
    );
  }
  if (page === 'build' && open) {
    return <ChallengeBuilder challenge={open} pal={pal} onChange={(c) => update((b) => putChallenge(b, c))} onDone={() => openPage?.('play')} />;
  }
  if (page === 'play' && open) {
    return (
      <ChallengeMap
        challenge={open}
        pal={pal}
        onPlay={(index) =>
          onStart({
            mode: 'challenge',
            challengeId: open.id,
            title: open.title,
            index,
            total: open.stages.length,
            stage: open.stages[index],
            companionId: pal?.id ?? null,
          })
        }
        onEdit={() => openPage?.('build')}
        onRestart={() => update((b) => putChallenge(b, restartChallenge(open)))}
        onDelete={() => {
          update((b) => deleteChallenge(b, open.id));
          openPage?.(null);
        }}
      />
    );
  }

  return (
    <div className="mode-grid challenge-list">
      {book.challenges.map((c, i) => (
        <button
          key={c.id}
          type="button"
          className={`card mode-card challenge-card ${isComplete(c) ? 'is-complete' : ''}`}
          data-focusable
          data-autofocus={(book.openId ? c.id === book.openId : i === 0) || undefined}
          onClick={() => go(c.id, 'play')}
        >
          <span className="mode-card__icon" aria-hidden>
            {isComplete(c) ? '🏆' : '🎯'}
          </span>
          <span className="card__title">{c.title}</span>
          <span className="card__desc">{[...new Set(c.stages.map((s) => KIND_INFO[s.kind].icon))].join(' ')} · {c.stages.length} stages</span>
          <span className="practice-meter">
            <span className="practice-meter__bar">
              <span style={{ width: `${(100 * c.cleared) / c.stages.length}%` }} />
            </span>
            <small>{isComplete(c) ? 'Complete!' : `${c.cleared} of ${c.stages.length} cleared`}</small>
          </span>
        </button>
      ))}
      <button
        type="button"
        className="card mode-card challenge-card challenge-card--new"
        data-focusable
        data-autofocus={book.challenges.length === 0 || undefined}
        onClick={() => {
          const c = newChallenge(`c${Date.now().toString(36)}`, nextTitle(book), Date.now());
          update((b) => ({ ...putChallenge(b, c), openId: c.id }));
          openPage?.('build');
        }}
      >
        <span className="mode-card__icon" aria-hidden>
          ＋
        </span>
        <span className="card__title">New challenge</span>
        <span className="card__desc">
          Pick {MIN_STAGES}–{MAX_STAGES} stages (battles, boss fights, Forge and classroom lessons) and how hard each one is.
        </span>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Playing: the challenge as a small world map
// ---------------------------------------------------------------------------

function ChallengeMap({
  challenge: c,
  pal,
  onPlay,
  onEdit,
  onRestart,
  onDelete,
}: {
  challenge: Challenge;
  pal?: Creature;
  onPlay: (index: number) => void;
  onEdit: () => void;
  onRestart: () => void;
  onDelete: () => void;
}) {
  const complete = isComplete(c);
  const regions: PathRegion[] = [];
  for (let first = 0; first < c.stages.length; first += PER_ROW) {
    const last = Math.min(c.stages.length, first + PER_ROW);
    regions.push({
      id: `row-${first}`,
      title: <strong>{c.stages.length <= PER_ROW ? c.title : `Stages ${first + 1}–${last}`}</strong>,
      nodes: c.stages.slice(first, last).map((s, j) => {
        const i = first + j;
        return {
          id: String(i),
          label: String(i + 1),
          state: stageState(c, i),
          badge: KIND_INFO[s.kind].icon,
          big: i === c.stages.length - 1 || undefined,
          title: `Stage ${i + 1}, ${stageTitle(s).slice(KIND_INFO[s.kind].icon.length + 1)}`,
        } satisfies PathNode;
      }),
    });
  }
  return (
    <>
      <div className={`panel challenge-head ${complete ? 'is-complete' : ''}`}>
        <span className="challenge-head__icon" aria-hidden>
          {complete ? '🏆' : '🎯'}
        </span>
        <div>
          <strong>{complete ? `${c.title} complete!` : c.title}</strong>
          <p className="muted">
            {complete ? `All ${c.stages.length} stages cleared. Well done!` : `${c.cleared} of ${c.stages.length} stages cleared. Clear every stage to win the trophy.`}
          </p>
        </div>
        <div className="row challenge-head__actions">
          <button type="button" className="btn" data-focusable onClick={onEdit}>
            ✏️ Edit
          </button>
          {c.cleared > 0 && (
            <ConfirmButton className="btn" question="Start over?" yes="Yes, from stage 1" onConfirm={onRestart}>
              ↺ Start over
            </ConfirmButton>
          )}
          <ConfirmButton className="btn" question="Delete this challenge?" yes="Delete" onConfirm={onDelete}>
            🗑 Delete
          </ConfirmButton>
        </div>
      </div>
      <PathMap
        regions={regions}
        columns={Math.min(PER_ROW, c.stages.length)}
        initialId={String(Math.min(c.cleared, c.stages.length - 1))}
        details={(node) => <StageDetails stage={c.stages[Number(node.id)]} index={Number(node.id)} state={node.state} pal={pal} />}
        onPlay={(node) => {
          const s = c.stages[Number(node.id)];
          if (s.kind === 'classroom' && !pal) return;
          onPlay(Number(node.id));
        }}
      />
    </>
  );
}

function StageDetails({ stage: s, index, state, pal }: { stage: ChallengeStage; index: number; state: PathNode['state']; pal?: Creature }) {
  const k = KIND_INFO[s.kind];
  return (
    <>
      <h3>
        {k.icon} Stage {index + 1} · {k.label}
      </h3>
      <p>
        {levelName(s.kind, levelOf(s))}
        {'pace' in s ? ` · ${PACE_INFO[s.pace].label} pace` : ''}
      </p>
      <p className="muted">{stageGoal(s, pal)}</p>
      <p className="muted">
        {s.kind === 'classroom' && !pal
          ? '🔒 Needs a companion: befriend a spirit in Adventure first.'
          : state === 'done'
            ? '✓ Cleared. Play it again any time.'
            : state === 'next'
              ? 'Up next!'
              : `🔒 Clear stage ${index} first.`}
      </p>
    </>
  );
}

/** What it takes to clear a stage. */
function stageGoal(s: ChallengeStage, pal?: Creature): string {
  switch (s.kind) {
    case 'battle':
      return 'Win the fight: knock the spirit out before you run out of HP.';
    case 'boss':
      return 'Forge 3 seals to break the shard before you run out of HP.';
    case 'forge':
      return `8 puzzles: forge 6 of them cleanly (within 2 tries, no hint)${pal ? `, with ${pal.name}` : ''}.`;
    case 'classroom':
      return `12 equations side by side with ${pal?.name ?? 'your companion'}: get 9 right.`;
  }
}

// ---------------------------------------------------------------------------
// Building: the stage list and an editor for the selected stage
// ---------------------------------------------------------------------------

function ChallengeBuilder({
  challenge: c,
  pal,
  onChange,
  onDone,
}: {
  challenge: Challenge;
  pal?: Creature;
  onChange: (c: Challenge) => void;
  onDone: () => void;
}) {
  const [sel, setSel] = useState(0);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(c.title);
  const i = Math.min(sel, c.stages.length - 1);
  const s = c.stages[i];

  const change = (next: Challenge, select = i) => {
    onChange(next);
    setSel(Math.max(0, Math.min(select, next.stages.length - 1)));
  };
  const finishRename = () => {
    onChange(renameChallenge(c, name));
    setRenaming(false);
  };

  return (
    <div className="cb">
      <div className="panel cb-name">
        {renaming ? (
          <form
            className="cb-name__form"
            onSubmit={(e) => {
              e.preventDefault();
              finishRename();
            }}
          >
            <input className="input" value={name} maxLength={30} onChange={(e) => setName(e.target.value)} aria-label="Challenge name" />
            <OnScreenKeyboard value={name} onChange={(v) => setName(v.slice(0, 30))} onDone={finishRename} max={30} />
          </form>
        ) : (
          <>
            <span>
              <span className="muted">Challenge</span> <strong>{c.title}</strong>
            </span>
            <button
              type="button"
              className="btn btn--ghost"
              data-focusable
              onClick={() => {
                setName(c.title);
                setRenaming(true);
              }}
            >
              ✏️ Rename
            </button>
          </>
        )}
      </div>

      <div className="cb-body">
        <section className="cb-stages" aria-label="Stages">
          <h2 className="section-title">
            Stages · {c.stages.length}/{MAX_STAGES}
          </h2>
          <ol>
            {c.stages.map((x, j) => (
              <li key={j}>
                <button
                  type="button"
                  className={`cb-stage ${j === i ? 'is-selected' : ''}`}
                  aria-pressed={j === i}
                  data-focusable
                  data-autofocus={j === 0 || undefined}
                  onClick={() => setSel(j)}
                  onFocus={() => setSel(j)}
                >
                  <span className="cb-stage__num">{j + 1}</span>
                  <span className="cb-stage__text">{stageTitle(x)}</span>
                  {j < c.cleared && (
                    <span className="cb-stage__done" aria-label="cleared">
                      ✓
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ol>
          <button type="button" className="btn" data-focusable disabled={c.stages.length >= MAX_STAGES} onClick={() => change(addStage(c, i), i + 1)}>
            ＋ Add a stage
          </button>
        </section>

        <section className="panel cb-editor" aria-label={`Stage ${i + 1}`}>
          <h3>Stage {i + 1}</h3>
          <Choice label="Game">
            {KINDS.map((k) => {
              const blocked = k === 'classroom' && !pal;
              return (
                <button
                  key={k}
                  type="button"
                  className={s.kind === k ? 'is-selected' : ''}
                  aria-pressed={s.kind === k}
                  data-focusable
                  disabled={blocked}
                  title={blocked ? 'Needs a companion: befriend a spirit in Adventure first' : KIND_INFO[k].hint}
                  onClick={() => s.kind !== k && change(setStage(c, i, stageOfKind(k, s)))}
                >
                  {KIND_INFO[k].icon} {KIND_INFO[k].label}
                </button>
              );
            })}
          </Choice>
          <p className="muted cb-editor__hint">
            {KIND_INFO[s.kind].hint}
            {!pal && s.kind !== 'classroom' ? ' · Classroom needs a companion (befriend a spirit in Adventure).' : ''}
          </p>
          <Choice label={s.kind === 'battle' ? 'Topic' : s.kind === 'classroom' ? 'Classroom stage' : 'Forge level'} wide>
            {Array.from({ length: levelCount(s.kind) }, (_, n) => n + 1).map((n) => (
              <button
                key={n}
                type="button"
                className={levelOf(s) === n ? 'is-selected' : ''}
                aria-pressed={levelOf(s) === n}
                data-focusable
                onClick={() => change(setStage(c, i, withLevel(s, n)))}
              >
                <b>{n}</b> {shortLevelName(s.kind, n)}
              </button>
            ))}
          </Choice>
          {'pace' in s && (
            <Choice label={s.kind === 'boss' ? 'Forge time' : 'Speed'}>
              {PACES.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={s.pace === p ? 'is-selected' : ''}
                  aria-pressed={s.pace === p}
                  data-focusable
                  onClick={() => change(setStage(c, i, { ...s, pace: p }))}
                >
                  {PACE_INFO[p].label}
                </button>
              ))}
            </Choice>
          )}
          <div className="row cb-editor__actions">
            <button type="button" className="btn btn--ghost" data-focusable disabled={i === 0} onClick={() => change(moveStage(c, i, -1), i - 1)}>
              ↑ Earlier
            </button>
            <button type="button" className="btn btn--ghost" data-focusable disabled={i === c.stages.length - 1} onClick={() => change(moveStage(c, i, 1), i + 1)}>
              ↓ Later
            </button>
            <button type="button" className="btn btn--ghost" data-focusable disabled={c.stages.length <= MIN_STAGES} onClick={() => change(removeStage(c, i), i)}>
              🗑 Remove
            </button>
          </div>
        </section>
      </div>

      <div className="row cb-done">
        <button type="button" className="btn btn--primary btn--big" data-focusable onClick={onDone}>
          ✓ Done: to the map
        </button>
      </div>
    </div>
  );
}

function Choice({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className="setting">
      <span className="setting__label">{label}</span>
      <div className={`segmented ${wide ? 'cb-levels' : ''}`} role="group" aria-label={label}>
        {children}
      </div>
    </div>
  );
}

/** A difficulty step's name, short enough for a button. */
function shortLevelName(kind: StageKind, n: number): string {
  if (kind !== 'classroom') return levelName(kind, n);
  const c = stageConfig(n);
  return `${c.topic}${c.pace === 'quick' ? ' ⚡' : ''}`;
}
