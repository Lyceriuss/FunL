import { think } from '../../core/mental-math';
import { difficulty } from '../../core/math/difficulty';
import type { Rng } from '../../core/math/rng';
import type { MathProblem } from '../../core/math/schema';
import { findRoute } from './board';
import type { Decision, DuelView, RivalBrain } from './duel';

/**
 * Glitch, the rival. Two halves:
 * - maths: thinks each equation through with real mental-math strategies
 *   (core/mental-math); its mistakes are slips in that reasoning
 * - planning: follows the shortest route to the gate that hits the target,
 *   steps back out of dead ends, and drops a stone on your next square when
 *   you get close
 * Difficulty changes its maths skill, speed, how often it wanders off the
 * best route, and how early it starts blocking.
 */

export interface RivalLevel {
  id: 'easy' | 'medium' | 'hard';
  label: string;
  /** Mental-math proficiency 0–1 (strategy choice, accuracy, speed). */
  skill: number;
  /** Chance of taking another (still workable) square instead of the best one. */
  wander: number;
  /** Starts blocking when your remaining route is this short or shorter. */
  blockWhen: number;
  /** Chance it actually blocks when it could. */
  blockChance: number;
}

export const RIVAL_LEVELS: Record<RivalLevel['id'], RivalLevel> = {
  easy: { id: 'easy', label: 'Easy', skill: 0.15, wander: 0.3, blockWhen: 2, blockChance: 0.5 },
  medium: { id: 'medium', label: 'Medium', skill: 0.5, wander: 0.12, blockWhen: 3, blockChance: 0.8 },
  hard: { id: 'hard', label: 'Hard', skill: 0.85, wander: 0, blockWhen: 4, blockChance: 1 },
};

/** Chance its reasoning is right, by problem difficulty and skill. */
export function rivalCorrectChance(d: number, skill: number): number {
  return Math.max(0.3, Math.min(1, 1 - d * (1 - skill) * 0.8));
}

/** Think time (ms) before it answers. */
export function rivalThinkMs(d: number, skill: number, steps: number, jitter: number): number {
  const stepFactor = 0.8 + 0.05 * Math.min(steps, 6);
  return Math.round((1800 + 5200 * d) * (1.45 - 0.75 * skill) * jitter * stepFactor);
}

export function createRival(level: RivalLevel, rng: Rng): RivalBrain {
  const memory = newMemory();
  return {
    id: level.id,
    solve(problem: MathProblem) {
      const d = difficulty(problem);
      // Always draw the same number of random values, so games replay exactly.
      const jitter = 0.85 + rng() * 0.3;
      const right = rng() < rivalCorrectChance(d, level.skill);
      const reasoning = think({ op: problem.op, terms: problem.terms }, { proficiency: level.skill, wrong: !right, rng });
      return { reasoning, thinkMs: rivalThinkMs(d, level.skill, reasoning.steps.length, jitter) };
    },
    decide(view: DuelView): Decision {
      return plan(view, level, rng, memory);
    },
  };
}

/**
 * Moves it already backed out of, per path (so it backtracks like a person
 * trying another way instead of going round in circles). Forgotten when a
 * square on the board is freed (the other side took one back).
 */
export interface PlanMemory {
  /** Path (cells joined) → squares that led to a dead end from there. */
  dead: Map<string, Set<number>>;
  context: string;
}

export const newMemory = (): PlanMemory => ({ dead: new Map(), context: '' });

/** The planner, separate so it can be tested with fixed views. */
export function plan(view: DuelView, level: RivalLevel, rng: Rng, memory: PlanMemory = newMemory()): Decision {
  const { options, theirRoute, me } = view;
  const wander = rng();
  const blockRoll = rng();
  const mine = new Set(me.path);
  const context = [...view.occupied].filter((c) => !mine.has(c)).sort((a, b) => a - b).join(',');
  // New obstacles never open a way, so dead ends stay dead; only a freed square can.
  const before = memory.context ? memory.context.split(',') : [];
  const now = new Set(context.split(','));
  if (before.some((c) => !now.has(c))) memory.dead.clear();
  memory.context = context;
  const key = me.path.join('.');
  const dead = memory.dead.get(key) ?? new Set<number>();
  const head = me.path[me.path.length - 1];
  const myRoute = dead.size ? findRoute(view.board, head, me.values[me.values.length - 1], new Set([...view.occupied, ...dead])) : view.myRoute;
  const builds = options.build.filter((o) => !dead.has(o.cell));
  const backOut = (): Decision => {
    const parent = me.path.slice(0, -1).join('.');
    if (!memory.dead.has(parent)) memory.dead.set(parent, new Set());
    memory.dead.get(parent)!.add(head);
    return { kind: 'back' };
  };

  // 0. Can step into the gate: do it.
  const win = builds.find((o) => o.wins);
  if (win) return { kind: 'build', cell: win.cell };

  // 1. You're close and ahead of it: drop a stone on your next square.
  if (theirRoute && theirRoute.length <= level.blockWhen && options.block.length > 0) {
    const behind = !myRoute || theirRoute.length <= myRoute.length;
    const next = theirRoute[0];
    if (behind && blockRoll < level.blockChance && options.block.some((o) => o.cell === next)) return { kind: 'block', cell: next };
  }

  // 2. A route from here: follow it (or wander onto another workable square).
  const others = builds.filter((o) => o.good && o.cell !== myRoute?.[0]);
  if (myRoute && myRoute.length > 0) {
    const best = builds.find((o) => o.cell === myRoute[0]);
    if (others.length > 0 && wander < level.wander) return { kind: 'build', cell: others[Math.floor(rng() * others.length)].cell };
    if (best) return { kind: 'build', cell: best.cell };
  }
  // The best square isn't allowed right now: try another workable one.
  if (others.length > 0) return { kind: 'build', cell: others[0].cell };

  // 3. Dead end: take the last square back (and remember not to come back here).
  if (options.back) return backOut();

  // 4. At the start with no route right now (paths in the way): wait, or slow you down.
  if (theirRoute && options.block.some((o) => o.cell === theirRoute[0])) return { kind: 'block', cell: theirRoute[0] };
  return { kind: 'none' };
}
