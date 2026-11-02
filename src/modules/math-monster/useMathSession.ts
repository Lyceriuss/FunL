import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { input } from '../../core/input/InputManager';
import { useActions } from '../../core/input/hooks';
import type { Action, ActionEvent, InputDevice, NavDirection } from '../../core/input/types';
import { forgeControls } from '../../core/ui/forge/controls';
import { audio } from '../../core/audio';
import { getLogger } from '../../core/log/logger';
import type { GameResult } from '../../core/modules/types';
import type { TelemetrySession } from '../../core/telemetry/TelemetrySession';
import type { PaceHandle } from '../../core/pace/usePace';
import { mathControls } from './controls';
import type { EngineEvent, MathMonsterEngine } from './engine';
import { DIAL_DEADZONE, dialDigitAt, rotateDial } from '../../core/ui/number-entry/dialLayout';
import { KEYPAD_KEYS, keypadIndexFor } from '../../core/ui/number-entry/keypadLayout';

const log = getLogger('math-monster');
/** Engine events worth a diagnostic log line (everything is in telemetry anyway). */
const LOGGED_EVENTS = new Set(['level.start', 'monster.defeated', 'game.over', 'game.complete']);

/**
 * Shared plumbing for every Math Monster mode: frame loop, input → engine,
 * on-screen keypad state, telemetry wiring and finishing. Modes only add
 * their own visuals and react to engine events via `onEvent`.
 */
export function useMathSession(opts: {
  engine: MathMonsterEngine;
  telemetry: TelemetrySession;
  /** Start the engine only once mode data (e.g. player progress) has loaded. */
  ready: boolean;
  onEvent?: (e: EngineEvent) => void;
  /** Called every frame after the engine ticks, with the same dt. */
  onFrame?: (dt: number) => void;
  buildResult: (reason: GameResult['reason']) => GameResult;
  onFinish: (result: GameResult) => void;
  finishDelayMs?: number;
  /** End the session automatically on game over / complete (default true). */
  autoFinish?: boolean;
  /** Player's input pace: learns from every answer (see core/pace). */
  pace?: PaceHandle;
}) {
  const { engine, telemetry, ready } = opts;
  // Controls follow the round: number entry, or the Forge board in Forge boss
  // rounds. Switched from the engine state (every frame and after every
  // action), not from React renders. While paused, menus own the controls.
  const syncScheme = () => {
    if (engine.state.phase === 'paused') return;
    const want = engine.isForgeRound() ? forgeControls : mathControls;
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
  }, [engine]);
  const [, setFrame] = useState(0);
  const device = useRef<InputDevice>(input.lastDevice);
  const [lastDevice, setLastDevice] = useState<InputDevice>(input.lastDevice);
  /** Radial dial (controller): selected digit and the last one typed. */
  const [dial, setDial] = useState(0);
  const dialRef = useRef(0);
  const [dialFlash, setDialFlash] = useState<number | null>(null);
  const [pressed, setPressed] = useState<number | null>(null);
  const finished = useRef(false);
  const latest = useRef(opts);
  useLayoutEffect(() => {
    latest.current = opts;
  });

  // Telemetry + engine start (once ready).
  useEffect(() => {
    if (!ready) return;
    const offInput = telemetry.captureInput(input);
    const offRaw = input.onRaw((e) => setLastDevice(e.device));
    const offEngine = engine.on((e) => {
      const { type, ...data } = e;
      telemetry.log(`math.${type}`, data, device.current);
      if (LOGGED_EVENTS.has(type)) log.debug(type, data);
      // Every submitted answer teaches the input-pace model (input time vs digits, per device).
      if (e.type === 'answer.correct' || e.type === 'answer.wrong') latest.current.pace?.observe(device.current, e.digits, e.typingMs);
      latest.current.onEvent?.(e);
    });
    engine.start();
    // Dev-only handle for debugging and browser tests: window.__funl.engine
    if (import.meta.env.DEV) (window as unknown as { __funl?: unknown }).__funl = { engine };
    return () => {
      offInput();
      offRaw();
      offEngine();
    };
  }, [engine, telemetry, ready]);

  // Frame loop.
  useEffect(() => {
    let last = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      const dt = Math.min(100, now - last);
      engine.tick(dt);
      last = now;
      syncRef.current();
      // Left stick points at a digit on the dial (not in Forge rounds: there it moves the cursor).
      const stick = input.stick();
      if (!engine.isForgeRound() && stick.magnitude > DIAL_DEADZONE) {
        // Input time starts the moment the player starts moving the controller.
        engine.markInputStart();
        const d = dialDigitAt(stick.angle);
        if (d !== dialRef.current) {
          dialRef.current = d;
          setDial(d);
        }
        if (input.lastDevice !== 'gamepad') input.lastDevice = 'gamepad';
        setLastDevice('gamepad');
      }
      latest.current.onFrame?.(dt);
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

  const finish = (reason: GameResult['reason']) => {
    if (finished.current) return;
    finished.current = true;
    latest.current.onFinish(latest.current.buildResult(reason));
  };

  const state = engine.state;
  useEffect(() => {
    if (opts.autoFinish === false) return;
    if (state.phase !== 'gameover' && state.phase !== 'complete') return;
    const id = setTimeout(
      () => finish(state.phase === 'complete' ? 'completed' : 'gameover'),
      opts.finishDelayMs ?? 2000,
    );
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase]);

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

  const apply = (action: Action) => {
    if (action.type === 'math.digit') engine.digit(action.value as number);
    else if (action.type === 'math.backspace') engine.backspace();
    else if (action.type === 'math.submit') engine.submit();
  };

  const paused = state.phase === 'paused';
  useEffect(() => {
    audio.duck(paused);
    return () => audio.duck(false);
  }, [paused]);

  /** Forge round input (controller, keyboard, and touch via the handlers below). */
  const forgeAction = (a: Action): void => {
    if (a.type === 'nav' && 'dir' in a) {
      if (engine.forgeNav(a.dir as NavDirection)) audio.sfx('menuMove');
    } else if (a.type === 'forge.a') {
      const holding = engine.state.forge?.board.held !== null;
      if (engine.forgePrimary()) audio.sfx(holding && engine.state.forge?.board.held === null ? 'pieceSnap' : 'piecePick');
    } else if (a.type === 'forge.x') {
      if (engine.forgeSecondary()) audio.sfx('piecePick');
    } else if (a.type === 'forge.y') {
      engine.forgeCheck();
    } else if (a.type === 'forge.key') {
      if (engine.forgeQuick(String(a.value))) audio.sfx('piecePick');
    }
  };

  useActions((e: ActionEvent) => {
    device.current = e.device;
    const a = e.action;
    if (a.type !== 'pause' && engine.isForgeRound()) {
      forgeAction(a);
      syncScheme();
      return;
    }
    // Any controller action (turning the dial, A, X) starts the input clock too.
    if (e.device === 'gamepad' && a.type !== 'pause') engine.markInputStart();
    if (a.type === 'pause') {
      engine.pause();
    } else if (a.type === 'nav' && 'dir' in a) {
      // D-pad (or arrow keys) turn the dial.
      const next = rotateDial(dialRef.current, a.dir === 'left' || a.dir === 'up' ? -1 : 1);
      dialRef.current = next;
      setDial(next);
    } else if (a.type === 'math.press') {
      setDialFlash(dialRef.current);
      apply({ type: 'math.digit', value: dialRef.current });
    } else {
      const i = keypadIndexFor(a);
      if (i >= 0) setPressed(i);
      apply(a);
    }
  }, !paused);

  const onKeypadPress = (i: number, dev: InputDevice) => {
    // Route through the input manager so touch is handled exactly like other devices.
    input.dispatch(KEYPAD_KEYS[i].action, dev, `Keypad:${KEYPAD_KEYS[i].hit}`);
  };

  const onDialPick = (digit: number, dev: InputDevice) => {
    dialRef.current = digit;
    setDial(digit);
    setDialFlash(digit);
    input.dispatch({ type: 'math.digit', value: digit }, dev, `Dial:${digit}`);
  };

  // Touch / mouse on the Forge board.
  const touch = (dev: InputDevice, kind: string, data: Record<string, unknown> = {}) => {
    device.current = dev;
    setLastDevice(dev);
    telemetry.log('math.forge.tap', { kind, ...data }, dev);
  };
  const forge = {
    take: (id: number, dev: InputDevice) => {
      touch(dev, 'take', { piece: id });
      if (engine.forgeTake(id)) audio.sfx('piecePick');
    },
    drop: (gap: number, dev: InputDevice) => {
      touch(dev, 'drop', { gap });
      if (engine.forgeDrop(gap)) audio.sfx('pieceSnap');
    },
    stash: (dev: InputDevice) => {
      touch(dev, 'stash');
      if (engine.forgeStash()) audio.sfx('piecePick');
    },
    check: (dev: InputDevice) => {
      touch(dev, 'check');
      engine.forgeCheck();
    },
  };

  return { state, paused, lastDevice, dial, dialFlash, pressed, onKeypadPress, onDialPick, finish, finished, device, forge };
}
