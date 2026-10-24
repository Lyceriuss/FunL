import { levelAt } from './levels';
import type { ProblemSource } from './problems';
import type { LevelConfig, MathProblem } from './schema';

/**
 * Pure game logic for Math Monster: no DOM, no timers. The view calls
 * `tick(dt)` every frame and forwards player input; the engine emits
 * events that the view animates and telemetry records.
 *
 * Levels are grouped into *encounters* of `roundsPerEncounter` rounds (one
 * creature per encounter). The last round of each encounter is a boss round
 * with more HP and an extra lane. Which creature is shown is up to the view.
 *
 * Several equations can be in flight at once, one per lane. A submitted
 * answer hits whichever equation it solves (the most dangerous one if
 * several share the answer).
 *
 * All times are engine time (ms), which stops while paused, so response
 * times never include pauses.
 */

export type Phase = 'playing' | 'between' | 'paused' | 'gameover' | 'complete';

export interface EngineConfig {
  levels: LevelConfig[];
  source: ProblemSource;
  startLevel?: number;
  lives?: number;
  /** Practice: misses never cost lives and the game never ends in game over. */
  unlimitedLives?: boolean;
  /** Refill lives to full at the start of every new round (default true). */
  refillLives?: boolean;
  /** Speed-up after each correct answer within a level (0.95 = 5% faster). */
  speedUp?: number;
  /** Global speed setting: 2 = equations fly twice as fast. */
  speedMultiplier?: number;
  /** Max simultaneous equations, or 'auto' to follow the level config. */
  lanes?: number | 'auto';
  /** How far (0..1) a wrong answer pushes the front equation toward the player. */
  wrongPenalty?: number;
  /**
   * Knockback: a correct answer pushes every *other* equation in flight back
   * by this much (0..1 of the lane), so a player can claw their way back in
   * multi-lane play. 0 disables it. Default 0.18.
   */
  knockback?: number;
  /**
   * Extra travel time (ms) for an equation, so the player has time to *enter*
   * its answer on their device (see core/pace). Asked once per spawn.
   */
  inputAllowance?: (problem: MathProblem) => number;
  maxInputLength?: number;
  /** Rounds per creature encounter; the last one is the boss round. Default 5. */
  roundsPerEncounter?: number;
}

export interface ActiveProblem {
  id: number;
  lane: number;
  problem: MathProblem;
  spawnedAt: number;
  travelMs: number;
  /** 0 = at the monster, 1 = hit the player. */
  progress: number;
  wrongAnswers: number[];
  /** Knockback still to apply (progress units); while > 0 the equation slides back instead of advancing. */
  recoil: number;
}

export type Outcome = 'correct' | 'wrong' | 'timeout' | 'defeated';

/** Recent outcomes, for view animations. */
export interface Effect {
  id: number;
  outcome: Outcome;
  at: number;
  lane: number | null;
  /** Where along the lane it happened (0..1), for impact effects. */
  progress: number | null;
  points?: number;
  /** Answered while the equation was still far away. */
  fast?: boolean;
}

export interface EngineState {
  phase: Phase;
  time: number;
  level: number;
  levelConfig: LevelConfig;
  /** 0-based creature encounter number in this session. */
  encounter: number;
  /** 1-based round within the encounter. */
  round: number;
  boss: boolean;
  lanes: number;
  monsterHp: number;
  lives: number;
  maxLives: number;
  score: number;
  streak: number;
  bestStreak: number;
  input: string;
  active: ActiveProblem[];
  effects: Effect[];
  stats: {
    correct: number;
    wrong: number;
    timeouts: number;
    solved: SolvedRecord[];
  };
}

export interface SolvedRecord {
  key: string;
  op: MathProblem['op'];
  level: number;
  correct: boolean;
  responseMs: number;
  /** Time from spawn until the player started typing this answer. */
  firstInputMs: number | null;
  wrongAnswers: number[];
  concurrent: number;
}

export type EngineEvent =
  | {
      type: 'level.start';
      level: number;
      name: string;
      hitsToDefeat: number;
      lanes: number;
      travelMs: number;
      encounter: number;
      round: number;
      boss: boolean;
    }
  | {
      type: 'problem.spawn';
      /** Instance id of this equation (unique within the session). */
      id: number;
      key: string;
      text: string;
      answer: number;
      level: number;
      travelMs: number;
      /** Part of travelMs added for entering the answer on the player's device. */
      allowanceMs: number;
      lane: number;
      concurrent: number;
    }
  | { type: 'input.start'; at: number }
  | { type: 'input.digit'; digit: number; value: string }
  | { type: 'input.backspace'; value: string }
  | { type: 'input.rejected'; reason: 'too-long' | 'empty-submit' | 'no-problem' }
  | {
      type: 'answer.correct';
      id: number;
      key: string;
      answer: number;
      responseMs: number;
      firstInputMs: number | null;
      /**
       * Input time for this answer: from the first input movement (stick
       * moved, button, key or tap; see markInputStart) to submit.
       */
      typingMs: number;
      /** Digits in the answer, for input-pace analysis. */
      digits: number;
      keystrokes: number;
      backspaces: number;
      wrongAnswers: number[];
      progress: number;
      points: number;
      streak: number;
      lane: number;
      concurrent: number;
      /** Whether the player answered the most dangerous equation. */
      frontmost: boolean;
      /** How many other equations were knocked back by this answer. */
      pushedBack: number;
    }
  | {
      type: 'answer.wrong';
      /** Instance id of the front equation (the one that got the penalty). */
      id: number;
      given: number;
      /** The equation that got the penalty (the front one). */
      key: string;
      answer: number;
      activeKeys: string[];
      responseMs: number;
      /** Input time for this attempt (see answer.correct). */
      typingMs: number;
      digits: number;
      keystrokes: number;
      backspaces: number;
      progress: number;
    }
  | {
      type: 'problem.timeout';
      id: number;
      key: string;
      answer: number;
      partialInput: string;
      wrongAnswers: number[];
      lane: number;
      concurrent: number;
    }
  | { type: 'life.lost'; lives: number }
  | { type: 'lives.refill'; lives: number; restored: number }
  | { type: 'monster.defeated'; level: number; encounter: number; round: number; boss: boolean }
  | { type: 'game.pause'; reason: PauseReason }
  | { type: 'game.resume' }
  | { type: 'game.over'; score: number; level: number }
  | { type: 'game.complete'; score: number; level: number };

/** Why the game was paused: by the player, or by the game for a story moment. */
export type PauseReason = 'player' | 'hidden' | 'story';

const INTRO_MS = 1200;
const DEFEAT_MS = 1800;
/** Longer pause after a boss so the purification can play out. */
export const BOSS_DEFEAT_MS = 3200;
/** Boss rounds need this many times the hits. */
const BOSS_HP_FACTOR = 1.3;
/** Default lives (refilled every round). */
export const DEFAULT_LIVES = 5;
const FIRST_SPAWN_GAP_MS = 400;
const MIN_TRAVEL_MS = 1200;
/** Extra travel time per extra lane, since there is more to read. */
const LANE_TIME_BONUS = 0.35;
const MAX_EFFECTS = 12;
/** Default knockback per correct answer (share of the lane). */
export const KNOCKBACK = 0.18;
/** How long a knockback slide takes (ms). */
const RECOIL_MS = 250;

export class MathMonsterEngine {
  state: EngineState;
  private listeners = new Set<(e: EngineEvent) => void>();
  private source: ProblemSource;
  private levels: LevelConfig[];
  private speedUp: number;
  private speedMultiplier: number;
  private lanesSetting: number | 'auto';
  private wrongPenalty: number;
  private knockback: number;
  private inputAllowance: ((problem: MathProblem) => number) | null;
  private maxInput: number;
  private unlimitedLives: boolean;
  private refillLives: boolean;
  private roundsPerEncounter: number;
  private startLevelNum: number;
  private betweenUntil = 0;
  private nextSpawnAt = 0;
  private hitsThisLevel = 0;
  private pausedFrom: Phase = 'playing';
  private lastProblem: MathProblem | null = null;
  private lastLane = -1;
  private nextId = 1;
  private started = false;
  /** Current answer attempt bookkeeping. */
  private inputStartedAt: number | null = null;
  private keystrokes = 0;
  private backspaces = 0;

  constructor(cfg: EngineConfig) {
    this.source = cfg.source;
    this.levels = cfg.levels;
    this.speedUp = cfg.speedUp ?? 0.95;
    this.speedMultiplier = cfg.speedMultiplier ?? 1;
    this.lanesSetting = cfg.lanes ?? 'auto';
    this.wrongPenalty = cfg.wrongPenalty ?? 0.12;
    this.knockback = cfg.knockback ?? KNOCKBACK;
    this.inputAllowance = cfg.inputAllowance ?? null;
    this.maxInput = cfg.maxInputLength ?? 4;
    this.unlimitedLives = cfg.unlimitedLives ?? false;
    this.refillLives = cfg.refillLives ?? true;
    this.roundsPerEncounter = Math.max(1, cfg.roundsPerEncounter ?? 5);
    const level = cfg.startLevel ?? 1;
    this.startLevelNum = level;
    const pos = this.positionOf(level);
    const levelConfig = this.configFor(level, pos.boss);
    const lives = cfg.lives ?? DEFAULT_LIVES;
    this.state = {
      phase: 'between',
      time: 0,
      level,
      levelConfig,
      ...pos,
      lanes: this.lanesFor(levelConfig),
      monsterHp: levelConfig.hitsToDefeat,
      lives,
      maxLives: lives,
      score: 0,
      streak: 0,
      bestStreak: 0,
      input: '',
      active: [],
      effects: [],
      stats: { correct: 0, wrong: 0, timeouts: 0, solved: [] },
    };
  }

  on(listener: (e: EngineEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(e: EngineEvent): void {
    for (const l of this.listeners) l(e);
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.startLevel(INTRO_MS);
  }

  tick(dt: number): void {
    const s = this.state;
    // The view may start its frame loop before start() (e.g. while loading
    // player data); nothing happens until the game has actually started.
    if (!this.started) return;
    if (s.phase === 'paused' || s.phase === 'gameover' || s.phase === 'complete') return;
    s.time += dt;

    if (s.phase === 'between') {
      if (s.time < this.betweenUntil) return;
      s.phase = 'playing';
      this.nextSpawnAt = s.time;
    }

    for (const p of s.active) {
      if (p.recoil > 0) {
        // Sliding back after a knockback (no forward travel meanwhile).
        const back = Math.min(p.recoil, (this.knockback * dt) / RECOIL_MS);
        p.progress = Math.max(0, p.progress - back);
        p.recoil = p.progress === 0 ? 0 : p.recoil - back;
      } else {
        p.progress = Math.min(1, p.progress + dt / p.travelMs);
      }
    }
    for (const p of s.active.filter((x) => x.progress >= 1)) {
      this.timeout(p);
      // timeout() may end the game.
      if ((s.phase as Phase) === 'gameover') return;
    }

    if (s.time >= this.nextSpawnAt) this.trySpawn();

    if (s.active.length === 0 && this.source.remaining() === 0) {
      s.phase = 'complete';
      this.emit({ type: 'game.complete', score: s.score, level: s.level });
    }
  }

  /**
   * The player started entering an answer (e.g. moved the controller stick)
   * before typing a digit. Input time is measured from here.
   */
  markInputStart(): void {
    const s = this.state;
    if (s.phase !== 'playing' || s.active.length === 0 || this.inputStartedAt !== null) return;
    this.inputStartedAt = s.time;
    this.emit({ type: 'input.start', at: round1(s.time) });
  }

  digit(d: number): void {
    const s = this.state;
    if (s.phase !== 'playing') {
      this.emit({ type: 'input.rejected', reason: 'no-problem' });
      return;
    }
    if (s.input.length >= this.maxInput) {
      this.emit({ type: 'input.rejected', reason: 'too-long' });
      return;
    }
    // "0" followed by more digits is never a valid answer; replace it.
    s.input = s.input === '0' ? String(d) : s.input + d;
    this.keystrokes++;
    this.inputStartedAt ??= s.time;
    this.emit({ type: 'input.digit', digit: d, value: s.input });
  }

  backspace(): void {
    const s = this.state;
    if (s.phase !== 'playing' || s.input === '') return;
    s.input = s.input.slice(0, -1);
    this.backspaces++;
    this.emit({ type: 'input.backspace', value: s.input });
  }

  submit(): void {
    const s = this.state;
    if (s.phase !== 'playing' || s.active.length === 0) {
      this.emit({ type: 'input.rejected', reason: 'no-problem' });
      return;
    }
    if (s.input === '') {
      this.emit({ type: 'input.rejected', reason: 'empty-submit' });
      return;
    }
    const given = Number(s.input);
    const attempt = {
      startedAt: this.inputStartedAt ?? s.time,
      keystrokes: this.keystrokes,
      backspaces: this.backspaces,
    };
    s.input = '';
    this.inputStartedAt = null;
    this.keystrokes = 0;
    this.backspaces = 0;

    const byDanger = [...s.active].sort((a, b) => b.progress - a.progress);
    const target = byDanger.find((p) => p.problem.answer === given);
    this.applyAnswer(given, attempt, target ?? null, byDanger[0]);
  }

  /**
   * Answer one specific equation, e.g. for a computer-controlled companion.
   * Unlike submit(), a wrong answer can't accidentally hit another equation.
   */
  answerFor(id: number, given: number): void {
    const s = this.state;
    if (s.phase !== 'playing') return;
    const p = s.active.find((x) => x.id === id);
    if (!p) return;
    const attempt = { startedAt: s.time, keystrokes: String(given).length, backspaces: 0 };
    this.applyAnswer(given, attempt, p.problem.answer === given ? p : null, p);
  }

  /** Score an answer: `target` is the equation it solves (null = wrong; `front` gets the penalty). */
  private applyAnswer(
    given: number,
    attempt: { startedAt: number; keystrokes: number; backspaces: number },
    target: ActiveProblem | null,
    front: ActiveProblem,
  ): void {
    const s = this.state;
    const byDanger = [...s.active].sort((a, b) => b.progress - a.progress);

    if (!target) {
      front.wrongAnswers.push(given);
      front.progress = Math.min(0.98, front.progress + this.wrongPenalty);
      s.streak = 0;
      s.stats.wrong++;
      this.effect({ outcome: 'wrong', lane: front.lane, progress: front.progress });
      this.emit({
        type: 'answer.wrong',
        id: front.id,
        given,
        key: front.problem.key,
        answer: front.problem.answer,
        activeKeys: byDanger.map((p) => p.problem.key),
        responseMs: round1(s.time - front.spawnedAt),
        typingMs: round1(s.time - attempt.startedAt),
        digits: String(given).length,
        keystrokes: attempt.keystrokes,
        backspaces: attempt.backspaces,
        progress: round(front.progress),
      });
      return;
    }

    const concurrent = s.active.length;
    const responseMs = round1(s.time - target.spawnedAt);
    const firstInputMs = round1(Math.max(0, attempt.startedAt - target.spawnedAt));
    s.streak++;
    s.bestStreak = Math.max(s.bestStreak, s.streak);
    const points = Math.round(
      (10 + s.level * 2 + Math.round(20 * (1 - target.progress)) + (concurrent - 1) * 5) *
        (1 + Math.min(s.streak - 1, 10) * 0.1),
    );
    s.score += points;
    s.stats.correct++;
    this.record(target, true, responseMs, firstInputMs, concurrent);
    this.emit({
      type: 'answer.correct',
      id: target.id,
      key: target.problem.key,
      answer: target.problem.answer,
      responseMs,
      firstInputMs,
      typingMs: round1(s.time - attempt.startedAt),
      digits: String(target.problem.answer).length,
      keystrokes: attempt.keystrokes,
      backspaces: attempt.backspaces,
      wrongAnswers: target.wrongAnswers,
      progress: round(target.progress),
      points,
      streak: s.streak,
      lane: target.lane,
      concurrent,
      frontmost: target === byDanger[0],
      pushedBack: this.knockback > 0 ? s.active.length - 1 : 0,
    });
    s.active = s.active.filter((p) => p !== target);
    // Knockback: the others get pushed back so the player can claw back time.
    if (this.knockback > 0) for (const p of s.active) p.recoil += this.knockback;
    s.monsterHp--;
    this.hitsThisLevel++;
    const fast = target.progress < 0.35;

    if (s.monsterHp <= 0) {
      const wasBoss = s.boss;
      this.effect({ outcome: 'defeated', lane: target.lane, progress: target.progress, points, fast });
      this.emit({ type: 'monster.defeated', level: s.level, encounter: s.encounter, round: s.round, boss: s.boss });
      s.level++;
      Object.assign(s, this.positionOf(s.level));
      s.levelConfig = this.configFor(s.level, s.boss);
      s.monsterHp = s.levelConfig.hitsToDefeat;
      s.lanes = this.lanesFor(s.levelConfig);
      this.hitsThisLevel = 0;
      const delay = wasBoss ? BOSS_DEFEAT_MS : DEFEAT_MS;
      if (this.source.remaining() !== 0) this.startLevel(delay);
      else this.toBetween(delay);
    } else {
      this.effect({ outcome: 'correct', lane: target.lane, progress: target.progress, points, fast });
      if (s.active.length === 0) this.nextSpawnAt = Math.min(this.nextSpawnAt, s.time + FIRST_SPAWN_GAP_MS);
    }
  }

  pause(reason: PauseReason = 'player'): void {
    const s = this.state;
    if (s.phase !== 'playing' && s.phase !== 'between') return;
    this.pausedFrom = s.phase;
    s.phase = 'paused';
    this.emit({ type: 'game.pause', reason });
  }

  resume(): void {
    if (this.state.phase !== 'paused') return;
    this.state.phase = this.pausedFrom;
    this.emit({ type: 'game.resume' });
  }

  /** Current travel time: level base, faster per hit, slower with more lanes. */
  currentTravelMs(): number {
    const s = this.state;
    const ms =
      (s.levelConfig.travelMs * this.speedUp ** this.hitsThisLevel * (1 + LANE_TIME_BONUS * (s.lanes - 1))) /
      this.speedMultiplier;
    return Math.max(MIN_TRAVEL_MS, Math.round(ms));
  }

  private lanesFor(level: LevelConfig): number {
    const n = this.lanesSetting === 'auto' ? (level.lanes ?? 1) : this.lanesSetting;
    return Math.max(1, Math.min(4, n));
  }

  /** Encounter/round for a level, counted from the level the session started on. */
  private positionOf(level: number): { encounter: number; round: number; boss: boolean } {
    const i = level - this.startLevelNum;
    const round = (i % this.roundsPerEncounter) + 1;
    return { encounter: Math.floor(i / this.roundsPerEncounter), round, boss: round === this.roundsPerEncounter };
  }

  /** Level config with boss modifiers: more HP (same lanes and pace, so it stays fair for children). */
  private configFor(level: number, boss: boolean): LevelConfig {
    const base = levelAt(this.levels, level);
    if (!boss) return base;
    return { ...base, hitsToDefeat: Math.ceil(base.hitsToDefeat * BOSS_HP_FACTOR) };
  }

  private startLevel(delay: number): void {
    const s = this.state;
    // A fresh round, a fresh start: refill lives.
    if (this.refillLives && this.started && s.lives < s.maxLives && !this.unlimitedLives) {
      const restored = s.maxLives - s.lives;
      s.lives = s.maxLives;
      this.emit({ type: 'lives.refill', lives: s.lives, restored });
    }
    this.emit({
      type: 'level.start',
      level: s.level,
      name: s.levelConfig.name,
      hitsToDefeat: s.monsterHp,
      lanes: s.lanes,
      travelMs: this.currentTravelMs(),
      encounter: s.encounter,
      round: s.round,
      boss: s.boss,
    });
    this.toBetween(delay);
  }

  private trySpawn(): void {
    const s = this.state;
    // Never have more in flight than hits left, so a level ends cleanly.
    if (s.active.length >= s.lanes || s.active.length >= s.monsterHp) return;
    if (this.source.remaining() === 0) return;
    const problem = this.source.next(s.levelConfig, this.lastProblem);
    if (!problem) return;
    this.lastProblem = problem;

    const used = new Set(s.active.map((p) => p.lane));
    let lane = 0;
    for (let i = 1; i <= s.lanes; i++) {
      const candidate = (this.lastLane + i) % s.lanes;
      if (!used.has(candidate)) {
        lane = candidate;
        break;
      }
    }
    this.lastLane = lane;

    const baseMs = this.currentTravelMs();
    const allowanceMs = Math.max(0, Math.round(this.inputAllowance?.(problem) ?? 0));
    const travelMs = baseMs + allowanceMs;
    const id = this.nextId++;
    s.active.push({ id, lane, problem, spawnedAt: s.time, travelMs, progress: 0, wrongAnswers: [], recoil: 0 });
    // Stagger spawns so lanes don't all arrive together (based on the base pace).
    this.nextSpawnAt = s.time + Math.max(600, (baseMs / s.lanes) * 0.55);
    this.emit({
      type: 'problem.spawn',
      id,
      key: problem.key,
      text: problem.text,
      answer: problem.answer,
      level: s.level,
      travelMs,
      allowanceMs,
      lane,
      concurrent: s.active.length,
    });
  }

  private timeout(p: ActiveProblem): void {
    const s = this.state;
    const concurrent = s.active.length;
    s.stats.timeouts++;
    s.streak = 0;
    this.record(p, false, round1(s.time - p.spawnedAt), null, concurrent);
    this.emit({
      type: 'problem.timeout',
      id: p.id,
      key: p.problem.key,
      answer: p.problem.answer,
      partialInput: s.input,
      wrongAnswers: p.wrongAnswers,
      lane: p.lane,
      concurrent,
    });
    this.source.requeue?.(p.problem);
    s.active = s.active.filter((x) => x !== p);
    this.effect({ outcome: 'timeout', lane: p.lane, progress: 1 });
    if (this.unlimitedLives) {
      this.nextSpawnAt = Math.max(this.nextSpawnAt, s.time + 900);
      return;
    }
    s.lives--;
    this.emit({ type: 'life.lost', lives: s.lives });
    if (s.lives <= 0) {
      s.phase = 'gameover';
      s.active = [];
      this.emit({ type: 'game.over', score: s.score, level: s.level });
      return;
    }
    this.nextSpawnAt = Math.max(this.nextSpawnAt, s.time + 900);
  }

  private toBetween(ms: number): void {
    this.state.phase = 'between';
    this.betweenUntil = this.state.time + ms;
  }

  private effect(e: Omit<Effect, 'id' | 'at'>): void {
    const s = this.state;
    s.effects.push({ ...e, id: this.nextId++, at: s.time });
    if (s.effects.length > MAX_EFFECTS) s.effects.shift();
  }

  private record(
    p: ActiveProblem,
    correct: boolean,
    responseMs: number,
    firstInputMs: number | null,
    concurrent: number,
  ): void {
    this.state.stats.solved.push({
      key: p.problem.key,
      op: p.problem.op,
      level: this.state.level,
      correct,
      responseMs,
      firstInputMs,
      wrongAnswers: [...p.wrongAnswers],
      concurrent,
    });
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}
