import { evaluate, stepText } from '../../core/math/expression';
import {
  forgeCheck,
  forgeDrop,
  forgeNav,
  forgePrimary,
  forgeQuick,
  forgeSecondary,
  forgeStash,
  forgeTake,
  generateForgePuzzle,
  newBoard,
  type ForgeBoard,
  type ForgeCheck,
  type ForgeMove,
  type ForgePuzzle,
  type ForgeTier,
} from '../../core/math/forge';
import { createRng, type Rng } from '../../core/math/rng';
import { thinkForge, type ForgeThought } from '../../core/mental-math/order';
import { skillFor } from './companion';

/**
 * One Forge practice lesson (pure, frame-driven): 8 puzzles at one level of
 * the Forge ladder, no timer. With a companion, it works through its own
 * puzzles alongside you, thinking out loud (core/mental-math/order),
 * mistakes included; without one you practise alone.
 *
 * After two wrong tries you get a hint (the first calculation of a
 * solution). A puzzle is *clean* when it's sealed within two tries and
 * without a hint; PASS_CLEAN clean puzzles pass the lesson and unlock the
 * next level (see spirits.recordForgeLesson).
 */

export const FORGE_PRACTICE_LENGTH = 8;
/** Wrong tries before a hint appears. */
export const HINT_AFTER = 2;
/** Clean puzzles (≤ 2 tries, no hint) needed to pass a lesson. */
export const PASS_CLEAN = 6;
/** A puzzle counts as clean when sealed within this many tries, without a hint. */
export const CLEAN_TRIES = 2;
const SEALED_MS = 1200;
const PET_REST_MS = { right: 2200, wrong: 3400 };

export interface PlayerForge {
  no: number;
  board: ForgeBoard;
  tier: ForgeTier;
  startedAt: number;
  tries: number;
  feedback: { check: ForgeCheck; key: number; at: number } | null;
  hint: string | null;
  sealedAt: number | null;
}

export interface PetForge {
  no: number;
  puzzle: ForgePuzzle;
  thought: ForgeThought;
  startedAt: number;
  thinkMs: number;
  outcome: 'right' | 'wrong' | null;
  doneAt: number | null;
}

export interface ForgeResult {
  key: string;
  tier: ForgeTier;
  target: number;
  tries: number;
  ms: number;
  hinted: boolean;
}

export type ForgePracticeEvent =
  | { type: 'forge.practice.start'; tier: ForgeTier; length: number; mastery: number | null; passAt: number }
  | { type: 'forge.start'; id: number; key: string; target: number; tier: ForgeTier; pieces: string }
  | { type: 'forge.move'; id: number; move: string; piece: number; row: number }
  | { type: 'forge.check'; id: number; key: string; status: ForgeCheck['status']; value: number | null; text: string | null; error: string | null; tries: number; ms: number }
  | { type: 'forge.sealed'; id: number; key: string; target: number; tier: ForgeTier; tries: number; ms: number; hinted: boolean }
  | { type: 'forge.hint'; id: number; key: string; hint: string }
  | { type: 'forge.companion'; no: number; key: string; tier: ForgeTier; outcome: 'right' | 'wrong'; strategy: string; slip: string | null; text: string; claimed: number; actual: number; thinkMs: number }
  | { type: 'forge.practice.end'; tier: ForgeTier; sealed: number; clean: number; passed: boolean; length: number; petRight: number | null; petWrong: number | null; ms: number };

export class ForgePractice {
  time = 0;
  readonly tier: ForgeTier;
  readonly length: number;
  /** Is a companion practising alongside? */
  readonly withPet: boolean;
  you: PlayerForge;
  pet: PetForge | null = null;
  results: ForgeResult[] = [];
  petScore: { right: number; wrong: number } = { right: 0, wrong: 0 };
  done = false;
  paused = false;
  private nextId = 1;
  private readonly rng: Rng;
  private readonly petRng: Rng;
  private readonly mastery: number | null;
  private listeners = new Set<(e: ForgePracticeEvent) => void>();
  private started = false;

  /** `mastery`: the companion's maths mastery (0–5), or null to practise alone. */
  constructor(opts: { tier: ForgeTier; seed: number; mastery: number | null; length?: number }) {
    this.tier = opts.tier;
    this.length = opts.length ?? FORGE_PRACTICE_LENGTH;
    this.mastery = opts.mastery;
    this.withPet = opts.mastery !== null;
    this.rng = createRng(opts.seed);
    this.petRng = createRng(opts.seed + 99);
    this.you = this.makePuzzle(1);
  }

  on(fn: (e: ForgePracticeEvent) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(e: ForgePracticeEvent) {
    for (const fn of this.listeners) fn(e);
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.emit({ type: 'forge.practice.start', tier: this.tier, length: this.length, mastery: this.mastery, passAt: PASS_CLEAN });
    this.announce();
    if (this.withPet) this.nextPet();
  }

  /** Pause / resume (nothing moves while paused, including the companion). */
  setPaused(on: boolean): void {
    this.paused = on;
  }

  get petDone(): number {
    return this.petScore.right + this.petScore.wrong;
  }

  /** Puzzles sealed within CLEAN_TRIES tries and without a hint. */
  get clean(): number {
    return this.results.filter((r) => r.tries <= CLEAN_TRIES && !r.hinted).length;
  }

  get passed(): boolean {
    return this.clean >= Math.min(PASS_CLEAN, this.length);
  }

  // ---------------------------------------------------------------- time

  tick(dt: number): void {
    if (!this.started || this.paused || this.done) return;
    this.time += dt;
    const y = this.you;
    if (y.sealedAt !== null && this.time - y.sealedAt >= SEALED_MS && this.results.length < this.length) {
      this.you = this.makePuzzle(y.no + 1);
      this.announce();
    }
    const p = this.pet;
    if (p && p.outcome === null && this.time - p.startedAt >= p.thinkMs) {
      p.outcome = p.thought.correct ? 'right' : 'wrong';
      p.doneAt = this.time;
      this.petScore[p.outcome]++;
      this.emit({
        type: 'forge.companion',
        no: p.no,
        key: p.puzzle.key,
        tier: p.puzzle.tier,
        outcome: p.outcome,
        strategy: p.thought.strategyLabel,
        slip: p.thought.slip?.id ?? null,
        text: p.thought.text,
        claimed: p.thought.claimed,
        actual: p.thought.actual,
        thinkMs: Math.round(p.thinkMs),
      });
    }
    if (p && p.outcome && p.doneAt !== null && this.time - p.doneAt >= PET_REST_MS[p.outcome] && p.no < this.length) this.nextPet();
    this.maybeEnd();
  }

  /** Reasoning steps shown so far (they appear one by one while it thinks). */
  petSteps(): ForgeThought['steps'] {
    const p = this.pet;
    if (!p) return [];
    if (p.outcome) return p.thought.steps;
    const f = (this.time - p.startedAt) / p.thinkMs;
    const n = p.thought.steps.length;
    return p.thought.steps.slice(0, Math.max(1, Math.min(n - 1, Math.ceil(f * (n - 1)))));
  }

  /** The companion's row: pieces it has "placed" (all of them once it answers). */
  petRow(): number[] {
    const p = this.pet;
    if (!p) return [];
    if (p.outcome) return p.thought.arrangement;
    const f = (this.time - p.startedAt) / p.thinkMs;
    // It lays the pieces down during the last third of its thinking.
    const k = Math.floor(Math.max(0, (f - 0.66) / 0.34) * p.thought.arrangement.length);
    return p.thought.arrangement.slice(0, k);
  }

  private maybeEnd() {
    if (this.done) return;
    const youDone = this.results.length >= this.length && (this.you.sealedAt === null || this.time - this.you.sealedAt >= SEALED_MS);
    // The lesson ends when you finish; the companion's score counts what it has done by then.
    if (!youDone) return;
    this.done = true;
    this.emit({
      type: 'forge.practice.end',
      tier: this.tier,
      sealed: this.results.length,
      clean: this.clean,
      passed: this.passed,
      length: this.length,
      petRight: this.withPet ? this.petScore.right : null,
      petWrong: this.withPet ? this.petScore.wrong : null,
      ms: Math.round(this.time),
    });
  }

  // ---------------------------------------------------------------- your puzzles

  private makePuzzle(no: number): PlayerForge {
    const puzzle = generateForgePuzzle(this.rng, this.tier);
    return { no, board: newBoard(puzzle), tier: this.tier, startedAt: this.time, tries: 0, feedback: null, hint: null, sealedAt: null };
  }

  private announce() {
    const y = this.you;
    const pz = y.board.puzzle;
    this.emit({ type: 'forge.start', id: y.no, key: pz.key, target: pz.target, tier: y.tier, pieces: pz.pieces.map((p) => (p.kind === 'num' ? p.value : p.kind === 'op' ? p.op : p.kind === 'lp' ? '(' : ')')).join(' ') });
  }

  private active(): PlayerForge | null {
    return this.started && !this.done && !this.paused && this.you.sealedAt === null && this.results.length < this.length ? this.you : null;
  }

  private apply(r: { board: ForgeBoard; move: ForgeMove }): boolean {
    const y = this.active();
    if (!y) return false;
    y.board = r.board;
    const m = r.move;
    if (m.kind === 'pick' || m.kind === 'place' || m.kind === 'return' || m.kind === 'cancel') {
      if (y.feedback && y.feedback.check.status !== 'right') y.feedback = null;
      this.emit({ type: 'forge.move', id: y.no, move: m.kind, piece: m.piece, row: y.board.row.length });
    }
    return m.kind !== 'none';
  }

  nav(dir: 'up' | 'down' | 'left' | 'right') {
    const y = this.active();
    return y ? this.apply(forgeNav(y.board, dir)) : false;
  }
  primary() {
    const y = this.active();
    return y ? this.apply(forgePrimary(y.board)) : false;
  }
  secondary() {
    const y = this.active();
    return y ? this.apply(forgeSecondary(y.board)) : false;
  }
  take(id: number) {
    const y = this.active();
    return y ? this.apply(forgeTake(y.board, id)) : false;
  }
  drop(gap: number) {
    const y = this.active();
    return y ? this.apply(forgeDrop(y.board, gap)) : false;
  }
  stash() {
    const y = this.active();
    return y ? this.apply(forgeStash(y.board)) : false;
  }
  quick(symbol: string) {
    const y = this.active();
    return y ? this.apply(forgeQuick(y.board, symbol)) : false;
  }

  check(): ForgeCheck | null {
    const y = this.active();
    if (!y) return null;
    const check = forgeCheck(y.board);
    if (check.status !== 'incomplete') y.tries++;
    y.feedback = { check, key: this.nextId++, at: this.time };
    const ms = Math.round(this.time - y.startedAt);
    const pz = y.board.puzzle;
    this.emit({
      type: 'forge.check',
      id: y.no,
      key: pz.key,
      status: check.status,
      value: check.status === 'right' || check.status === 'wrong' ? check.value : null,
      text: check.status === 'right' || check.status === 'wrong' ? check.text : null,
      error: check.status === 'invalid' ? check.error.code : null,
      tries: y.tries,
      ms,
    });
    if (check.status === 'wrong' || check.status === 'invalid') {
      if (y.tries >= HINT_AFTER && !y.hint) {
        y.hint = hintFor(pz);
        this.emit({ type: 'forge.hint', id: y.no, key: pz.key, hint: y.hint });
      }
      return check;
    }
    if (check.status !== 'right') return check;

    y.sealedAt = this.time;
    this.results.push({ key: pz.key, tier: y.tier, target: pz.target, tries: y.tries, ms, hinted: y.hint !== null });
    this.emit({ type: 'forge.sealed', id: y.no, key: pz.key, target: pz.target, tier: y.tier, tries: y.tries, ms, hinted: y.hint !== null });
    return check;
  }

  // ---------------------------------------------------------------- companion

  private nextPet() {
    const no = (this.pet?.no ?? 0) + 1;
    const puzzle = generateForgePuzzle(this.petRng, this.tier);
    const skill = skillFor(this.mastery ?? 0);
    const jitter = 0.85 + this.petRng() * 0.3;
    const right = skill >= 1 || this.petRng() < Math.max(0.25, 1 - (0.25 + 0.12 * puzzle.tier) * (1 - skill));
    const thought = thinkForge(puzzle, { proficiency: skill, wrong: !right, rng: this.petRng });
    const thinkMs = (5000 + 2500 * puzzle.tier) * (1.4 - 0.8 * skill) * jitter * (0.7 + 0.05 * Math.min(thought.steps.length, 12));
    this.pet = { no, puzzle, thought, startedAt: this.time, thinkMs, outcome: null, doneAt: null };
  }
}

/** "Start with 3 × 4": the first calculation of the intended solution. */
export function hintFor(puzzle: ForgePuzzle): string {
  const r = evaluate(puzzle.solution.map((id) => puzzle.pieces[id]));
  if (!r.ok || r.steps.length === 0) return 'Try another order';
  const first = r.steps[0];
  const why = first.reason === 'brackets' ? ' (in brackets)' : first.reason === 'times-first' ? ' (× and ÷ first)' : '';
  return `Hint: the first step is ${stepText(first)}${why}`;
}
