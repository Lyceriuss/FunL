import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { audio } from '../../core/audio';
import { input } from '../../core/input/InputManager';
import { useActions } from '../../core/input/hooks';
import type { ActionEvent, InputDevice, NavDirection } from '../../core/input/types';
import { getLogger } from '../../core/log/logger';
import { GeneratedSource } from '../../core/math/problems';
import { createRng } from '../../core/math/rng';
import type { GameProps, GameResult } from '../../core/modules/types';
import { usePace } from '../../core/pace/usePace';
import { Hero } from '../../core/ui/Hero';
import { DIAL_DEADZONE, dialDigitAt, rotateDial } from '../../core/ui/number-entry/dialLayout';
import { KEYPAD_KEYS, keypadIndexFor } from '../../core/ui/number-entry/keypadLayout';
import { NumberDock } from '../../core/ui/number-entry/NumberDock';
import { PauseMenu } from '../../core/ui/PauseMenu';
import { ThinkBubble } from '../../core/ui/ThinkBubble';
import { createRival, RIVAL_LEVELS, type RivalLevel } from './ai';
import { BoardView } from './BoardView';
import { generateBoard } from './board';
import { answerControls, pieceControls } from './controls';
import { DuelEngine, INTRO_MS, STONES, type DuelEvent, type DuelState } from './duel';
import { GlitchArt, type GlitchMood } from './Glitch';
import { addResult } from './progress';
import { buildDuelResult } from './summary';
import { topicById } from './topics';
import './duel.css';

const log = getLogger('maze-duel');
const FINISH_DELAY_MS = 3200;

export interface DuelGameOptions {
  topic: string;
  /** Fixed board/equations (tests, replays). Random when left out. */
  seed?: number;
}

type Answer = Extract<DuelEvent, { firstInputMs: number }>;

export function DuelGame({ profile, telemetry, options, settings, onFinish }: GameProps<DuelGameOptions>) {
  const level: RivalLevel = RIVAL_LEVELS[settings.rival as RivalLevel['id']] ?? RIVAL_LEVELS.easy;
  const topic = topicById(options.topic);
  const hints = settings.hints !== 'off';
  const pace = usePace(profile.id, settings.inputHelp !== 'off');
  const { ready: paceReady, observe } = pace;

  const [engine] = useState(() => {
    const seed = options.seed ?? Math.floor(Math.random() * 2 ** 31);
    return new DuelEngine({
      board: generateBoard(seed),
      level: topic.level,
      source: new GeneratedSource(seed + 1),
      rivalSource: new GeneratedSource(seed + 2),
      rival: createRival(level, createRng(seed + 3)),
      allowance: pace.allowance,
    });
  });
  const [answers] = useState<Answer[]>(() => []);
  const [rivalAnswers] = useState<{ correct: boolean }[]>(() => []);
  const [, setFrame] = useState(0);
  const [lastDevice, setLastDevice] = useState<InputDevice>(input.lastDevice);
  const device = useRef<InputDevice>(input.lastDevice);
  const [dial, setDial] = useState(0);
  const dialRef = useRef(0);
  const [dialFlash, setDialFlash] = useState<number | null>(null);
  const [pressed, setPressed] = useState<number | null>(null);
  const [nudge, setNudge] = useState(0);
  const finished = useRef(false);
  const state = engine.state;
  const stage = state.stage;

  // Answering and placing use different controls; follow the engine's stage
  // directly (every frame and after every action) rather than React renders.
  // While paused, the pause menu owns the controls.
  const syncScheme = () => {
    const s = engine.state;
    if (s.phase === 'paused') return;
    const want = s.phase === 'playing' && s.stage === 'action' ? pieceControls : answerControls;
    if (input.getScheme() !== want) input.setScheme(want);
  };
  const syncRef = useRef(syncScheme);
  useLayoutEffect(() => {
    syncRef.current = syncScheme;
  });
  useLayoutEffect(() => {
    const prev = input.getScheme();
    syncRef.current();
    return () => input.setScheme(prev);
  }, []);

  const finish = (reason: GameResult['reason']) => {
    if (finished.current) return;
    finished.current = true;
    onFinish(buildDuelResult(engine.state, answers, { rival: level.id, topic: topic.id, device: device.current, rivalAnswers }, reason));
  };
  const finishRef = useRef(finish);
  useLayoutEffect(() => {
    finishRef.current = finish;
  });

  // Telemetry, sounds and starting (once the input pace has loaded).
  useEffect(() => {
    if (!paceReady) return;
    const offInput = telemetry.captureInput(input);
    const offRaw = input.onRaw((e) => setLastDevice(e.device));
    const off = engine.on((e) => {
      const { type, ...data } = e;
      telemetry.log(`duel.${type}`, data, device.current);
      if (e.type === 'answer.correct' || e.type === 'answer.wrong') {
        answers.push(e);
        observe(device.current, e.digits, e.typingMs);
        audio.sfx(e.type === 'answer.correct' ? 'correct' : 'wrong');
      } else if (e.type === 'rival.answer') {
        rivalAnswers.push({ correct: e.correct });
      } else if (e.type === 'move') {
        if (e.who === 'rival' && e.kind === 'block') audio.sfx('lifeLost');
        else if (e.who === 'you') audio.sfx('menuSelect');
      } else if (e.type === 'game.end') {
        log.info('duel over', { result: e.result, moves: e.moves, rival: level.id });
        audio.sfx(e.result === 'won' ? 'roundClear' : e.result === 'lost' ? 'gameOver' : 'menuSelect');
        void addResult(profile.id, level.id, e.result, answers.filter((a) => a.type === 'answer.correct').length);
        setTimeout(() => finishRef.current(e.result === 'won' ? 'completed' : 'gameover'), FINISH_DELAY_MS);
      } else if (e.type === 'start') {
        log.debug('duel start', { seed: e.seed, target: e.target, rival: e.rival, topic: topic.id });
      }
    });
    engine.start();
    audio.music('duel');
    if (import.meta.env.DEV) (window as unknown as { __funl?: unknown }).__funl = { duel: engine, input };
    return () => {
      offInput();
      offRaw();
      off();
    };
  }, [engine, telemetry, paceReady, observe, answers, rivalAnswers, level.id, topic.id, profile.id]);

  // Frame loop (+ the dial on the left stick while answering).
  useEffect(() => {
    let last = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      engine.tick(Math.min(100, now - last));
      last = now;
      const s = engine.state;
      if (s.phase === 'playing' && s.stage === 'question') {
        const stick = input.stick();
        if (stick.magnitude > DIAL_DEADZONE) {
          engine.markInputStart();
          const d = dialDigitAt(stick.angle);
          if (d !== dialRef.current) {
            dialRef.current = d;
            setDial(d);
          }
          if (input.lastDevice !== 'gamepad') input.lastDevice = 'gamepad';
          setLastDevice('gamepad');
        }
      }
      syncRef.current();
      setFrame((f) => (f + 1) % 1_000_000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const onHide = () => document.hidden && engine.pause('hidden');
    document.addEventListener('visibilitychange', onHide);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [engine]);

  useEffect(() => {
    if (pressed === null) return;
    const id = setTimeout(() => setPressed(null), 110);
    return () => clearTimeout(id);
  }, [pressed]);
  useEffect(() => {
    if (dialFlash === null) return;
    const id = setTimeout(() => setDialFlash(null), 140);
    return () => clearTimeout(id);
  }, [dialFlash]);

  const paused = state.phase === 'paused';
  useEffect(() => {
    audio.duck(paused);
    return () => audio.duck(false);
  }, [paused]);

  const handleAction = (e: ActionEvent) => {
    device.current = e.device;
    const a = e.action;
    const s = engine.state;
    if (a.type === 'pause') return engine.pause();
    if (s.phase !== 'playing') return;
    if (s.stage === 'action') {
      if (a.type === 'nav' && 'dir' in a) {
        if (engine.aim(a.dir as NavDirection)) audio.sfx('menuMove');
        else setNudge((n) => n + 1);
      } else if (a.type === 'duel.place') {
        if (!engine.place()) setNudge((n) => n + 1);
      } else if (a.type === 'duel.mode') {
        engine.toggleMode();
        audio.sfx('menuMove');
      } else if (a.type === 'duel.back') {
        engine.stepBack();
      }
      return;
    }
    if (e.device === 'gamepad') engine.markInputStart();
    if (a.type === 'nav' && 'dir' in a) {
      const next = rotateDial(dialRef.current, a.dir === 'left' || a.dir === 'up' ? -1 : 1);
      dialRef.current = next;
      setDial(next);
    } else if (a.type === 'math.press') {
      setDialFlash(dialRef.current);
      engine.digit(dialRef.current);
    } else {
      const i = keypadIndexFor(a);
      if (i >= 0) setPressed(i);
      if (a.type === 'math.digit') engine.digit(a.value as number);
      else if (a.type === 'math.backspace') engine.backspace();
      else if (a.type === 'math.submit') engine.submit();
    }
  };

  useActions((e: ActionEvent) => {
    handleAction(e);
    syncScheme();
  }, !paused);

  const onKeypadPress = (i: number, dev: InputDevice) => input.dispatch(KEYPAD_KEYS[i].action, dev, `Keypad:${KEYPAD_KEYS[i].hit}`);
  const onDialPick = (digit: number, dev: InputDevice) => {
    dialRef.current = digit;
    setDial(digit);
    setDialFlash(digit);
    input.dispatch({ type: 'math.digit', value: digit }, dev, `Dial:${digit}`);
  };
  const onTap = (cell: number, dev: InputDevice) => {
    device.current = dev;
    setLastDevice(dev);
    telemetry.log('duel.tap', { cell }, dev);
    engine.placeAt(cell);
  };

  const youValue = state.you.values[state.you.values.length - 1];
  const rivalValue = state.rival.values[state.rival.values.length - 1];
  const latestWrong = state.effects.findLast((x) => x.kind === 'wrong' && x.who === 'you');
  const ended = state.phase === 'won' || state.phase === 'lost' || state.phase === 'draw';

  return (
    <div className={`dd-root phase-${state.phase}`} data-stage={stage}>
      <header className="dd-hud">
        <div className="dd-hud__side dd-hud__side--you">
          <span className="dd-hud__who">{profile.name}</span>
          <span className="dd-hud__num" aria-label="your number">{youValue}</span>
          <Stones left={state.you.stones} />
        </div>
        <div className="dd-hud__target" aria-label={`target ${state.board.target}`}>
          <span className="dd-hud__star">★</span>
          <span className="dd-hud__goal">{state.board.target}</span>
          <span className="dd-hud__caption">make exactly this</span>
        </div>
        <div className="dd-hud__side dd-hud__side--rival">
          <Stones left={state.rival.stones} />
          <span className="dd-hud__num" aria-label="Glitch's number">{rivalValue}</span>
          <span className="dd-hud__who">Glitch · {level.label}</span>
        </div>
        <button type="button" className="dd-pause-btn" onClick={() => engine.pause()} aria-label="Pause">
          ❚❚
        </button>
      </header>

      <main className="dd-arena">
        <section className="dd-player">
          <Hero hurt={state.effects.some((x) => x.kind === 'block' && x.who === 'rival' && state.time - x.at < 600)} attacking={false} pose="class" className="dd-hero" />
          <PlayerPanel state={state} nudge={nudge} device={lastDevice} onMode={(m) => engine.setMode(m)} onBack={() => engine.stepBack()} />
        </section>

        <BoardView state={state} hints={hints} device={lastDevice} onTap={onTap} />

        <section className="dd-rival">
          <RivalBubble state={state} />
          <GlitchArt mood={glitchMood(state)} className="dd-glitch-art" />
        </section>
      </main>

      {state.phase === 'playing' && (stage === 'question' || stage === 'feedback') && (
        <NumberDock
          value={stage === 'feedback' ? '' : (state.question?.input ?? '')}
          wrongKey={latestWrong && state.time - latestWrong.at < 400 ? latestWrong.id : null}
          disabled={stage !== 'question'}
          lastDevice={lastDevice}
          dial={dial}
          dialFlash={dialFlash}
          pressed={pressed}
          onKeypadPress={onKeypadPress}
          onDialPick={onDialPick}
          className="dd-dock"
        />
      )}

      {state.phase === 'intro' && (
        <div className="dd-banner dd-banner--intro" role="status">
          <div className="dd-banner__title">MAZE DUEL</div>
          <p>
            Race Glitch to the <b>★ gate</b>. Your number starts at <b>1</b>. Squares like <b>+3</b> or <b>×2</b> change it.
            <br />
            You can only enter the gate with exactly <b className="dd-gold">{state.board.target}</b>.
          </p>
          <p className="dd-banner__small">Every right answer = one square. Use a stone 🪨 to block Glitch!</p>
          <div className="dd-banner__count">{Math.max(1, Math.ceil((INTRO_MS - state.time) / 1000))}</div>
        </div>
      )}
      {ended && (
        <div className={`dd-banner dd-banner--${state.phase}`} role="status">
          <div className="dd-banner__title">{state.phase === 'won' ? 'YOU WIN!' : state.phase === 'lost' ? 'GLITCH WINS' : 'DRAW'}</div>
          <p>
            {state.phase === 'won'
              ? `You made exactly ${state.board.target} and opened the gate!`
              : state.phase === 'lost'
                ? `Glitch made ${state.board.target} first. Hehehe! Try again?`
                : 'Nobody reached the gate.'}
          </p>
        </div>
      )}
      {paused && <PauseMenu onResume={() => engine.resume()} onQuit={() => finish('quit')} resumeLabel="▶ Keep racing" quitLabel="Leave the duel" />}
    </div>
  );
}

function Stones({ left }: { left: number }) {
  return (
    <span className="dd-stones" aria-label={`${left} stones left`}>
      {Array.from({ length: STONES }, (_, i) => (
        <i key={i} className={i < left ? 'is-full' : ''} />
      ))}
    </span>
  );
}

/** Your side: the equation (or the right answer after a mistake), or how to spend the piece. */
function PlayerPanel({
  state,
  nudge,
  device,
  onMode,
  onBack,
}: {
  state: DuelState;
  nudge: number;
  device: InputDevice;
  onMode: (m: 'build' | 'block') => void;
  onBack: () => void;
}) {
  if (state.phase !== 'playing') return <div className="dd-card dd-card--idle" />;
  if (state.stage === 'feedback' && state.feedback) {
    return (
      <div className="dd-card dd-card--wrong" role="status">
        <span className="dd-card__eq">
          {state.feedback.text} = <b>{state.feedback.answer}</b>
        </span>
        <span className="dd-card__note">Not {state.feedback.given}. No square this time.</span>
      </div>
    );
  }
  if (state.stage === 'question' && state.question) {
    return (
      <div className="dd-card" key={state.question.id}>
        <span className="dd-card__eq">{state.question.problem.text} = ?</span>
        <span className="dd-card__note">Answer to earn a square</span>
      </div>
    );
  }
  const { build, block, back } = state.options;
  const pad = device === 'gamepad';
  const keys = device === 'keyboard';
  return (
    <div className={`dd-card dd-card--piece is-${state.mode}`} key={`piece-${nudge}`}>
      <span className="dd-card__title">✔ Right! Place your piece</span>
      <div className="dd-modes" role="group" aria-label="Piece">
        <button type="button" className={`dd-mode ${state.mode === 'build' ? 'is-on' : ''}`} onClick={() => onMode('build')} disabled={build.length === 0}>
          🧱 Build
        </button>
        <button type="button" className={`dd-mode ${state.mode === 'block' ? 'is-on' : ''}`} onClick={() => onMode('block')} disabled={block.length === 0}>
          🪨 Stone ({state.you.stones})
        </button>
        <button type="button" className="dd-mode" onClick={onBack} disabled={!back}>
          ↩ Back
        </button>
      </div>
      <span className="dd-card__note">
        {state.mode === 'build'
          ? build.length
            ? pad
              ? 'Stick: pick a glowing square · A: build · X: stone · B: back'
              : keys
                ? 'Arrows: pick a square · Enter: build · Tab: stone · Backspace: back'
                : 'Tap a glowing square'
            : 'No way forward. Step back or drop a stone'
          : pad
            ? 'Stick: pick a square next to Glitch · A: drop the stone'
            : keys
              ? 'Arrows: pick a square next to Glitch · Enter: drop'
              : 'Tap a pink square next to Glitch'}
      </span>
    </div>
  );
}

function RivalBubble({ state }: { state: DuelState }) {
  const job = state.rivalJob;
  if (!job || state.phase === 'intro') return null;
  const steps = job.reasoning.steps;
  if (state.rivalStage === 'thinking') {
    const f = (state.time - job.startedAt) / job.thinkMs;
    const shown = Math.max(1, Math.min(steps.length - 1, Math.ceil(f * (steps.length - 1))));
    return <ThinkBubble question={job.problem.text} reasoning={job.reasoning} steps={steps.slice(0, shown)} className="dd-think" />;
  }
  if (state.rivalStage === 'rest') return null;
  const d = job.decision;
  return (
    <>
      <ThinkBubble question={job.problem.text} reasoning={job.reasoning} steps={steps} outcome={job.outcome} className="dd-think" />
      {state.rivalStage === 'acting' && d && d.kind !== 'none' && (
        <div className={`dd-rival-says dd-rival-says--${d.kind}`}>{d.kind === 'build' ? 'Building! 🧱' : d.kind === 'block' ? 'Stone for you! 🪨' : 'Hmm… back a step'}</div>
      )}
    </>
  );
}

function glitchMood(s: DuelState): GlitchMood {
  if (s.phase === 'lost') return 'win';
  if (s.phase === 'won') return 'lose';
  if (s.rivalStage === 'thinking') return 'think';
  if (s.rivalStage === 'reveal' && s.rivalJob?.outcome === 'wrong') return 'oops';
  if (s.rivalStage === 'acting') return 'smug';
  return 'idle';
}
