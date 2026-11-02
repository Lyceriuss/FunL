import type { Reasoning } from '../../core/mental-math';
import type { ProblemSource } from '../../core/math/problems';
import type { LevelConfig, MathProblem } from '../../core/math/schema';
import {
  applyCell,
  findRoute,
  neighbours,
  START_VALUE,
  step,
  xy,
  type Board,
  type Dir,
} from './board';

/**
 * Maze Duel rules, pure and frame-driven (`tick(dt)`), so they are fully
 * testable without a browser.
 *
 * - You and the rival race to the Star Gate. Each correct answer earns one
 *   piece; a piece is spent on one action:
 *   - build: extend your path one square (the square's operator changes your number)
 *   - block: drop a stone next to the rival's path head (3 stones per game)
 *   - back:  pick up your last square again (to get out of a dead end)
 * - You may step into the gate only when your number equals the target.
 * - Nobody can be sealed off completely: a build or stone that would leave
 *   the other side with no route from its start is not allowed.
 * - The rival answers its own equations at its own pace in a thought bubble
 *   (core/mental-math), and plays its pieces with a simple planner (ai.ts).
 */

export type Who = 'you' | 'rival';
export type Mode = 'build' | 'block';
export const STONES = 3;
export const INTRO_MS = 2600;
/** Wrong answer: show the right one this long before the next equation. */
export const FEEDBACK_MS = 1300;
/** All pieces played (both sides) before the duel ends in a draw. */
export const MAX_MOVES = 140;

export interface Side {
  /** Cells of the path; path[0] is the start square. */
  path: number[];
  /** Number after each square (values[0] = START_VALUE). */
  values: number[];
  stones: number;
  /** Correct answers (pieces earned). */
  pieces: number;
  answered: number;
  builds: number;
  blocks: number;
  backs: number;
}

export interface Question {
  id: number;
  problem: MathProblem;
  shownAt: number;
  input: string;
  inputStartAt: number | null;
}

export type Decision = { kind: 'build'; cell: number } | { kind: 'block'; cell: number } | { kind: 'back' } | { kind: 'none' };

export interface MoveOption {
  cell: number;
  /** Number you'd carry after building here (builds only). */
  value?: number;
  /** A route to the gate still exists from here (builds only). */
  good?: boolean;
  /** Steps into the gate: wins. */
  wins?: boolean;
}

export interface RivalJob {
  id: number;
  problem: MathProblem;
  reasoning: Reasoning;
  thinkMs: number;
  startedAt: number;
  outcome?: 'right' | 'wrong';
  decision?: Decision;
}

export interface Effect {
  id: number;
  kind: 'build' | 'block' | 'back' | 'wrong' | 'right' | 'denied';
  who: Who;
  cell: number | null;
  at: number;
}

export interface DuelState {
  phase: 'intro' | 'playing' | 'paused' | 'won' | 'lost' | 'draw';
  time: number;
  board: Board;
  /** Stones on the board, cell → who dropped it. */
  stones: Map<number, Who>;
  you: Side;
  rival: Side;
  /** Your stage: answering, spending a piece, or seeing the right answer. */
  stage: 'question' | 'action' | 'feedback';
  mode: Mode;
  /** Highlighted cell in the action stage (controller/keyboard). */
  aim: number | null;
  question: Question | null;
  feedback: { answer: number; given: number; text: string; until: number } | null;
  options: { build: MoveOption[]; block: MoveOption[]; back: boolean };
  rivalStage: 'thinking' | 'reveal' | 'acting' | 'rest';
  rivalJob: RivalJob | null;
  rivalUntil: number;
  moves: number;
  effects: Effect[];
  winner: Who | null;
}

export type DuelEvent =
  | { type: 'start'; seed: number; target: number; shortest: number; rival: string }
  | { type: 'problem.show'; id: number; key: string; text: string; answer: number }
  | { type: 'input.start'; id: number }
  | { type: 'input.digit'; digit: number; value: string }
  | { type: 'input.backspace'; value: string }
  | {
      type: 'answer.correct' | 'answer.wrong';
      id: number;
      key: string;
      text: string;
      answer: number;
      given: number;
      responseMs: number;
      firstInputMs: number;
      typingMs: number;
      digits: number;
    }
  | { type: 'answer.empty' }
  | { type: 'move'; who: Who; kind: 'build' | 'block' | 'back'; cell: number; x: number; y: number; value: number; tile: string; good?: boolean }
  | { type: 'move.denied'; who: Who; reason: string }
  | { type: 'mode'; mode: Mode }
  | { type: 'rival.think'; id: number; key: string; strategy: string; thinkMs: number }
  | { type: 'rival.answer'; id: number; key: string; answer: number; given: number; correct: boolean; strategy: string; slip: string | null; thinkMs: number }
  | { type: 'game.end'; result: 'won' | 'lost' | 'draw'; moves: number; timeMs: number }
  | { type: 'pause'; reason: string }
  | { type: 'resume' };

/** What the rival's planner sees when it has a piece to play. */
export interface DuelView {
  board: Board;
  me: Side;
  them: Side;
  options: { build: MoveOption[]; block: MoveOption[]; back: boolean };
  /** Every occupied square (both paths and stones). */
  occupied: ReadonlySet<number>;
  /** Shortest remaining route from my head / their head (null = none). */
  myRoute: number[] | null;
  theirRoute: number[] | null;
}

export interface RivalBrain {
  id: string;
  solve(problem: MathProblem): { reasoning: Reasoning; thinkMs: number };
  decide(view: DuelView): Decision;
}

export interface DuelOptions {
  board: Board;
  level: LevelConfig;
  /** Your equations and the rival's (separate, same rules). */
  source: ProblemSource;
  rivalSource: ProblemSource;
  rival: RivalBrain;
  /** Extra think time the rival waits for your input pace (core/pace). */
  allowance?: (digits: number) => number;
  /** Rival timing (ms): showing its answer, and playing a piece. */
  rivalRevealMs?: number;
  rivalActMs?: number;
}

const head = (s: Side) => s.path[s.path.length - 1];
const value = (s: Side) => s.values[s.values.length - 1];
const other = (w: Who): Who => (w === 'you' ? 'rival' : 'you');

function newSide(start: number): Side {
  return { path: [start], values: [START_VALUE], stones: STONES, pieces: 0, answered: 0, builds: 0, blocks: 0, backs: 0 };
}

export class DuelEngine {
  state: DuelState;
  private readonly opts: DuelOptions;
  private listeners = new Set<(e: DuelEvent) => void>();
  private nextId = 1;
  private pausedFrom: DuelState['phase'] = 'playing';
  private lastProblem: MathProblem | null = null;
  private lastRivalProblem: MathProblem | null = null;

  constructor(opts: DuelOptions) {
    this.opts = opts;
    const b = opts.board;
    this.state = {
      phase: 'intro',
      time: 0,
      board: b,
      stones: new Map(),
      you: newSide(b.start.you),
      rival: newSide(b.start.rival),
      stage: 'question',
      mode: 'build',
      aim: null,
      question: null,
      feedback: null,
      options: { build: [], block: [], back: false },
      rivalStage: 'rest',
      rivalJob: null,
      rivalUntil: INTRO_MS,
      moves: 0,
      effects: [],
      winner: null,
    };
  }

  on(fn: (e: DuelEvent) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(e: DuelEvent) {
    for (const fn of this.listeners) fn(e);
  }

  private started = false;
  start(): void {
    if (this.started) return;
    this.started = true;
    const b = this.state.board;
    this.emit({ type: 'start', seed: b.seed, target: b.target, shortest: b.shortest, rival: this.opts.rival.id });
  }

  side(w: Who): Side {
    return w === 'you' ? this.state.you : this.state.rival;
  }

  // ---------------------------------------------------------------- time

  tick(dt: number): void {
    const s = this.state;
    if (!this.started || s.phase === 'paused' || s.phase === 'won' || s.phase === 'lost' || s.phase === 'draw') return;
    s.time += dt;
    s.effects = s.effects.filter((e) => s.time - e.at < 1500);
    if (s.phase === 'intro') {
      if (s.time >= INTRO_MS) {
        s.phase = 'playing';
        this.nextQuestion();
      }
      return;
    }
    if (s.stage === 'feedback' && s.feedback && s.time >= s.feedback.until) {
      s.feedback = null;
      this.nextQuestion();
    }
    this.tickRival();
  }

  pause(reason = 'player'): void {
    const s = this.state;
    if (s.phase !== 'playing' && s.phase !== 'intro') return;
    this.pausedFrom = s.phase;
    s.phase = 'paused';
    this.emit({ type: 'pause', reason });
  }

  resume(): void {
    if (this.state.phase !== 'paused') return;
    this.state.phase = this.pausedFrom;
    this.emit({ type: 'resume' });
  }

  // ---------------------------------------------------------------- your equations

  private nextQuestion() {
    const s = this.state;
    const p = this.opts.source.next(this.opts.level, this.lastProblem);
    if (!p) return this.end('draw');
    this.lastProblem = p;
    s.stage = 'question';
    s.question = { id: this.nextId++, problem: p, shownAt: s.time, input: '', inputStartAt: null };
    this.emit({ type: 'problem.show', id: s.question.id, key: p.key, text: p.text, answer: p.answer });
  }

  private answering(): Question | null {
    const s = this.state;
    return s.phase === 'playing' && s.stage === 'question' ? s.question : null;
  }

  /** The player started entering an answer (first stick movement, key or tap). */
  markInputStart(): void {
    const q = this.answering();
    if (!q || q.inputStartAt !== null) return;
    q.inputStartAt = this.state.time;
    this.emit({ type: 'input.start', id: q.id });
  }

  digit(d: number): void {
    const q = this.answering();
    if (!q || q.input.length >= 4) return;
    this.markInputStart();
    q.input += String(d);
    this.emit({ type: 'input.digit', digit: d, value: q.input });
  }

  backspace(): void {
    const q = this.answering();
    if (!q || !q.input) return;
    q.input = q.input.slice(0, -1);
    this.emit({ type: 'input.backspace', value: q.input });
  }

  submit(): void {
    const s = this.state;
    const q = this.answering();
    if (!q) return;
    if (!q.input) {
      this.emit({ type: 'answer.empty' });
      return;
    }
    const given = Number(q.input);
    const p = q.problem;
    const start = q.inputStartAt ?? s.time;
    const correct = given === p.answer;
    s.you.answered++;
    this.emit({
      type: correct ? 'answer.correct' : 'answer.wrong',
      id: q.id,
      key: p.key,
      text: p.text,
      answer: p.answer,
      given,
      responseMs: Math.round(s.time - q.shownAt),
      firstInputMs: Math.round(start - q.shownAt),
      typingMs: Math.round(s.time - start),
      digits: q.input.length,
    });
    if (correct) {
      s.you.pieces++;
      this.effect('right', 'you', null);
      s.stage = 'action';
      s.mode = 'build';
      s.aim = null;
      this.refreshOptions();
      // Nothing to build (boxed in): start in block mode if that's possible.
      if (s.options.build.length === 0 && s.options.block.length > 0) s.mode = 'block';
    } else {
      this.effect('wrong', 'you', null);
      s.stage = 'feedback';
      s.feedback = { answer: p.answer, given, text: p.text, until: s.time + FEEDBACK_MS };
    }
  }

  // ---------------------------------------------------------------- your piece

  private acting(): boolean {
    const s = this.state;
    return s.phase === 'playing' && s.stage === 'action';
  }

  setMode(mode: Mode): void {
    const s = this.state;
    if (!this.acting() || s.mode === mode) return;
    if (mode === 'block' && s.options.block.length === 0) return this.deny('you', 'no stones or no place for one');
    s.mode = mode;
    s.aim = null;
    this.emit({ type: 'mode', mode });
  }

  toggleMode(): void {
    this.setMode(this.state.mode === 'build' ? 'block' : 'build');
  }

  /** Controller/keyboard: point at the square next to the head in a direction. */
  aim(dir: Dir): boolean {
    const s = this.state;
    if (!this.acting()) return false;
    const from = s.mode === 'build' ? head(s.you) : head(s.rival);
    const cell = step(from, dir);
    const list = s.mode === 'build' ? s.options.build : s.options.block;
    if (cell === null || !list.some((o) => o.cell === cell)) return false;
    s.aim = cell;
    return true;
  }

  /** Play the piece on the aimed square. */
  place(): boolean {
    const s = this.state;
    if (!this.acting() || s.aim === null) return false;
    return this.placeAt(s.aim);
  }

  /** Touch: tap a highlighted square (build or block, whichever it is). */
  placeAt(cell: number): boolean {
    const s = this.state;
    if (!this.acting()) return false;
    const build = s.options.build.find((o) => o.cell === cell);
    const block = s.options.block.find((o) => o.cell === cell);
    const kind = build && block ? s.mode : build ? 'build' : block ? 'block' : null;
    if (!kind) return false;
    this.apply('you', kind === 'build' ? { kind: 'build', cell } : { kind: 'block', cell });
    this.afterYourMove();
    return true;
  }

  stepBack(): boolean {
    const s = this.state;
    if (!this.acting() || !s.options.back) return false;
    this.apply('you', { kind: 'back' });
    this.afterYourMove();
    return true;
  }

  private afterYourMove() {
    const s = this.state;
    s.aim = null;
    if (s.phase === 'playing') this.nextQuestion();
  }

  // ---------------------------------------------------------------- rules

  /** Every occupied square (both paths and stones). */
  occupied(): Set<number> {
    const s = this.state;
    return new Set([...s.you.path, ...s.rival.path, ...s.stones.keys()]);
  }

  /** Can `who` still reach the gate from their start, given these blocked squares? */
  private canReachFromStart(who: Who, blocked: Set<number>): boolean {
    const s = this.state;
    const start = who === 'you' ? s.board.start.you : s.board.start.rival;
    // Their own path doesn't count: they can always take it back.
    for (const c of this.side(who).path) blocked.delete(c);
    return findRoute(s.board, start, START_VALUE, blocked, 22) !== null;
  }

  /** Legal moves for one side right now. */
  movesFor(who: Who): DuelState['options'] {
    const s = this.state;
    const me = this.side(who);
    const them = this.side(other(who));
    const occ = this.occupied();
    const build: MoveOption[] = [];
    for (const n of neighbours(head(me))) {
      if (occ.has(n)) continue;
      const v = applyCell(s.board.cells[n], value(me), s.board.target);
      if (v === null) continue;
      if (n === s.board.gate) {
        build.push({ cell: n, value: v, good: true, wins: true });
        continue;
      }
      const after = new Set(occ).add(n);
      build.push({ cell: n, value: v, good: findRoute(s.board, n, v, after) !== null });
    }
    const block: MoveOption[] = [];
    const nearGate = new Set([s.board.gate, ...neighbours(s.board.gate)]);
    if (me.stones > 0) {
      for (const n of neighbours(head(them))) {
        // No stones on rocks, or on (or right next to) the gate: there's always a way in.
        if (occ.has(n) || s.board.cells[n].kind === 'rock' || nearGate.has(n)) continue;
        if (!this.canReachFromStart(other(who), new Set(occ).add(n))) continue;
        block.push({ cell: n });
      }
    }
    return { build, block, back: me.path.length > 1 };
  }

  private refreshOptions() {
    this.state.options = this.movesFor('you');
  }

  /** Shortest remaining route from a side's head (null = none from here). */
  routeFor(who: Who): number[] | null {
    const s = this.state;
    const me = this.side(who);
    return findRoute(s.board, head(me), value(me), this.occupied());
  }

  private apply(who: Who, d: Decision) {
    const s = this.state;
    const me = this.side(who);
    if (d.kind === 'none') return;
    let cell: number;
    let good: boolean | undefined;
    if (d.kind === 'build') {
      const v = applyCell(s.board.cells[d.cell], value(me), s.board.target)!;
      me.path.push(d.cell);
      me.values.push(v);
      me.builds++;
      cell = d.cell;
      good = d.cell === s.board.gate || findRoute(s.board, d.cell, v, this.occupied()) !== null;
    } else if (d.kind === 'block') {
      s.stones.set(d.cell, who);
      me.stones--;
      me.blocks++;
      cell = d.cell;
    } else {
      cell = me.path.pop()!;
      me.values.pop();
      me.backs++;
    }
    s.moves++;
    this.effect(d.kind, who, cell);
    const c = s.board.cells[cell];
    const { x, y } = xy(cell);
    this.emit({
      type: 'move',
      who,
      kind: d.kind,
      cell,
      x,
      y,
      value: value(me),
      tile: c.kind === 'op' ? `${c.op}${c.n}` : c.kind,
      ...(good !== undefined ? { good } : {}),
    });
    if (d.kind === 'build' && d.cell === s.board.gate) return this.end(who === 'you' ? 'won' : 'lost');
    if (s.moves >= MAX_MOVES) return this.end('draw');
    // The other side's options may have changed (e.g. a stone landed next to you).
    if (s.stage === 'action' && who === 'rival') {
      this.refreshOptions();
      if (s.aim !== null && ![...s.options.build, ...s.options.block].some((o) => o.cell === s.aim)) s.aim = null;
    }
  }

  private effect(kind: Effect['kind'], who: Who, cell: number | null) {
    const s = this.state;
    s.effects.push({ id: this.nextId++, kind, who, cell, at: s.time });
  }

  private deny(who: Who, reason: string) {
    this.effect('denied', who, null);
    this.emit({ type: 'move.denied', who, reason });
  }

  private end(result: 'won' | 'lost' | 'draw') {
    const s = this.state;
    s.phase = result;
    s.winner = result === 'won' ? 'you' : result === 'lost' ? 'rival' : null;
    this.emit({ type: 'game.end', result, moves: s.moves, timeMs: Math.round(s.time) });
  }

  // ---------------------------------------------------------------- rival

  private tickRival() {
    const s = this.state;
    if (s.time < s.rivalUntil) return;
    const job = s.rivalJob;
    const reveal = this.opts.rivalRevealMs ?? 900;
    const act = this.opts.rivalActMs ?? 700;

    if (s.rivalStage === 'rest' || !job) {
      const p = this.opts.rivalSource.next(this.opts.level, this.lastRivalProblem);
      if (!p) return;
      this.lastRivalProblem = p;
      const { reasoning, thinkMs } = this.opts.rival.solve(p);
      const total = Math.round(thinkMs + (this.opts.allowance?.(String(p.answer).length) ?? 0));
      s.rivalJob = { id: this.nextId++, problem: p, reasoning, thinkMs: total, startedAt: s.time };
      s.rivalStage = 'thinking';
      s.rivalUntil = s.time + total;
      this.emit({ type: 'rival.think', id: s.rivalJob.id, key: p.key, strategy: reasoning.strategy, thinkMs: total });
      return;
    }

    if (s.rivalStage === 'thinking') {
      const right = job.reasoning.answer === job.problem.answer;
      job.outcome = right ? 'right' : 'wrong';
      s.rival.answered++;
      if (right) s.rival.pieces++;
      this.emit({
        type: 'rival.answer',
        id: job.id,
        key: job.problem.key,
        answer: job.problem.answer,
        given: job.reasoning.answer,
        correct: right,
        strategy: job.reasoning.strategy,
        slip: job.reasoning.slip?.id ?? null,
        thinkMs: job.thinkMs,
      });
      s.rivalStage = 'reveal';
      s.rivalUntil = s.time + (right ? reveal : reveal * 1.8);
      return;
    }

    if (s.rivalStage === 'reveal') {
      if (job.outcome !== 'right') {
        s.rivalStage = 'rest';
        s.rivalUntil = s.time + 300;
        return;
      }
      // Decide now (shown during "acting"), play it after a short beat.
      const options = this.movesFor('rival');
      const decision = this.opts.rival.decide({
        board: s.board,
        me: s.rival,
        them: s.you,
        options,
        occupied: this.occupied(),
        myRoute: this.routeFor('rival'),
        theirRoute: this.routeFor('you'),
      });
      job.decision = sanitize(decision, options);
      s.rivalStage = 'acting';
      s.rivalUntil = s.time + act;
      return;
    }

    // acting → play the piece (re-checked: the board may have changed meanwhile).
    const options = this.movesFor('rival');
    let d = job.decision ? sanitize(job.decision, options) : ({ kind: 'none' } as Decision);
    if (d.kind === 'none' && job.decision?.kind !== 'none') {
      d = sanitize(this.opts.rival.decide({ board: s.board, me: s.rival, them: s.you, options, occupied: this.occupied(), myRoute: this.routeFor('rival'), theirRoute: this.routeFor('you') }), options);
    }
    this.apply('rival', d);
    s.rivalStage = 'rest';
    s.rivalUntil = s.time + 350;
  }
}

/** Drop a decision that is no longer legal. */
function sanitize(d: Decision, o: DuelState['options']): Decision {
  if (d.kind === 'build' && o.build.some((m) => m.cell === d.cell)) return d;
  if (d.kind === 'block' && o.block.some((m) => m.cell === d.cell)) return d;
  if (d.kind === 'back' && o.back) return d;
  return { kind: 'none' };
}
