import type { Settings } from '../../core/modules/types';
import { MathMonsterEngine, type EngineConfig } from './engine';
import { DEFAULT_LEVELS, levelAt } from '../../core/math/levels';
import { GeneratedSource, LimitedSource, PackSource, levelsForPack } from '../../core/math/problems';
import type { LevelConfig, MathPack } from '../../core/math/schema';
import type { ForgeTier } from '../../core/math/forge';
import { stageConfig } from './classroom';
import { PACE_INFO, type ChallengeStage } from './challenges';
import { roundOf } from './worldMap';

/**
 * How a Math Monster session is played:
 * - adventure: fight and purify spirits, difficulty rises (presets); boss rounds are Forge puzzles
 * - pack:      adventure with a fixed worksheet
 * - practice:  staged classroom with your companion (see classroom.ts)
 * - forge:     Forge practice (order of operations) with your companion (forgePractice.ts)
 * - challenge: one stage of a custom challenge (challenges.ts); plays as one of the above
 *
 * `oneLesson`: a challenge stage. The lesson ends the session (no "next level").
 */
export type MathOptions =
  | { mode: 'adventure'; startLevel: number; seed?: number }
  | { mode: 'pack'; pack: MathPack; seed?: number }
  | { mode: 'practice'; stage: number; companionId: string; seed?: number; oneLesson?: boolean }
  | { mode: 'forge'; companionId: string | null; tier: number; seed?: number; oneLesson?: boolean }
  | ChallengeOptions;

export interface ChallengeOptions {
  mode: 'challenge';
  challengeId: string;
  title: string;
  /** 0-based stage within the challenge, and how many stages it has. */
  index: number;
  total: number;
  stage: ChallengeStage;
  companionId: string | null;
  seed?: number;
}

/**
 * Engine setup for a challenge's battle or boss stage: exactly one fight.
 * A battle is that topic's Adventure round (never a boss round); a boss fight
 * is World 1's boss (Forge levels 1–3) or World 2's (4–6) at the chosen level.
 */
export function challengeFight(stage: ChallengeStage): { level: number; boss: boolean; tier?: number; speed: number; forgeTime: number } {
  if (stage.kind === 'battle') return { level: stage.level, boss: false, ...pick(stage.pace) };
  if (stage.kind === 'boss') // The Forge charge time already divides by the speed: the pace sets the Forge time only.
    return { level: stage.tier <= 3 ? 5 : 10, boss: true, tier: stage.tier, ...pick(stage.pace), speed: 1 };
  throw new Error(`A ${stage.kind} stage is not a fight`);
}
const pick = (pace: keyof typeof PACE_INFO) => ({ speed: PACE_INFO[pace].speed, forgeTime: PACE_INFO[pace].forgeTime });

/** Spirit form shown in a challenge fight: the topic's round in its world (a boss fight: the boss form). */
export function challengeForm(level: number, boss: boolean): number {
  return boss ? 4 : Math.min(roundOf(level), 4) - 1;
}

export function sessionSeed(options: MathOptions): number {
  return options.seed ?? Math.floor(Math.random() * 2 ** 31);
}

/** Extra engine options from the view, e.g. the input allowance from the player's pace. */
export type EngineExtras = Pick<EngineConfig, 'inputAllowance'> & {
  /** Extra Forge charge time for the player's input pace, by number of pieces. */
  forgeAllowance?: (pieces: number) => number;
};

export function createEngine(options: MathOptions, settings: Settings, seed: number, allExtras: EngineExtras = {}): MathMonsterEngine {
  const { forgeAllowance, ...extras } = allExtras;
  const speedMultiplier = Number(settings.speed ?? 1) || 1;
  const lanes = settings.lanes === 'auto' || settings.lanes === undefined ? 'auto' : Number(settings.lanes);

  switch (options.mode) {
    case 'pack':
      return new MathMonsterEngine({
        levels: levelsForPack(options.pack),
        ...extras,
        source: new PackSource(options.pack, seed),
        speedUp: options.pack.speedUp,
        speedMultiplier,
        lanes,
      });
    case 'practice': {
      // The stage decides topic, pace and lanes (the Speed setting is for Adventure).
      const stage = stageConfig(options.stage);
      return new MathMonsterEngine({
        ...extras,
        levels: [{ ...stage.levelConfig, hitsToDefeat: Number.MAX_SAFE_INTEGER }],
        source: new LimitedSource(new GeneratedSource(seed), stage.length),
        speedUp: 1, // steady pace within a stage: difficulty rises between stages
        speedMultiplier: stage.speedFactor,
        lanes: stage.lanes,
        unlimitedLives: true,
        wrongPenalty: 0.05,
        roundsPerEncounter: Number.MAX_SAFE_INTEGER, // no boss rounds in class
      });
    }
    case 'forge':
      throw new Error('Forge practice has no equation engine (see forgePractice.ts)');
    case 'challenge': {
      // One fight. The stage sets the pace (the Speed and Forge time settings are for Adventure).
      const fight = challengeFight(options.stage);
      return new MathMonsterEngine({
        ...extras,
        levels: DEFAULT_LEVELS,
        source: new GeneratedSource(seed),
        startLevel: fight.level,
        endLevel: fight.level,
        // A battle is a single round (never a boss); a boss fight is its world's round 5.
        ...(fight.boss ? { encounterOrigin: 1 } : { roundsPerEncounter: Number.MAX_SAFE_INTEGER }),
        speedMultiplier: fight.speed,
        lanes,
        forge: fight.boss
          ? { seed: seed + 7, allowance: forgeAllowance, timeScale: fight.forgeTime, tierFor: () => fight.tier as ForgeTier }
          : undefined,
      });
    }
    case 'adventure':
      return new MathMonsterEngine({
        ...extras,
        levels: DEFAULT_LEVELS,
        source: new GeneratedSource(seed),
        startLevel: options.startLevel,
        encounterOrigin: 1, // fixed worlds: the world map's levels 1–5, 6–10…
        speedMultiplier,
        lanes,
        // Boss rounds: forge the seal (order of operations), see core/math/forge.
        forge: { seed: seed + 7, allowance: forgeAllowance, timeScale: Number(settings.forgeTime ?? 1) || 1 },
      });
  }
}

/** One topic, held for the whole lesson (it never "levels up"). */
export function practiceLevel(level: number): LevelConfig {
  return { ...levelAt(DEFAULT_LEVELS, level), hitsToDefeat: Number.MAX_SAFE_INTEGER };
}

/**
 * Travel time at normal speed with Auto lanes and no speed-up: the yardstick
 * the companion's mastery is measured against.
 */
export function normalTravelMs(level: LevelConfig): number {
  return Math.round(level.travelMs * (1 + 0.35 * ((level.lanes ?? 1) - 1)));
}
