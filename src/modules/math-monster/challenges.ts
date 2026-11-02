import { z } from 'zod';
import { DEFAULT_LEVELS } from '../../core/math/levels';
import { FORGE_MAX_TIER, FORGE_TIERS, type ForgeTier } from '../../core/math/forge';
import type { GameResult } from '../../core/modules/types';
import { getProgress, saveProgress } from '../../core/telemetry/storage';
import { TOPIC_LADDER, stageConfig } from './classroom';

/**
 * Custom challenges: a grown-up builds a short program of 2–10 stages for a
 * player (e.g. "today's challenge"), picking the kind of game and its
 * difficulty for every stage. The player plays it as a small world map:
 * stages open one by one, and clearing the last one completes the challenge.
 *
 * Stage kinds reuse the existing games:
 * - battle:    one Adventure fight on a topic (level 1–10), at a pace
 * - boss:      an Adventure boss fight: forge seals at a Forge level (1–6) before the spirit's attack charges
 * - forge:     a Forge workshop lesson (8 puzzles) at a Forge level
 * - classroom: a classroom lesson (stage 1–18) side by side with the companion
 *
 * Pure functions + zod schema (stored data is validated on load, and is the
 * format a future MCP tool would produce) + load/save. Stored per player in
 * the progress store under its own key, apart from the adventure progress, so
 * "Start the adventure over" keeps the challenges.
 */

export const MIN_STAGES = 2;
export const MAX_STAGES = 10;
/** Battle topics: the Adventure's levels (1–10). */
export const BATTLE_LEVELS = DEFAULT_LEVELS.length;
/** Classroom stages before "beyond" (each topic calm, then quick). */
export const CLASSROOM_STAGES = TOPIC_LADDER.length * 2;

export type StageKind = 'battle' | 'boss' | 'forge' | 'classroom';
export type Pace = 'calm' | 'normal' | 'fast';

const PaceSchema = z.enum(['calm', 'normal', 'fast']);
const tier = z.number().int().min(1).max(FORGE_MAX_TIER);

export const ChallengeStageSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('battle'), level: z.number().int().min(1).max(BATTLE_LEVELS), pace: PaceSchema }),
  z.object({ kind: z.literal('boss'), tier, pace: PaceSchema }),
  z.object({ kind: z.literal('forge'), tier }),
  z.object({ kind: z.literal('classroom'), stage: z.number().int().min(1).max(CLASSROOM_STAGES) }),
]);
export type ChallengeStage = z.infer<typeof ChallengeStageSchema>;

export const ChallengeSchema = z.object({
  id: z.string().min(1).max(40),
  title: z.string().trim().min(1).max(30),
  stages: z.array(ChallengeStageSchema).min(MIN_STAGES).max(MAX_STAGES),
  /** Stages cleared so far, in order (0 = none). */
  cleared: z.number().int().min(0),
  createdAt: z.number(),
  /** Wall-clock time the last stage was first cleared. */
  completedAt: z.number().optional(),
});
export type Challenge = z.infer<typeof ChallengeSchema>;

export interface ChallengeBook {
  version: 1;
  challenges: Challenge[];
  /** The challenge whose map (or builder) is open on the module screen. */
  openId: string | null;
}

export const KIND_INFO: Record<StageKind, { icon: string; label: string; hint: string }> = {
  battle: { icon: '⚔️', label: 'Battle', hint: 'Fight one spirit form with fast equations' },
  boss: { icon: '👑', label: 'Boss fight', hint: 'Forge seals before the spirit attacks' },
  forge: { icon: '🔨', label: 'Forge lesson', hint: '8 order-of-operations puzzles, no rush' },
  classroom: { icon: '📚', label: 'Classroom', hint: '12 equations side by side with your companion' },
};

export const PACE_INFO: Record<Pace, { label: string; speed: number; forgeTime: number }> = {
  calm: { label: 'Calm', speed: 0.7, forgeTime: 1.5 },
  normal: { label: 'Normal', speed: 1, forgeTime: 1 },
  fast: { label: 'Fast', speed: 1.4, forgeTime: 0.7 },
};

/** A new stage of a kind, keeping the difficulty of `from` where it fits. */
export function stageOfKind(kind: StageKind, from?: ChallengeStage): ChallengeStage {
  const pace: Pace = from && 'pace' in from ? from.pace : 'normal';
  const t = from && 'tier' in from ? from.tier : 1;
  switch (kind) {
    case 'battle':
      return { kind, level: from?.kind === 'classroom' ? stageConfig(from.stage).level : 1, pace };
    case 'boss':
      return { kind, tier: t, pace };
    case 'forge':
      return { kind, tier: t };
    case 'classroom':
      return { kind, stage: 1 };
  }
}

/** How many difficulty steps a kind has (battle topics, Forge levels, classroom stages). */
export function levelCount(kind: StageKind): number {
  return kind === 'battle' ? BATTLE_LEVELS : kind === 'classroom' ? CLASSROOM_STAGES : FORGE_MAX_TIER;
}

/** The stage's difficulty step (1-based). */
export function levelOf(s: ChallengeStage): number {
  return s.kind === 'battle' ? s.level : s.kind === 'classroom' ? s.stage : s.tier;
}

export function withLevel(s: ChallengeStage, n: number): ChallengeStage {
  const v = Math.max(1, Math.min(levelCount(s.kind), Math.round(n)));
  return s.kind === 'battle' ? { ...s, level: v } : s.kind === 'classroom' ? { ...s, stage: v } : { ...s, tier: v };
}

/** Name of a difficulty step, e.g. "Times tables", "Brackets", "Take away · quick". */
export function levelName(kind: StageKind, n: number): string {
  if (kind === 'battle') return DEFAULT_LEVELS[n - 1].name;
  if (kind === 'classroom') {
    const c = stageConfig(n);
    return `${c.topic} · ${c.pace}`;
  }
  return FORGE_TIERS[n as ForgeTier].label;
}

/** One line for a stage, e.g. "⚔️ Battle · Times tables · fast". */
export function stageTitle(s: ChallengeStage): string {
  const k = KIND_INFO[s.kind];
  const pace = 'pace' in s && s.pace !== 'normal' ? ` · ${PACE_INFO[s.pace].label.toLowerCase()}` : '';
  return `${k.icon} ${k.label} · ${levelName(s.kind, levelOf(s))}${pace}`;
}

// ----- building -----

export function newChallenge(id: string, title: string, now: number, stages?: ChallengeStage[]): Challenge {
  return {
    id,
    title,
    stages: stages ?? [
      { kind: 'battle', level: 1, pace: 'normal' },
      { kind: 'forge', tier: 1 },
    ],
    cleared: 0,
    createdAt: now,
  };
}

/** Add a stage after `at` (default: at the end), like the stage before it. */
export function addStage(c: Challenge, at = c.stages.length - 1): Challenge {
  if (c.stages.length >= MAX_STAGES) return c;
  const like = c.stages[at] ?? c.stages[c.stages.length - 1];
  const stages = [...c.stages];
  stages.splice(at + 1, 0, { ...like });
  return edited(c, stages);
}

export function removeStage(c: Challenge, i: number): Challenge {
  if (c.stages.length <= MIN_STAGES) return c;
  return edited(c, c.stages.filter((_, j) => j !== i));
}

/** Move stage i by `by` places (−1 = earlier). */
export function moveStage(c: Challenge, i: number, by: number): Challenge {
  const j = i + by;
  if (j < 0 || j >= c.stages.length || j === i) return c;
  const stages = [...c.stages];
  [stages[i], stages[j]] = [stages[j], stages[i]];
  return edited(c, stages);
}

export function setStage(c: Challenge, i: number, s: ChallengeStage): Challenge {
  return edited(c, c.stages.map((x, j) => (j === i ? s : x)));
}

export function renameChallenge(c: Challenge, title: string): Challenge {
  const t = title.trim().slice(0, 30);
  return t ? { ...c, title: t } : c;
}

/** The program changed: cleared stages beyond its new length don't count. */
function edited(c: Challenge, stages: ChallengeStage[]): Challenge {
  const cleared = Math.min(c.cleared, stages.length);
  return { ...c, stages, cleared, completedAt: cleared >= stages.length ? c.completedAt : undefined };
}

// ----- playing -----

export type StageState = 'done' | 'next' | 'locked';

/** Stages open one by one; cleared ones can be played again. */
export function stageState(c: Challenge, i: number): StageState {
  return i < c.cleared ? 'done' : i === c.cleared ? 'next' : 'locked';
}

export const isComplete = (c: Challenge) => c.cleared >= c.stages.length;

/** A stage was played: passing the next stage opens the one after it. */
export function recordStageResult(c: Challenge, i: number, passed: boolean, now: number): Challenge {
  if (!passed || i !== c.cleared) return c;
  const cleared = c.cleared + 1;
  return { ...c, cleared, completedAt: cleared >= c.stages.length ? (c.completedAt ?? now) : c.completedAt };
}

/** Did this game clear the stage? */
export function stageCleared(stage: ChallengeStage, result: GameResult): boolean {
  const sum = result.summary as {
    forgePractice?: { levelsPassed?: number[] };
    practice?: { stages?: { stage: number; passed: boolean }[] };
  };
  switch (stage.kind) {
    case 'battle':
    case 'boss':
      return result.reason === 'completed';
    case 'forge':
      return !!sum.forgePractice?.levelsPassed?.includes(stage.tier);
    case 'classroom':
      // (Without a companion it was played as a battle: then winning the fight counts.)
      return sum.practice ? !!sum.practice.stages?.some((x) => x.stage === stage.stage && x.passed) : result.reason === 'completed';
  }
}

/** Play the challenge again from the first stage. */
export function restartChallenge(c: Challenge): Challenge {
  return { ...c, cleared: 0, completedAt: undefined };
}

// ----- the book (all of a player's challenges) -----

export function emptyBook(): ChallengeBook {
  return { version: 1, challenges: [], openId: null };
}

/** Validate stored data; anything broken is dropped rather than crashing the menu. */
export function parseBook(raw: unknown): ChallengeBook {
  const r = raw as Partial<ChallengeBook> | undefined;
  if (r?.version !== 1 || !Array.isArray(r.challenges)) return emptyBook();
  const challenges = r.challenges.flatMap((c) => {
    const p = ChallengeSchema.safeParse(c);
    return p.success ? [p.data] : [];
  });
  const openId = challenges.some((c) => c.id === r.openId) ? (r.openId ?? null) : null;
  return { version: 1, challenges, openId };
}

export function putChallenge(b: ChallengeBook, c: Challenge): ChallengeBook {
  const has = b.challenges.some((x) => x.id === c.id);
  return { ...b, challenges: has ? b.challenges.map((x) => (x.id === c.id ? c : x)) : [...b.challenges, c] };
}

export function deleteChallenge(b: ChallengeBook, id: string): ChallengeBook {
  return { ...b, challenges: b.challenges.filter((c) => c.id !== id), openId: b.openId === id ? null : b.openId };
}

/** "Challenge 3": the first free default name. */
export function nextTitle(b: ChallengeBook): string {
  const used = new Set(b.challenges.map((c) => c.title));
  for (let n = b.challenges.length + 1; ; n++) if (!used.has(`Challenge ${n}`)) return `Challenge ${n}`;
}

const STORE_ID = 'math-monster.challenges';

export async function loadChallenges(profileId: string): Promise<ChallengeBook> {
  return parseBook(await getProgress<unknown>(STORE_ID, profileId));
}

export function saveChallenges(profileId: string, b: ChallengeBook): Promise<void> {
  return saveProgress(STORE_ID, profileId, b);
}
