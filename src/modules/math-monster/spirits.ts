import { getProgress, saveProgress } from '../../core/telemetry/storage';
import { MASTERY_MAX } from './companion';
import { CREATURES, type Creature } from './creatures';

/**
 * Per-player creature progress: who has been met, how far each has been
 * purified, and which one is the companion. Pure functions + load/save.
 */

export interface SpiritRecord {
  encountered: boolean;
  /** Highest form reached (0–4). */
  bestForm: number;
  purifiedAt?: number;
  /** Completed practice sessions with the player (0 to MASTERY_MAX). */
  mastery?: number;
}

export interface SpiritProgress {
  version: 1;
  spirits: Record<string, SpiritRecord>;
  companion: string | null;
  /**
   * Practice classroom: highest equation stage the player may start from, and
   * the highest Forge practice level unlocked (separate ladders).
   * `forgeTier` is the v0.12 adaptive tier, read once by forgeUnlockedOf.
   */
  classroom?: { unlocked: number; forgeUnlocked?: number; forgeTier?: number };
}

const MODULE_ID = 'math-monster';

export function emptyProgress(): SpiritProgress {
  return { version: 1, spirits: {}, companion: null };
}

export async function loadSpirits(profileId: string): Promise<SpiritProgress> {
  const p = await getProgress<SpiritProgress>(MODULE_ID, profileId);
  return p?.version === 1 ? p : emptyProgress();
}

export function saveSpirits(profileId: string, p: SpiritProgress): Promise<void> {
  return saveProgress(MODULE_ID, profileId, p);
}

export function isPurified(p: SpiritProgress, id: string): boolean {
  return !!p.spirits[id]?.purifiedAt;
}

/**
 * Order creatures are met in: ones not yet purified first (in roster order),
 * then purified ones again so the journey never runs dry.
 */
export function encounterOrder(p: SpiritProgress): Creature[] {
  const fresh = CREATURES.filter((c) => !isPurified(p, c.id));
  const done = CREATURES.filter((c) => isPurified(p, c.id));
  return [...fresh, ...done];
}

export function recordForm(p: SpiritProgress, id: string, form: number): SpiritProgress {
  const prev = p.spirits[id] ?? { encountered: false, bestForm: 0 };
  return {
    ...p,
    spirits: { ...p.spirits, [id]: { ...prev, encountered: true, bestForm: Math.max(prev.bestForm, form) } },
  };
}

export function purify(p: SpiritProgress, id: string, now: number): SpiritProgress {
  const prev = p.spirits[id] ?? { encountered: true, bestForm: 4 };
  return {
    ...p,
    spirits: { ...p.spirits, [id]: { ...prev, encountered: true, bestForm: 4, purifiedAt: prev.purifiedAt ?? now } },
  };
}

/** Only purified spirits can be companions; `null` clears it. */
export function setCompanion(p: SpiritProgress, id: string | null): SpiritProgress {
  if (id !== null && !isPurified(p, id)) return p;
  return { ...p, companion: id };
}

export function masteryOf(p: SpiritProgress, id: string): number {
  return p.spirits[id]?.mastery ?? 0;
}

/** A finished practice session makes the companion a bit better at maths. */
export function recordPractice(p: SpiritProgress, id: string): SpiritProgress {
  const prev = p.spirits[id];
  if (!prev?.purifiedAt) return p;
  return {
    ...p,
    spirits: { ...p.spirits, [id]: { ...prev, mastery: Math.min(MASTERY_MAX, (prev.mastery ?? 0) + 1) } },
  };
}

export function classroomUnlocked(p: SpiritProgress): number {
  return Math.max(1, p.classroom?.unlocked ?? 1);
}

/** Passing a stage unlocks the next one. */
export function recordStage(p: SpiritProgress, stage: number, passed: boolean): SpiritProgress {
  const unlocked = Math.max(classroomUnlocked(p), passed ? stage + 1 : stage);
  return { ...p, classroom: { ...p.classroom, unlocked } };
}

/** Highest Forge practice level unlocked (1–6). Saves from v0.12 kept an adaptive tier 1–4 instead. */
export function forgeUnlockedOf(p: SpiritProgress): number {
  const c = p.classroom;
  if (c?.forgeUnlocked) return Math.max(1, Math.min(6, c.forgeUnlocked));
  // v0.12 tiers: 1 plus/minus, 2 × before +, 3 brackets, 4 four numbers → v0.13 levels 1, 2, 4, 5.
  const old = c?.forgeTier;
  return old ? ([1, 1, 2, 4, 5][old] ?? 1) : 1;
}

/** A finished Forge lesson: passing unlocks the next level. */
export function recordForgeLesson(p: SpiritProgress, tier: number, passed: boolean): SpiritProgress {
  const unlocked = Math.min(6, Math.max(forgeUnlockedOf(p), passed ? tier + 1 : tier));
  return { ...p, classroom: { unlocked: classroomUnlocked(p), ...p.classroom, forgeUnlocked: unlocked } };
}
