import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useControlScheme, useMenuNavigation } from '../../core/input/hooks';
import { baseScheme } from '../../core/input/types';
import { audio } from '../../core/audio';
import { getLogger } from '../../core/log/logger';
import { usePace, type PaceHandle } from '../../core/pace/usePace';
import type { GameProps, GameResult, Settings } from '../../core/modules/types';
import type { TelemetrySession } from '../../core/telemetry/TelemetrySession';
import type { TelemetryEvent } from '../../core/telemetry/types';
import { Hero } from './Art';
import { PASS_CORRECT, stageConfig, stageLabel, stagePassed, type StageConfig } from './classroom';
import { MASTERY_MAX, attempt, type CompanionAttempt } from './companion';
import { CreatureArt, type CreatureMood } from './Creature';
import { CREATURES, getCreature, type Creature } from './creatures';
import { AnswerDock } from './Dock';
import type { EngineEvent, EngineState, SolvedRecord } from './engine';
import { createEngine, normalTravelMs, sessionSeed, type MathOptions } from './options';
import { PauseMenu } from './PauseMenu';
import { createRng } from './rng';
import type { MathProblem } from './schema';
import type { Step } from '../../core/mental-math';
import {
  classroomUnlocked,
  emptyProgress,
  loadSpirits,
  masteryOf,
  recordPractice,
  recordStage,
  saveSpirits,
  type SpiritProgress,
} from './spirits';
import { summarize } from './summary';
import { useMathSession } from './useMathSession';
import './mathMonster.css';
import './practice.css';

const log = getLogger('math-monster.practice');
const YOU_BUBBLE_MS = 1600;
const PAL_BUBBLE_MS = 1900;
const CHALK_REVEAL_MS = 2200;
/** Pause after both columns are done, before the stage result appears. */
const STAGE_END_DELAY_MS = 1200;
/** Auto-advance to the next stage after a pass. */
const AUTO_NEXT_S = 6;

type PracticeOptions = Extract<MathOptions, { mode: 'practice' }>;
type BubbleKind = 'right' | 'wrong' | 'unsure';
interface Bubble {
  text: string;
  kind: BubbleKind;
  at: number;
}

/** Outcome of one classroom stage (one lesson). */
export interface StageResult {
  stage: number;
  topic: string;
  pace: StageConfig['pace'];
  length: number;
  completed: boolean;
  passed: boolean;
  playerCorrect: number;
  playerWrong: number;
  playerTimeouts: number;
  petCorrect: number;
  petWrong: number;
  petUnfinished: number;
  masteryBefore: number;
  masteryAfter: number;
  score: number;
  bestStreak: number;
  playMs: number;
  level: number;
  solved: SolvedRecord[];
}

/**
 * Practice mode: a staged classroom. The player and their companion each have
 * a column on the chalkboard and answer their own equations independently.
 * Pass a stage (9/12) and the next, harder one starts automatically; or try
 * again. Every finished stage earns the companion mastery (see companion.ts).
 */
export function PracticeGame({ profile, telemetry, options, settings, onFinish }: GameProps<MathOptions>) {
  const opts = options as PracticeOptions;
  const pal = getCreature(opts.companionId) ?? CREATURES[0];
  const [baseSeed] = useState(() => sessionSeed(options));
  const pace = usePace(profile.id, settings.inputHelp !== 'off');

  const [progress, setProgress] = useState<SpiritProgress | null>(null);
  const progressRef = useRef<SpiritProgress | null>(null);
  const [stage, setStage] = useState(Math.max(1, opts.stage));
  const [run, setRun] = useState(0);
  const [ended, setEnded] = useState<StageResult | null>(null);
  const results = useRef<StageResult[]>([]);
  const finished = useRef(false);

  useEffect(() => {
    let cancelled = false;
    loadSpirits(profile.id)
      .catch((err: unknown) => {
        log.error('could not load spirit progress', err);
        return emptyProgress();
      })
      .then((p) => {
        if (cancelled) return;
        progressRef.current = p;
        setProgress(p);
      });
    return () => {
      cancelled = true;
    };
  }, [profile.id]);

  const save = (next: SpiritProgress) => {
    progressRef.current = next;
    setProgress(next);
    saveSpirits(profile.id, next).catch((err: unknown) => log.error('could not save spirit progress', err));
  };

  const onStageEnd = (r: Omit<StageResult, 'masteryAfter'>) => {
    const p = progressRef.current ?? emptyProgress();
    const next = recordStage(recordPractice(p, pal.id), r.stage, r.passed);
    const full: StageResult = { ...r, masteryAfter: masteryOf(next, pal.id) };
    results.current.push(full);
    save(next);
    telemetry.log('math.practice.stage.end', {
      stage: full.stage,
      passed: full.passed,
      playerCorrect: full.playerCorrect,
      length: full.length,
      petCorrect: full.petCorrect,
      petWrong: full.petWrong,
      petUnfinished: full.petUnfinished,
      companionId: pal.id,
      masteryBefore: full.masteryBefore,
      masteryAfter: full.masteryAfter,
      unlocked: classroomUnlocked(next),
    });
    log.info('classroom stage finished', { stage: full.stage, passed: full.passed, masteryAfter: full.masteryAfter });
    setEnded(full);
  };

  const leave = (partial?: Omit<StageResult, 'masteryAfter'>) => {
    if (finished.current) return;
    finished.current = true;
    if (partial) results.current.push({ ...partial, masteryAfter: partial.masteryBefore });
    onFinish(buildSessionResult(results.current, telemetry.events(), pal, progressRef.current));
  };

  const play = (nextStage: number) => {
    setEnded(null);
    setStage(nextStage);
    setRun((r) => r + 1);
  };

  if (!progress || !pace.ready) return <div className="pr-root" />;

  return (
    <>
      <ClassroomStage
        key={`${stage}-${run}`}
        stage={stage}
        pal={pal}
        mastery={masteryOf(progress, pal.id)}
        seed={baseSeed + run * 7919 + stage * 104729}
        telemetry={telemetry}
        settings={settings}
        options={opts}
        frozen={!!ended}
        pace={pace}
        onStageEnd={onStageEnd}
        onLeave={leave}
      />
      {ended && (
        <StageEnd
          result={ended}
          pal={pal}
          onNext={() => play(ended.stage + 1)}
          onRetry={() => play(ended.stage)}
          onLeave={() => leave()}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// One stage: two columns, two engines (player + companion)
// ---------------------------------------------------------------------------

/**
 * What the companion is working on. It thinks about one equation at a time
 * (the most urgent one in its column), so its thought bubble can show one
 * clear chain of reasoning.
 */
interface PetJob {
  id: number;
  problem: MathProblem;
  attempt: CompanionAttempt;
  /** Companion-engine times: started thinking / will answer. */
  start: number;
  at: number;
  outcome?: BubbleKind;
  endedAt?: number;
}

/** Pause after answering before starting the next one (time to read the bubble). */
const PET_REST_MS: Record<BubbleKind, number> = { right: 1800, wrong: 3200, unsure: 2200 };
/** How long a finished thought stays up if nothing new comes along. */
const PET_BUBBLE_HOLD_MS = 3200;

function ClassroomStage({
  stage,
  pal,
  mastery,
  seed,
  telemetry,
  settings,
  options,
  frozen,
  pace,
  onStageEnd,
  onLeave,
}: {
  pace: PaceHandle;
  stage: number;
  pal: Creature;
  mastery: number;
  seed: number;
  telemetry: TelemetrySession;
  settings: Settings;
  options: PracticeOptions;
  /** Stage result is showing: stop input and timers. */
  frozen: boolean;
  onStageEnd: (r: Omit<StageResult, 'masteryAfter'>) => void;
  onLeave: (partial?: Omit<StageResult, 'masteryAfter'>) => void;
}) {
  const cfg = stageConfig(stage);
  const stageOptions: PracticeOptions = { ...options, stage };
  // The player's column gets extra time for their input pace; the companion doesn't type.
  const [engine] = useState(() =>
    createEngine(stageOptions, settings, seed, { inputAllowance: (p) => pace.allowance(String(p.answer).length) }),
  );
  const [petEngine] = useState(() => createEngine(stageOptions, settings, seed ^ 0x2545f491));
  const petRng = useRef(createRng(seed ^ 0x5eed));
  /** The companion's yardstick: this topic at normal speed, Auto lanes. */
  const normalMs = normalTravelMs(cfg.levelConfig);

  const [you, setYou] = useState<Bubble | null>(null);
  const [chalk, setChalk] = useState<{ text: string; lane: number; at: number } | null>(null);
  const job = useRef<PetJob | null>(null);
  const [petView, setPetView] = useState<PetJob | null>(null);
  const handled = useRef(new Set<number>());
  const nextFreeAt = useRef(0);
  const petStats = useRef({ correct: 0, wrong: 0, unfinished: 0 });
  const [petCounts, setPetCounts] = useState({ correct: 0, done: 0 });
  const endedRef = useRef(false);

  const startLogged = useRef(false);
  useEffect(() => {
    if (startLogged.current) return; // StrictMode runs effects twice in dev
    startLogged.current = true;
    telemetry.log('math.practice.stage.start', {
      stage,
      topic: cfg.topic,
      pace: cfg.pace,
      level: cfg.level,
      speedFactor: cfg.speedFactor,
      lanes: cfg.lanes,
      companionId: pal.id,
      mastery,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const count = (kind: BubbleKind) => {
    if (kind === 'right') petStats.current.correct++;
    else if (kind === 'wrong') petStats.current.wrong++;
    else petStats.current.unfinished++;
    const s = petStats.current;
    setPetCounts({ correct: s.correct, done: s.correct + s.wrong + s.unfinished });
  };

  const logPet = (id: number, problem: MathProblem, a: CompanionAttempt | null, outcome: BubbleKind) => {
    telemetry.log('math.practice.companion', {
      id,
      key: problem.key,
      companionId: pal.id,
      mastery,
      outcome,
      attempted: !!a,
      answer: a && outcome !== 'unsure' ? a.answer : null,
      correct: outcome === 'right',
      strategy: a?.reasoning.strategy ?? null,
      slip: a?.reasoning.slip?.id ?? null,
      steps: a?.reasoning.steps.length ?? 0,
      thinkMs: a?.thinkMs ?? null,
    });
  };

  const finishJob = (j: PetJob, outcome: BubbleKind) => {
    audio.sfx(outcome === 'right' ? 'companionRight' : 'companionWrong');
    const pt = petEngine.state.time;
    j.outcome = outcome;
    j.endedAt = pt;
    nextFreeAt.current = pt + PET_REST_MS[outcome];
    count(outcome);
    logPet(j.id, j.problem, j.attempt, outcome);
    setPetView({ ...j });
  };

  // Companion engine: the bot's own column of equations.
  useEffect(() => {
    const off = petEngine.on((e: EngineEvent) => {
      if (e.type !== 'problem.timeout') return;
      const j = job.current;
      if (j && j.id === e.id) {
        // Landed while it was still thinking.
        if (!j.outcome) finishJob(j, 'unsure');
      } else if (!handled.current.has(e.id)) {
        // It never got to this one (busy with another).
        handled.current.add(e.id);
        const p = petEngine.state.active.find((x) => x.id === e.id)?.problem;
        count('unsure');
        if (p) logPet(e.id, p, null, 'unsure');
      }
    });
    petEngine.start();
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [petEngine]);

  useEffect(() => {
    audio.music('classroom');
  }, []);

  const onEvent = (e: EngineEvent) => {
    const t = engine.state.time;
    if (e.type === 'answer.correct') {
      audio.sfx('correct');
      setYou({ text: String(e.answer), kind: 'right', at: t });
    } else if (e.type === 'answer.wrong') {
      audio.sfx('wrong');
      setYou({ text: String(e.given), kind: 'wrong', at: t });
    } else if (e.type === 'problem.timeout') {
      audio.sfx('wrong');
      setYou({ text: '?', kind: 'unsure', at: t });
      const active = engine.state.active.find((p) => p.id === e.id);
      const text = active?.problem.text ?? e.key;
      setChalk({ text: `${text} = ${e.answer}`, lane: e.lane, at: t });
    }
  };

  const onFrame = (dt: number) => {
    if (frozen || engine.state.phase === 'paused') return;
    // The companion works on its own column, on the same clock as the player.
    petEngine.tick(dt);
    const pt = petEngine.state.time;
    const j = job.current;

    // Done thinking: answer (right or wrong, as its reasoning says).
    if (j && !j.outcome && pt >= j.at && petEngine.state.active.some((p) => p.id === j.id)) {
      petEngine.answerFor(j.id, j.attempt.answer);
      finishJob(j, j.attempt.reasoning.correct ? 'right' : 'wrong');
    }

    // Free again: pick the most urgent equation it hasn't tried yet.
    if ((!job.current || job.current.outcome) && pt >= nextFreeAt.current) {
      const next = petEngine.state.active
        .filter((p) => !handled.current.has(p.id))
        .sort((a, b) => b.progress - a.progress)[0];
      if (next) {
        handled.current.add(next.id);
        const a = attempt(next.problem, {
          mastery,
          travelMs: next.travelMs * (1 - next.progress),
          normalTravelMs: normalMs,
          rng: petRng.current,
        });
        const nj: PetJob = { id: next.id, problem: next.problem, attempt: a, start: pt, at: pt + a.thinkMs };
        job.current = nj;
        setPetView({ ...nj });
      }
    }

    // Stage ends once both columns are done.
    if (!endedRef.current && engine.state.phase === 'complete' && petEngine.state.phase === 'complete') {
      endedRef.current = true;
      setTimeout(() => onStageEnd(snapshot(true)), STAGE_END_DELAY_MS);
    }
  };

  const snapshot = (completed: boolean): Omit<StageResult, 'masteryAfter'> => {
    const s = engine.state;
    return {
      stage,
      topic: cfg.topic,
      pace: cfg.pace,
      length: cfg.length,
      completed,
      passed: completed && stagePassed(s.stats.correct, cfg.length),
      playerCorrect: s.stats.correct,
      playerWrong: s.stats.wrong,
      playerTimeouts: s.stats.timeouts,
      petCorrect: petStats.current.correct,
      petWrong: petStats.current.wrong,
      petUnfinished: petStats.current.unfinished,
      masteryBefore: mastery,
      score: s.score,
      bestStreak: s.bestStreak,
      playMs: Math.round(s.time),
      level: cfg.level,
      solved: [...s.stats.solved],
    };
  };

  const session = useMathSession({
    engine,
    telemetry,
    ready: !frozen,
    pace,
    onEvent,
    onFrame,
    autoFinish: false,
    buildResult: () => ({ reason: 'quit', summary: {}, highlights: [] }), // unused: the classroom ends sessions itself
    onFinish: () => onLeave(snapshot(false)),
  });
  const { state, paused } = session;

  // ----- derived view state -----
  const t = state.time;
  const pt = petEngine.state.time;
  const youNow = you && t - you.at < YOU_BUBBLE_MS ? you : null;
  const petShown =
    petView && (!petView.outcome || pt - (petView.endedAt ?? 0) < PET_BUBBLE_HOLD_MS) ? petView : null;
  const emote = petShown?.outcome && pt - (petShown.endedAt ?? 0) < PAL_BUBBLE_MS ? petShown.outcome : null;
  const palMood: CreatureMood =
    emote === 'right' ? 'cheer'
    : emote ? 'sad'
    : petShown && !petShown.outcome ? 'think'
    : 'idle';
  const youDone = state.stats.correct + state.stats.timeouts;
  const intro = state.phase === 'between' && t < 1200 && youDone === 0;
  const chalkNow = chalk && t - chalk.at < CHALK_REVEAL_MS ? chalk : null;
  const youFinished = state.phase === 'complete';
  const petFinished = petEngine.state.phase === 'complete';
  const visible = petShown ? visibleSteps(petShown, pt) : [];
  const notes = visible.filter((s) => s.note !== undefined).map((s) => s.note!);

  return (
    <div className="pr-root">
      <div className="pr-room" aria-hidden>
        <div className="pr-window">
          <div className="pr-window__moon" />
        </div>
        <div className="pr-floor" />
      </div>

      <header className="mm-hud pr-hud">
        <div className="pr-hud__topic">
          <span className="mm-tag">CLASSROOM</span>
          <span>STAGE {stage}</span>
        </div>
        <div className="mm-stage">
          <span className="mm-stage__num">{cfg.topic}</span>
          <span className="mm-stage__name">{cfg.pace === 'quick' ? 'quick pace · 2 lanes' : 'calm pace'}</span>
        </div>
        <div className="pr-hud__pal">
          <span>{pal.name}</span>
          <Stars value={mastery} />
        </div>
        <button type="button" className="mm-pause-btn" data-hit="pause" onClick={() => engine.pause()} aria-label="Pause">
          ❚❚
        </button>
      </header>

      <div className="pr-board">
        <Column
          label="You"
          count={`${Math.min(youDone, cfg.length)} / ${cfg.length}`}
          state={state}
          chalk={chalkNow}
          note={youFinished && !petFinished ? `Waiting for ${pal.name}…` : intro ? `Need ${PASS_CORRECT} of ${cfg.length} to pass` : null}
        />
        <Column
          label={pal.name}
          count={`${Math.min(petCounts.done, cfg.length)} / ${cfg.length}`}
          state={petEngine.state}
          focusId={petShown && !petShown.outcome ? petShown.id : null}
          note={intro ? pal.practice.hello : petFinished && !youFinished ? `${pal.name} is done!` : null}
          pet
        />
        <div className="pr-board__ledge" />
      </div>

      <div className="pr-class">
        <Seat who="you" bubble={youNow}>
          <Hero
            hurt={false}
            attacking={false}
            pose="class"
            className={youNow?.kind === 'right' ? 'pr-yay' : youNow?.kind === 'wrong' ? 'pr-oops' : ''}
          />
        </Seat>
        <Seat
          who="pal"
          bubble={null}
          custom={petShown ? <ThinkBubble job={petShown} steps={visible} /> : null}
          notes={notes}
        >
          <CreatureArt creature={pal} form={4} mood={palMood} className="pr-pal" />
          {emote && (
            <span className={`pr-emote pr-emote--${emote}`} key={petShown?.endedAt} aria-hidden>
              {emote === 'right' ? '✨' : emote === 'wrong' ? '😢' : '😅'}
            </span>
          )}
        </Seat>
      </div>

      <AnswerDock
        state={state}
        lastDevice={session.lastDevice}
        dial={session.dial}
        dialFlash={session.dialFlash}
        pressed={session.pressed}
        onKeypadPress={session.onKeypadPress}
        onDialPick={session.onDialPick}
      />

      {paused && !frozen && (
        <PauseMenu
          onResume={() => engine.resume()}
          onQuit={() => session.finish('quit')}
          resumeLabel="▶ Keep practising"
          quitLabel="Leave class"
        />
      )}
    </div>
  );
}

/** Reasoning steps revealed so far: they appear one by one while it thinks. */
function visibleSteps(j: PetJob, now: number): Step[] {
  const steps = j.attempt.reasoning.steps;
  if (j.outcome === 'right' || j.outcome === 'wrong') return steps;
  const span = Math.max(1, j.at - j.start);
  const until = j.outcome ? (j.endedAt ?? now) : now;
  const f = Math.max(0, Math.min(1, (until - j.start) / span));
  return steps.slice(0, Math.min(steps.length, Math.floor(f * steps.length) + 1));
}

/**
 * The companion's thought bubble: the problem, the strategy it picked, its
 * reasoning step by step, and finally its answer. When it's wrong, the step
 * where it slipped is highlighted and it says what went wrong.
 */
function ThinkBubble({ job, steps }: { job: PetJob; steps: Step[] }) {
  const r = job.attempt.reasoning;
  const shown = steps.slice(-4);
  const hidden = steps.length - shown.length;
  return (
    <div className={`pr-think ${job.outcome ? `is-${job.outcome}` : 'is-thinking'}`} aria-live="polite">
      <div className="pr-think__head">
        <span className="pr-think__q">{job.problem.text}</span>
        <span className="pr-think__strategy">💡 {r.strategyLabel}</span>
      </div>
      <ol className="pr-think__steps">
        {hidden > 0 && <li className="pr-think__more">…</li>}
        {shown.map((s, i) => (
          <li
            key={hidden + i}
            className={[
              'pr-think__step',
              `pr-think__step--${s.kind}`,
              job.outcome === 'wrong' && s.slip ? 'is-slip' : '',
              !job.outcome && i === shown.length - 1 ? 'is-new' : '',
            ].join(' ')}
          >
            {s.say}
            {s.note !== undefined && <span className="pr-think__note" title="written down">📝</span>}
          </li>
        ))}
        {!job.outcome && (
          <li className="pr-think__step pr-dots" aria-label="thinking">
            <i />
            <i />
            <i />
          </li>
        )}
      </ol>
      {job.outcome && (
        <div className="pr-think__answer">
          {job.outcome === 'unsure' ? (
            <span>…out of time!</span>
          ) : (
            <span>
              {job.problem.text} = {r.answer} {job.outcome === 'right' ? '✓' : '✗'}
            </span>
          )}
        </div>
      )}
      {job.outcome === 'wrong' && r.slip && <div className="pr-think__oops">Oops: {r.slip.label}</div>}
    </div>
  );
}

function laneTop(lane: number, lanes: number): number {
  if (lanes === 1) return 55;
  return 35 + (lane * 45) / (lanes - 1);
}

/** One column of the chalkboard: equations float right → left inside it. */
function Column({
  label,
  count,
  state,
  chalk,
  note,
  focusId = null,
  pet = false,
}: {
  label: string;
  count: string;
  state: EngineState;
  chalk?: { text: string; lane: number; at: number } | null;
  note?: string | null;
  /** Equation the companion is currently thinking about. */
  focusId?: number | null;
  pet?: boolean;
}) {
  return (
    <div className={`pr-col ${pet ? 'pr-col--pet' : 'pr-col--you'}`}>
      <div className="pr-col__head">
        <span>{label}</span>
        <span className="pr-col__count">{count}</span>
      </div>
      <div className="pr-col__lanes">
        {state.active.map((p) => {
          const wrong = state.effects.some((e) => e.outcome === 'wrong' && e.lane === p.lane && state.time - e.at < 400);
          return (
            <div
              key={p.id}
              className={['pr-eq', p.progress > 0.75 ? 'is-late' : '', wrong ? 'is-wrong' : '', p.wrongAnswers.length && pet ? 'is-crossed' : '', p.id === focusId ? 'is-focus' : '', p.recoil > 0 ? 'is-recoil' : ''].join(' ')}
              style={
                {
                  top: `${laneTop(p.lane, state.lanes)}%`,
                  left: `${(1 - p.progress) * 100}%`,
                  '--tx': `${-(1 - p.progress) * 100}%`,
                } as CSSProperties
              }
            >
              {p.problem.text} = ?
            </div>
          );
        })}
        {chalk && (
          <div className="pr-chalk-reveal" style={{ top: `${laneTop(chalk.lane, state.lanes)}%` }} key={chalk.at}>
            {chalk.text}
          </div>
        )}
        {note && <div className="pr-col__note">{note}</div>}
      </div>
    </div>
  );
}

function Seat({
  who,
  bubble,
  thinking = false,
  custom = null,
  notes,
  children,
}: {
  who: 'you' | 'pal';
  bubble: Bubble | null;
  thinking?: boolean;
  /** A custom bubble (the companion's reasoning). */
  custom?: ReactNode;
  /** Values written down on the desk notepad. */
  notes?: number[];
  children: ReactNode;
}) {
  return (
    <div className={`pr-seat pr-seat--${who}`}>
      {custom}
      {bubble && (
        <div className={`pr-bubble pr-bubble--${bubble.kind}`} key={bubble.at} aria-live="polite">
          <span className="pr-bubble__text">{bubble.text}</span>
          <span className="pr-bubble__mark">{bubble.kind === 'right' ? '✓' : bubble.kind === 'wrong' ? '✗' : ''}</span>
        </div>
      )}
      {!bubble && thinking && (
        <div className="pr-bubble pr-bubble--thinking" aria-label="thinking">
          <span className="pr-dots">
            <i />
            <i />
            <i />
          </span>
        </div>
      )}
      <div className="pr-seat__body">{children}</div>
      <div className="pr-desk" aria-hidden>
        <div className="pr-desk__top" />
        <div className="pr-desk__front" />
        <div className="pr-desk__book" />
        {notes && notes.length > 0 && (
          <div className="pr-notepad" aria-label="notes">
            {notes.map((n, i) => (
              <span key={i}>{n}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stage result: next stage (auto), try again, leave
// ---------------------------------------------------------------------------

function StageEnd({
  result: r,
  pal,
  onNext,
  onRetry,
  onLeave,
}: {
  result: StageResult;
  pal: Creature;
  onNext: () => void;
  onRetry: () => void;
  onLeave: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useControlScheme(baseScheme);
  useMenuNavigation(ref);
  const [countdown, setCountdown] = useState<number | null>(r.passed ? AUTO_NEXT_S : null);
  useEffect(() => {
    audio.sfx(r.passed ? 'roundClear' : 'gameOver');
  }, [r.passed]);

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[data-focusable]')?.focus();
  }, []);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      onNext();
      return;
    }
    const id = setTimeout(() => setCountdown((c) => (c === null ? null : c - 1)), 1000);
    return () => clearTimeout(id);
  }, [countdown, onNext]);

  const stop = () => setCountdown(null);
  const next = stageConfig(r.stage + 1);
  const mastered = r.masteryAfter >= MASTERY_MAX;

  return (
    <div className="pr-end" ref={ref} role="dialog" aria-label="Stage result">
      <div className={`pr-end__card ${r.passed ? 'is-pass' : 'is-retry'}`}>
        <span className="pr-end__kicker">
          Stage {r.stage} · {stageLabel(stageConfig(r.stage))}
        </span>
        <h2>{r.passed ? `STAGE ${r.stage} CLEAR!` : 'SO CLOSE!'}</h2>
        <div className="pr-end__scores">
          <div>
            <span className="pr-end__big">
              {r.playerCorrect}/{r.length}
            </span>
            <span className="pr-end__label">You {r.passed ? '✓' : `(need ${PASS_CORRECT})`}</span>
          </div>
          <div>
            <span className="pr-end__big">
              {r.petCorrect}/{r.length}
            </span>
            <span className="pr-end__label">{pal.name}</span>
          </div>
        </div>
        <div className="pr-end__mastery">
          <CreatureArt creature={pal} form={4} mood={r.passed ? 'cheer' : 'idle'} lite className="pr-end__pal" />
          <div>
            <div>
              {pal.name}'s maths <Stars value={r.masteryAfter} />
              {r.masteryAfter > r.masteryBefore && <b className="pr-banner__up"> +1</b>}
            </div>
            <p>{mastered ? pal.practice.mastered : pal.practice.improved}</p>
          </div>
        </div>
        <div className="pr-end__actions">
          {r.passed && (
            <button type="button" className="btn btn--primary btn--big" data-focusable onClick={onNext}>
              ▶ Stage {r.stage + 1}: {next.topic}
              {next.pace === 'quick' ? ' ⚡' : ''}
              {countdown !== null && <small className="pr-end__count"> ({countdown})</small>}
            </button>
          )}
          <button
            type="button"
            className={`btn btn--big ${r.passed ? '' : 'btn--primary'}`}
            data-focusable
            onFocus={r.passed ? stop : undefined}
            onClick={onRetry}
          >
            ↺ Try again
          </button>
          <button type="button" className="btn btn--big" data-focusable onFocus={stop} onClick={onLeave}>
            Leave class
          </button>
        </div>
        {!r.passed && <p className="pr-end__hint">Get {PASS_CORRECT} right to unlock the next stage.</p>}
      </div>
    </div>
  );
}

export function Stars({ value, max = MASTERY_MAX }: { value: number; max?: number }) {
  return (
    <span className="pr-stars" aria-label={`${value} of ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={i < value ? 'is-on' : ''}>
          ★
        </span>
      ))}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Session result (all stages played in this visit to the classroom)
// ---------------------------------------------------------------------------

function buildSessionResult(
  stages: StageResult[],
  events: readonly TelemetryEvent[],
  pal: Creature,
  progress: SpiritProgress | null,
): GameResult {
  const sum = (f: (r: StageResult) => number) => stages.reduce((n, r) => n + f(r), 0);
  const merged = {
    score: sum((r) => r.score),
    level: Math.max(1, ...stages.map((r) => r.level)),
    bestStreak: Math.max(0, ...stages.map((r) => r.bestStreak)),
    time: sum((r) => r.playMs),
    stats: {
      correct: sum((r) => r.playerCorrect),
      wrong: sum((r) => r.playerWrong),
      timeouts: sum((r) => r.playerTimeouts),
      solved: stages.flatMap((r) => r.solved),
    },
  };
  const summary = summarize(merged, events);
  const cleared = stages.filter((r) => r.passed).length;
  const petAnswered = sum((r) => r.petCorrect + r.petWrong + r.petUnfinished);
  const mastery = progress ? masteryOf(progress, pal.id) : 0;
  const secs = (ms: number | null) => (ms === null ? '–' : `${(ms / 1000).toFixed(1)} s`);
  return {
    reason: stages.some((r) => r.completed) ? 'completed' : 'quit',
    summary: {
      ...summary,
      practice: {
        companionId: pal.id,
        stagesPlayed: stages.length,
        stagesCleared: cleared,
        highestStage: Math.max(0, ...stages.filter((r) => r.passed).map((r) => r.stage)),
        unlocked: progress ? classroomUnlocked(progress) : 1,
        masteryAfter: mastery,
        companionCorrect: sum((r) => r.petCorrect),
        companionAnswered: petAnswered,
        stages: stages.map(({ solved: _solved, ...rest }) => rest),
      },
    },
    highlights: [
      { label: 'Stages cleared', value: `${cleared}/${stages.length}` },
      { label: 'Your accuracy', value: summary.accuracy === null ? '–' : `${Math.round(summary.accuracy * 100)}%` },
      { label: `${pal.name}'s correct answers`, value: `${sum((r) => r.petCorrect)}/${petAnswered}` },
      { label: `${pal.name}'s maths`, value: '★'.repeat(mastery) + '☆'.repeat(MASTERY_MAX - mastery) },
      { label: 'Typical answer time', value: secs(summary.medianResponseMs) },
    ],
  };
}
