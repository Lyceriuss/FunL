import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { audio } from '../../core/audio';
import { input } from '../../core/input/InputManager';
import { useActions, useMenuNavigation } from '../../core/input/hooks';
import { baseScheme, type ActionEvent, type InputDevice, type NavDirection } from '../../core/input/types';
import { getLogger } from '../../core/log/logger';
import { pieceText } from '../../core/math/expression';
import { FORGE_MAX_TIER, FORGE_TIERS, type ForgeTier } from '../../core/math/forge';
import type { GameProps, GameResult } from '../../core/modules/types';
import { forgeControls } from '../../core/ui/forge/controls';
import { ForgeBoardView } from '../../core/ui/forge/ForgeBoardView';
import { PauseMenu } from '../../core/ui/PauseMenu';
import { ThinkBubble } from '../../core/ui/ThinkBubble';
import { CreatureArt, type CreatureMood } from './Creature';
import { getCreature, type Creature } from './creatures';
import { CLEAN_TRIES, ForgePractice, PASS_CLEAN, type ForgePracticeEvent, type ForgeResult, type PetForge } from './forgePractice';
import type { MathOptions } from './options';
import { Stars } from './PracticeGame';
import { forgeUnlockedOf, loadSpirits, masteryOf, recordForgeLesson, saveSpirits, type SpiritProgress } from './spirits';
import './mathMonster.css';
import './practice.css';

const log = getLogger('math-monster.forge');

/** One finished lesson, for the session summary. */
interface LessonRecord {
  tier: ForgeTier;
  sealed: number;
  clean: number;
  passed: boolean;
  ms: number;
  petRight: number | null;
  petWrong: number | null;
  puzzles: ForgeResult[];
}

/**
 * Forge practice (the Forge workshop): lessons of 8 puzzles at one level of
 * the Forge ladder. Passing a lesson unlocks the next level; the lesson-end
 * menu offers the next level, the same one again, or done. With a companion,
 * it forges alongside you and thinks out loud; without one, you practise alone.
 */
export function ForgePracticeGame({ profile, telemetry, options, onFinish }: GameProps<MathOptions>) {
  const opts = options as Extract<MathOptions, { mode: 'forge' }>;
  const pal: Creature | null = opts.companionId ? (getCreature(opts.companionId) ?? null) : null;
  const [progress, setProgress] = useState<SpiritProgress | null>(null);
  const [tier, setTier] = useState<ForgeTier>(() => Math.max(1, Math.min(FORGE_MAX_TIER, opts.tier)) as ForgeTier);
  /** Bumped by "again", so the same level starts a fresh lesson. */
  const [lessonNo, setLessonNo] = useState(1);
  const [session, setSession] = useState<ForgePractice | null>(null);
  const [ended, setEnded] = useState<LessonRecord | null>(null);
  const [lessons] = useState<LessonRecord[]>(() => []);
  const [, setFrame] = useState(0);
  const [lastDevice, setLastDevice] = useState<InputDevice>(input.lastDevice);
  const [paused, setPaused] = useState(false);
  const device = useRef<InputDevice>(input.lastDevice);
  const finished = useRef(false);
  const progressRef = useRef<SpiritProgress | null>(null);
  /** Highest Forge level unlocked (shown in the lesson-end menu). */
  const [unlocked, setUnlocked] = useState(1);
  const [seedBase] = useState(() => opts.seed ?? Math.floor(Math.random() * 2 ** 31));

  // Load progress (companion mastery, unlocked levels).
  useEffect(() => {
    let cancelled = false;
    loadSpirits(profile.id)
      .then((p) => {
        if (cancelled) return;
        progressRef.current = p;
        setProgress(p);
        setUnlocked(forgeUnlockedOf(p));
      })
      .catch((err: unknown) => log.error('could not load progress', err));
    return () => {
      cancelled = true;
    };
  }, [profile.id]);

  // A fresh lesson for each level / "again".
  const loaded = progress !== null;
  useEffect(() => {
    if (!loaded || !progressRef.current) return;
    const mastery = pal ? masteryOf(progressRef.current, pal.id) : null;
    setSession(new ForgePractice({ tier, seed: seedBase + lessonNo * 101 + tier, mastery }));
    setEnded(null);
  }, [loaded, tier, lessonNo, seedBase, pal]);

  const finish = (reason: GameResult['reason']) => {
    if (finished.current) return;
    finished.current = true;
    onFinish(buildForgeResult(lessons, session, pal?.name ?? null, reason));
  };

  // Controls: the Forge board while forging; menus (pause, lesson end) use the menu controls.
  const menuOpen = paused || ended !== null;
  useLayoutEffect(() => {
    const prev = input.getScheme();
    return () => input.setScheme(prev);
  }, []);
  useLayoutEffect(() => {
    input.setScheme(menuOpen ? baseScheme : forgeControls);
  }, [menuOpen]);

  // Telemetry, sounds, saving.
  useEffect(() => {
    if (!session) return;
    const offInput = telemetry.captureInput(input);
    const offRaw = input.onRaw((e) => setLastDevice(e.device));
    const off = session.on((e: ForgePracticeEvent) => {
      const { type, ...data } = e;
      telemetry.log(`math.${type}`, { ...data, ...(type === 'forge.practice.start' ? { companionId: pal?.id ?? null } : {}) }, device.current);
      if (e.type === 'forge.sealed') audio.sfx('sealForged');
      else if (e.type === 'forge.check' && (e.status === 'wrong' || e.status === 'invalid')) audio.sfx('wrong');
      else if (e.type === 'forge.companion') audio.sfx(e.outcome === 'right' ? 'companionRight' : 'companionWrong');
      else if (e.type === 'forge.practice.end') {
        log.info('forge lesson done', { tier: e.tier, clean: e.clean, passed: e.passed });
        const record: LessonRecord = { tier: e.tier, sealed: e.sealed, clean: e.clean, passed: e.passed, ms: e.ms, petRight: e.petRight, petWrong: e.petWrong, puzzles: [...session.results] };
        lessons.push(record);
        if (progressRef.current) {
          const before = forgeUnlockedOf(progressRef.current);
          const next = recordForgeLesson(progressRef.current, e.tier, e.passed);
          progressRef.current = next;
          setUnlocked(forgeUnlockedOf(next));
          if (forgeUnlockedOf(next) > before) telemetry.log('math.forge.unlock', { level: forgeUnlockedOf(next) }, device.current);
          saveSpirits(profile.id, next).catch((err: unknown) => log.error('could not save forge progress', err));
        }
        audio.sfx(e.passed ? 'roundClear' : 'gameOver');
        setEnded(record);
      }
    });
    session.start();
    audio.music('classroom');
    if (import.meta.env.DEV) (window as unknown as { __funl?: unknown }).__funl = { forge: session, input };
    return () => {
      offInput();
      offRaw();
      off();
    };
  }, [session, telemetry, profile.id, pal, lessons]);

  // Frame loop.
  useEffect(() => {
    if (!session) return;
    let last = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      session.tick(Math.min(100, now - last));
      last = now;
      setFrame((f) => (f + 1) % 1_000_000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [session]);

  const setPause = (on: boolean) => {
    session?.setPaused(on);
    setPaused(on);
  };
  useEffect(() => {
    audio.duck(paused);
    return () => audio.duck(false);
  }, [paused]);

  useActions((e: ActionEvent) => {
    if (!session) return;
    device.current = e.device;
    const a = e.action;
    if (a.type === 'pause') return setPause(true);
    if (a.type === 'nav' && 'dir' in a) {
      if (session.nav(a.dir as NavDirection)) audio.sfx('menuMove');
    } else if (a.type === 'forge.a') {
      const holding = session.you.board.held !== null;
      if (session.primary()) audio.sfx(holding && session.you.board.held === null ? 'pieceSnap' : 'piecePick');
    } else if (a.type === 'forge.x') {
      if (session.secondary()) audio.sfx('piecePick');
    } else if (a.type === 'forge.y') {
      session.check();
    } else if (a.type === 'forge.key') {
      if (session.quick(String(a.value))) audio.sfx('piecePick');
    }
  }, !menuOpen);

  if (!session || !progress) return <div className="pr-root" />;

  const touch = (dev: InputDevice, kind: string, data: Record<string, unknown> = {}) => {
    device.current = dev;
    setLastDevice(dev);
    telemetry.log('math.forge.tap', { kind, ...data }, dev);
  };
  const you = session.you;
  const pet = session.pet;
  const sealedNow = you.sealedAt !== null;
  const palMood: CreatureMood =
    ended ? 'cheer'
    : pet?.outcome === 'right' ? 'cheer'
    : pet?.outcome === 'wrong' ? 'sad'
    : pet ? 'think'
    : 'idle';

  return (
    <div className="pr-root fp-root">
      <div className="pr-room" aria-hidden>
        <div className="pr-window">
          <div className="pr-window__moon" />
        </div>
        <div className="pr-floor" />
      </div>

      <header className="mm-hud pr-hud">
        <div className="pr-hud__topic">
          <span className="mm-tag">FORGE · LEVEL {tier}</span>
          <span>
            {Math.min(session.results.length + (sealedNow ? 0 : 1), session.length)} / {session.length}
          </span>
        </div>
        <div className="mm-stage">
          <span className="mm-stage__num">{FORGE_TIERS[tier].label}</span>
          <span className="mm-stage__name">{FORGE_TIERS[tier].hint}</span>
        </div>
        <div className="pr-hud__pal">
          {pal ? (
            <>
              <span>{pal.name}</span>
              <Stars value={masteryOf(progress, pal.id)} />
            </>
          ) : (
            <span className="fp-solo">Solo</span>
          )}
        </div>
        <button type="button" className="mm-pause-btn" data-hit="pause" onClick={() => setPause(true)} aria-label="Pause">
          ❚❚
        </button>
      </header>

      <main className={`fp-main ${pal ? '' : 'fp-main--solo'}`}>
        <section className="fp-you">
          <div className="fp-dots" aria-label={`${session.results.length} of ${session.length} forged, ${session.clean} cleanly`}>
            {Array.from({ length: session.length }, (_, i) => {
              const r = session.results[i];
              const clean = r && r.tries <= CLEAN_TRIES && !r.hinted;
              return <span key={i} className={r ? (clean ? 'is-star' : 'is-done') : i === session.results.length ? 'is-now' : ''} />;
            })}
            <em className="fp-dots__goal">
              {session.clean}/{PASS_CLEAN} clean
            </em>
          </div>
          <ForgeBoardView
            board={you.board}
            feedback={you.feedback}
            device={lastDevice}
            onTake={(id, dev) => {
              touch(dev, 'take', { piece: id });
              if (session.take(id)) audio.sfx('piecePick');
            }}
            onDrop={(gap, dev) => {
              touch(dev, 'drop', { gap });
              if (session.drop(gap)) audio.sfx('pieceSnap');
            }}
            onStash={(dev) => {
              touch(dev, 'stash');
              if (session.stash()) audio.sfx('piecePick');
            }}
            onCheck={(dev) => {
              touch(dev, 'check');
              session.check();
            }}
            checkLabel="Check"
            timer={{ kind: 'stopwatch', ms: (you.sealedAt ?? session.time) - you.startedAt }}
          />
          {you.hint && !sealedNow && (
            <div className="fp-hint" key={you.no}>
              💡 {you.hint}
            </div>
          )}
        </section>

        {pal && (
          <section className="fp-pal">
            <div className="fp-pal__head">
              <span>{pal.name}</span>
              <span className="fp-pal__score">
                ✓ {session.petScore.right} · ✗ {session.petScore.wrong}
              </span>
            </div>
            {pet && <PetBoard pet={pet} row={session.petRow()} />}
            {pet && (
              <ThinkBubble
                question={`Make ${pet.puzzle.target}`}
                // The strategy name shows once it answers (it would give a mistake away).
                reasoning={{ strategyLabel: pet.outcome ? pet.thought.strategyLabel : 'Try and check', steps: pet.thought.steps, answer: pet.thought.claimed, slip: pet.thought.slip }}
                steps={session.petSteps()}
                outcome={pet.outcome ?? undefined}
                answerText={`${pet.thought.text} = ${pet.thought.actual}`}
                className="fp-think"
              />
            )}
            <CreatureArt creature={pal} form={4} mood={palMood} className="fp-pal__art" />
          </section>
        )}
      </main>

      {ended && !paused && (
        <LessonEnd
          record={ended}
          palName={pal?.name ?? null}
          unlocked={unlocked}
          oneLesson={!!opts.oneLesson}
          onNext={() => setTier((t) => Math.min(FORGE_MAX_TIER, t + 1) as ForgeTier)}
          onAgain={() => setLessonNo((n) => n + 1)}
          onDone={() => finish('completed')}
        />
      )}
      {paused && <PauseMenu onResume={() => setPause(false)} onQuit={() => finish('quit')} resumeLabel="▶ Keep forging" quitLabel="Leave the workshop" />}
    </div>
  );
}

/** Lesson result + what next (controller: D-pad between buttons, A chooses, B = done). */
function LessonEnd({
  record,
  palName,
  unlocked,
  oneLesson,
  onNext,
  onAgain,
  onDone,
}: {
  record: LessonRecord;
  palName: string | null;
  unlocked: number;
  /** A challenge stage: the lesson is the whole session, so "next" means continue (done). */
  oneLesson: boolean;
  onNext: () => void;
  onAgain: () => void;
  onDone: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useMenuNavigation(ref, { onBack: onDone });
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
  }, []);
  const canNext = oneLesson ? record.passed : record.tier < FORGE_MAX_TIER && unlocked > record.tier;
  return (
    <div className="pr-end fp-end" ref={ref} role="dialog" aria-label="Lesson result">
      <div className={`pr-end__card ${record.passed ? 'is-pass' : ''}`}>
        <span className="pr-end__kicker">
          FORGE · LEVEL {record.tier} · {FORGE_TIERS[record.tier].label}
        </span>
        <h2>{record.passed ? 'Level passed!' : 'Almost there'}</h2>
        <p>
          You forged {record.sealed} puzzles, <b>{record.clean}</b> of them cleanly (need {PASS_CLEAN}).
          {palName && record.petRight !== null ? ` ${palName} got ${record.petRight} of ${record.petRight + (record.petWrong ?? 0)} right.` : ''}
        </p>
        {record.passed && canNext && !oneLesson && (
          <p className="fp-end__unlock">
            🔓 Level {record.tier + 1} unlocked: {FORGE_TIERS[(record.tier + 1) as ForgeTier].label}
          </p>
        )}
        <div className="pr-end__actions">
          {canNext && (
            <button type="button" className="btn btn--primary" data-focusable data-autofocus onClick={oneLesson ? onDone : onNext}>
              {oneLesson ? '▶ Continue' : `▶ Next: level ${record.tier + 1}`}
            </button>
          )}
          <button type="button" className={`btn ${canNext ? '' : 'btn--primary'}`} data-focusable data-autofocus={canNext ? undefined : true} onClick={onAgain}>
            ↻ {record.passed ? 'Play this level again' : 'Try again'}
          </button>
          {!(oneLesson && record.passed) && (
            <button type="button" className="btn" data-focusable onClick={onDone}>
              {oneLesson ? 'Leave' : 'Done'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** The companion's puzzle: its target, the pieces it has laid down, the rest waiting. */
function PetBoard({ pet, row }: { pet: PetForge; row: number[] }) {
  const placed = new Set(row);
  return (
    <div className={`fp-mini ${pet.outcome ? `is-${pet.outcome}` : ''}`}>
      <span className="fp-mini__target">= {pet.puzzle.target}</span>
      <div className="fp-mini__row">
        {row.map((id) => (
          <span key={id} className={`fg-piece fg-piece--${pet.puzzle.pieces[id].kind} fp-mini__piece`}>
            {pieceText(pet.puzzle.pieces[id])}
          </span>
        ))}
      </div>
      <div className="fp-mini__tray">
        {pet.puzzle.pieces
          .filter((p) => !placed.has(p.id))
          .map((p) => (
            <span key={p.id} className={`fg-piece fg-piece--${p.kind} fp-mini__piece is-waiting`}>
              {pieceText(p)}
            </span>
          ))}
      </div>
    </div>
  );
}

function buildForgeResult(lessons: LessonRecord[], current: ForgePractice | null, palName: string | null, reason: GameResult['reason']): GameResult {
  const isClean = (r: ForgeResult) => r.tries <= CLEAN_TRIES && !r.hinted;
  const all = lessons.flatMap((l) => l.puzzles);
  // A lesson left half-way still counts the puzzles sealed so far.
  if (current && !current.done) all.push(...current.results);
  const ms = all.map((r) => r.ms).sort((a, b) => a - b);
  const median = ms.length ? ms[Math.floor(ms.length / 2)] : null;
  const highest = (lessons.length ? Math.max(...lessons.map((l) => l.tier)) : (current?.tier ?? 1)) as ForgeTier;
  const petRight = lessons.reduce((s, l) => s + (l.petRight ?? 0), 0);
  return {
    reason: lessons.length ? 'completed' : reason,
    summary: {
      forgePractice: {
        lessons: lessons.map((l) => ({ tier: l.tier, sealed: l.sealed, clean: l.clean, passed: l.passed, ms: l.ms, petRight: l.petRight, petWrong: l.petWrong })),
        sealed: all.length,
        clean: all.filter(isClean).length,
        hinted: all.filter((r) => r.hinted).length,
        levelsPassed: lessons.filter((l) => l.passed).map((l) => l.tier),
        medianMs: median,
        companion: palName,
        puzzles: all,
      },
      playMs: Math.round(lessons.reduce((s, l) => s + l.ms, 0) + (current && !current.done ? current.time : 0)),
    },
    highlights: [
      { label: 'Lessons', value: lessons.length ? lessons.map((l) => `level ${l.tier} ${l.passed ? '✓' : '✗'}`).join(', ') : '–' },
      { label: 'Forged', value: `${all.length} (${all.filter(isClean).length} cleanly)` },
      { label: 'Typical time per puzzle', value: median === null ? '–' : `${(median / 1000).toFixed(1)} s` },
      { label: 'Highest level played', value: `${highest} · ${FORGE_TIERS[highest].label}` },
      ...(palName && lessons.length ? [{ label: `${palName} got`, value: `${petRight} right` }] : []),
    ],
  };
}
