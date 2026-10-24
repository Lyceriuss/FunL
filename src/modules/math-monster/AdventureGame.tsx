import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { audio } from '../../core/audio';
import { getLogger } from '../../core/log/logger';
import { usePace } from '../../core/pace/usePace';
import type { GameProps, GameResult } from '../../core/modules/types';
import { Hero } from './Art';
import { BefriendOverlay } from './Befriend';
import { CreatureArt, type CreatureMood } from './Creature';
import { getCreature, glowColor, type Creature } from './creatures';
import { AnswerDock } from './Dock';
import { BOSS_DEFEAT_MS, type Effect, type EngineEvent, type EngineState } from './engine';
import { createEngine, sessionSeed, type MathOptions } from './options';
import { PauseMenu } from './PauseMenu';
import { encounterOrder, loadSpirits, purify, recordForm, saveSpirits, setCompanion, emptyProgress, type SpiritProgress } from './spirits';
import { summarize } from './summary';
import { useMathSession } from './useMathSession';
import './mathMonster.css';

const log = getLogger('math-monster');
/** How long the K.O. banner shows before the next form's banner. */
const KO_BANNER_MS = 800;
/** When to show the befriend dialog after a boss falls (within BOSS_DEFEAT_MS). */
const BEFRIEND_AFTER_MS = 2000;
/** Friendly device names for the results screen. */
const DEVICE_NAME: Record<string, string> = { gamepad: 'controller', keyboard: 'keyboard', touch: 'touch', mouse: 'mouse', pen: 'pen' };
const LANE_COLORS = ['#22d3ee', '#e879f9', '#fbbf24', '#a3e635'];

interface Shown {
  creature: Creature;
  form: number;
  boss: boolean;
}

/** Vertical position (% of the battlefield) for a lane. */
function laneTop(lane: number, lanes: number): number {
  if (lanes === 1) return 42;
  return 18 + (lane * 52) / (lanes - 1);
}

/** Adventure mode: fight corrupted spirits over 5-round encounters, purify and befriend them. */
export function AdventureGame({ profile, telemetry, options, settings, onFinish }: GameProps<MathOptions>) {
  // Extra time per equation for how fast this player can *enter* an answer on their device.
  const pace = usePace(profile.id, settings.inputHelp !== 'off');
  const [engine] = useState(() =>
    createEngine(options, settings, sessionSeed(options), { inputAllowance: (p) => pace.allowance(String(p.answer).length) }),
  );

  // ----- spirits: who we meet, purification, companion -----
  const [spirits, setSpirits] = useState<SpiritProgress | null>(null);
  const spiritsRef = useRef<SpiritProgress | null>(null);
  const orderRef = useRef<Creature[]>([]);
  /** Same as orderRef, as state for rendering. */
  const [order, setOrder] = useState<Creature[]>([]);
  /** The form that was just K.O.'d, so its transformation can play out. */
  const [defeatedShown, setDefeatedShown] = useState<Shown | null>(null);
  const [befriend, setBefriend] = useState<Creature | null>(null);
  const pendingRound = useRef<{ encounter: number; round: number; boss: boolean } | null>(null);

  const updateSpirits = (fn: (p: SpiritProgress) => SpiritProgress) => {
    if (!spiritsRef.current) return;
    const next = fn(spiritsRef.current);
    spiritsRef.current = next;
    setSpirits(next);
    saveSpirits(profile.id, next).catch((err: unknown) => log.error('could not save spirit progress', err));
  };

  /** Creature for an encounter number (event handlers pass the ref, render passes state). */
  const creatureFor = (encounter: number, list: Creature[] = orderRef.current): Creature =>
    list[encounter % list.length];

  useEffect(() => {
    let cancelled = false;
    loadSpirits(profile.id)
      .catch((err: unknown) => {
        log.error('could not load spirit progress', err);
        return emptyProgress();
      })
      .then((p) => {
        if (cancelled) return;
        spiritsRef.current = p;
        orderRef.current = encounterOrder(p);
        setOrder(orderRef.current);
        setSpirits(p);
      });
    return () => {
      cancelled = true;
    };
  }, [profile.id]);

  const ready = spirits !== null && pace.ready;

  const onEvent = (e: EngineEvent) => {
    // Sound: effects for moments, music for the mood of the round.
    if (e.type === 'answer.correct') audio.sfx('correct');
    else if (e.type === 'answer.wrong') audio.sfx('wrong');
    else if (e.type === 'life.lost') audio.sfx('lifeLost');
    else if (e.type === 'monster.defeated') audio.sfx(e.boss ? 'purified' : 'roundClear');
    else if (e.type === 'game.over') audio.sfx('gameOver');
    if (e.type === 'level.start') audio.music(e.boss ? 'boss' : 'adventure');

    if (e.type === 'level.start') {
      // The engine schedules the next round at K.O. time; only count the
      // encounter once its first equation actually appears.
      pendingRound.current = { encounter: e.encounter, round: e.round, boss: e.boss };
    } else if (e.type === 'problem.spawn' && pendingRound.current) {
      const { encounter, round, boss } = pendingRound.current;
      pendingRound.current = null;
      const c = creatureFor(encounter);
      telemetry.log('math.spirit.encounter', { creatureId: c.id, form: round - 1, round, boss, encounter });
      updateSpirits((p) => recordForm(p, c.id, round - 1));
    } else if (e.type === 'monster.defeated') {
      const c = creatureFor(e.encounter);
      setDefeatedShown({ creature: c, form: e.round - 1, boss: e.boss });
      if (e.boss) {
        telemetry.log('math.spirit.purified', { creatureId: c.id, encounter: e.encounter });
        updateSpirits((p) => purify(p, c.id, Date.now()));
        setTimeout(() => {
          if (session.finished.current) return;
          engine.pause('story');
          setBefriend(c);
        }, BEFRIEND_AFTER_MS);
      }
    }
  };

  const session = useMathSession({
    engine,
    telemetry,
    ready,
    pace,
    onEvent,
    buildResult: (reason) => buildAdventureResult(engine.state, telemetry.events(), reason),
    onFinish,
  });
  const { state, paused, finish } = session;

  const chooseBefriend = (accept: boolean) => {
    const c = befriend;
    if (!c) return;
    telemetry.log('math.spirit.befriend', { creatureId: c.id, accepted: accept }, session.device.current);
    if (accept) {
      log.info('companion chosen', { creatureId: c.id });
      updateSpirits((p) => setCompanion(p, c.id));
    }
    setBefriend(null);
    engine.resume();
  };

  // ----- derived view state -----
  const age = (e: Effect) => state.time - e.at;
  const latest = state.effects[state.effects.length - 1];
  const recent = (outcome: Effect['outcome'], ms: number) =>
    state.effects.some((e) => e.outcome === outcome && age(e) < ms);
  const defeatFx = [...state.effects].reverse().find((e) => e.outcome === 'defeated');
  const sinceDefeat = defeatFx ? age(defeatFx) : Infinity;
  const purifying = !!defeatedShown?.boss && (sinceDefeat < BOSS_DEFEAT_MS || !!befriend);
  const koBanner = !!defeatedShown && !defeatedShown.boss && sinceDefeat < KO_BANNER_MS;

  // Which creature/form is on stage right now.
  const current: Shown | null = ready
    ? { creature: creatureFor(state.encounter, order), form: state.round - 1, boss: state.boss }
    : null;
  const onStage: Shown | null = purifying || koBanner ? defeatedShown : current;
  const transforming = !purifying && !!defeatedShown && sinceDefeat >= KO_BANNER_MS && sinceDefeat < KO_BANNER_MS + 600;

  const danger = state.active.some((p) => p.progress > 0.75);
  const mood: CreatureMood =
    purifying ? 'cheer'
    : koBanner ? 'defeated'
    : latest && age(latest) < 420 && latest.outcome === 'correct' ? 'hurt'
    : latest && age(latest) < 600 && (latest.outcome === 'timeout' || latest.outcome === 'wrong') ? 'laugh'
    : danger ? 'attack'
    : 'idle';
  const hurt = recent('timeout', 650);
  const attacking = recent('correct', 300) || recent('defeated', 300);
  const intro = state.phase === 'between' && !koBanner && !purifying;
  const hpPct = (state.monsterHp / state.levelConfig.hitsToDefeat) * 100;
  const companion = spirits?.companion ? (getCreature(spirits.companion) ?? null) : null;
  const glow = onStage ? glowColor(onStage.creature, onStage.form) : '#a855f7';
  const formInfo = current ? current.creature.forms[current.form] : null;
  const cheering = recent('correct', 500) || recent('defeated', 800);
  const hype = Math.min(1, Math.max(0, (state.streak - 2) / 8));

  return (
    <div className="mm-root" style={{ '--demon': glow, '--hype': hype } as CSSProperties}>
      <div className="mm-sky" aria-hidden>
        <div className="mm-moon" />
        <svg className="mm-mountains" viewBox="0 0 1200 200" preserveAspectRatio="none">
          <path d="M0 200 L0 120 L120 60 L220 130 L340 40 L470 140 L560 90 L700 150 L820 50 L950 130 L1060 80 L1200 140 L1200 200 Z" />
        </svg>
        <div className="mm-grid" />
        <div className="mm-speedlines" />
      </div>

      <header className="mm-hud">
        <div className="mm-hp-player" aria-label={`${state.lives} of ${state.maxLives} lives`}>
          <span className="mm-tag">HP</span>
          {Array.from({ length: state.maxLives }, (_, i) => (
            <span key={i} className={`mm-hp-seg ${i < state.lives ? '' : 'is-lost'}`} />
          ))}
        </div>
        <div className="mm-stage">
          <span className="mm-stage__num">STAGE {state.level}</span>
          <span className="mm-stage__name">{state.levelConfig.name}</span>
        </div>
        <div className="mm-score">
          <span className="mm-score__value">{state.score.toLocaleString()}</span>
          {state.streak >= 2 && (
            <span className="mm-combo" key={state.streak}>
              {state.streak} <small>COMBO</small>
            </span>
          )}
        </div>
        <button type="button" className="mm-pause-btn" data-hit="pause" onClick={() => engine.pause()} aria-label="Pause">
          ❚❚
        </button>
      </header>

      <div className={`mm-field ${hurt ? 'is-shaking' : ''}`}>
        <div className="mm-hero-slot">
          <Hero hurt={hurt} attacking={attacking} />
          {companion && (
            <CreatureArt creature={companion} form={4} mood={cheering ? 'cheer' : 'idle'} className="mm-companion" />
          )}
          <div className="mm-platform" />
        </div>

        <div className={`mm-boss ${current?.boss ? 'is-boss' : ''}`}>
          {current && formInfo && (
            <div className="mm-boss__bar">
              <span className="mm-boss__name">{purifying ? onStage!.creature.name : formInfo.title}</span>
              <div className="mm-boss__hp">
                <div className="mm-boss__fill" style={{ width: `${purifying ? 0 : hpPct}%` }} />
              </div>
              <div className="mm-rounds" aria-label={`Round ${state.round} of 5`}>
                {[1, 2, 3, 4, 5].map((r) => (
                  <span
                    key={r}
                    className={['mm-rounds__pip', r < state.round ? 'is-done' : '', r === state.round ? 'is-now' : '', r === 5 ? 'is-boss' : ''].join(' ')}
                  />
                ))}
              </div>
            </div>
          )}
          {onStage && (
            <CreatureArt
              key={`${onStage.creature.id}-${onStage.form}-${onStage.boss && !purifying}`}
              creature={onStage.creature}
              form={onStage.form}
              shard={onStage.boss && !purifying}
              mood={mood}
              className={transforming ? 'is-transforming' : ''}
            />
          )}
          {purifying && sinceDefeat < 900 && <div className="mm-shatter" aria-hidden />}
          <div className="mm-platform mm-platform--demon" />
        </div>

        <div className="mm-lanes">
          {state.active.map((p) => {
            const wrong = state.effects.some((e) => e.outcome === 'wrong' && e.lane === p.lane && age(e) < 400);
            return (
              <div
                key={p.id}
                className={['mm-eq', p.progress > 0.72 ? 'is-danger' : '', wrong ? 'is-wrong' : '', p.recoil > 0 ? 'is-recoil' : ''].join(' ')}
                style={
                  {
                    top: `${laneTop(p.lane, state.lanes)}%`,
                    // Right edge at the demon when p=0, left edge at the hero when p=1.
                    left: `${(1 - p.progress) * 100}%`,
                    '--tx': `${-(1 - p.progress) * 100}%`,
                    '--lane': LANE_COLORS[p.lane % LANE_COLORS.length],
                  } as CSSProperties
                }
              >
                <span className="mm-eq__text">{p.problem.text} = ?</span>
              </div>
            );
          })}

          {state.effects
            .filter((e) => (e.outcome === 'correct' || e.outcome === 'defeated') && age(e) < 700 && e.lane !== null)
            .map((e) => (
              <div
                key={e.id}
                className="mm-strike"
                style={
                  {
                    top: `${laneTop(e.lane!, state.lanes)}%`,
                    '--x': `${(1 - (e.progress ?? 0)) * 100}%`,
                  } as CSSProperties
                }
              >
                <div className="mm-slash" />
                <div className="mm-impact" />
                <div className={`mm-hit-text ${e.fast ? 'is-crit' : ''}`}>{e.fast ? 'CRITICAL!' : 'HIT!'}</div>
                {e.points && <div className="mm-points">+{e.points}</div>}
              </div>
            ))}
        </div>

        {intro && current && formInfo && (
          <div className={`mm-banner ${current.boss ? 'mm-banner--boss' : ''}`} key={`intro${state.level}`}>
            <span className="mm-banner__big">{current.boss ? 'FINAL ROUND' : `ROUND ${state.round}`}</span>
            <span className="mm-banner__mid">{formInfo.title}</span>
            <span className="mm-banner__small">{formInfo.line}</span>
          </div>
        )}
        {koBanner && (
          <div className="mm-banner mm-banner--ko" key={`ko${state.level}`}>
            <span className="mm-banner__big">K.O.!</span>
            <span className="mm-banner__small">The Static is breaking…</span>
          </div>
        )}
        {purifying && !befriend && defeatedShown && (
          <div className="mm-banner mm-banner--purified" key={`pure${state.level}`}>
            <span className="mm-banner__big">PURIFIED!</span>
            <span className="mm-banner__small">{defeatedShown.creature.purifiedLine}</span>
          </div>
        )}
        {state.phase === 'gameover' && (
          <div className="mm-banner mm-banner--over">
            <span className="mm-banner__big">DEFEATED</span>
          </div>
        )}
        {state.phase === 'complete' && (
          <div className="mm-banner">
            <span className="mm-banner__big">CLEAR!</span>
          </div>
        )}
        <div className={`mm-vignette ${hurt ? 'is-on' : ''}`} aria-hidden />
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

      {paused && !befriend && <PauseMenu onResume={() => engine.resume()} onQuit={() => finish('quit')} />}
      {befriend && <BefriendOverlay creature={befriend} currentCompanion={companion} onChoose={chooseBefriend} />}
    </div>
  );
}

function buildAdventureResult(
  state: EngineState,
  events: Parameters<typeof summarize>[1],
  reason: GameResult['reason'],
): GameResult {
  const summary = summarize(state, events);
  const secs = (ms: number | null) => (ms === null ? '–' : `${(ms / 1000).toFixed(1)} s`);
  return {
    reason,
    summary,
    highlights: [
      { label: 'Score', value: summary.score.toLocaleString() },
      { label: 'Stage reached', value: String(summary.levelReached) },
      { label: 'Hits', value: String(summary.correct) },
      { label: 'Accuracy', value: summary.accuracy === null ? '–' : `${Math.round(summary.accuracy * 100)}%` },
      { label: 'Typical answer time', value: secs(summary.medianResponseMs) },
      { label: 'Best combo', value: String(summary.bestStreak) },
      { label: `Input time per answer${summary.inputPace.device ? ` (${DEVICE_NAME[summary.inputPace.device] ?? summary.inputPace.device})` : ''}`, value: secs(summary.inputPace.medianInputMs) },
    ],
  };
}
