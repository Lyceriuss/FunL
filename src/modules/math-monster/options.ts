import type { Settings } from '../../core/modules/types';
import { MathMonsterEngine, type EngineConfig } from './engine';
import { DEFAULT_LEVELS, levelAt } from '../../core/math/levels';
import { GeneratedSource, LimitedSource, PackSource, levelsForPack } from '../../core/math/problems';
import type { LevelConfig, MathPack } from '../../core/math/schema';
import { stageConfig } from './classroom';

/**
 * How a Math Monster session is played:
 * - adventure: fight and purify spirits, difficulty rises (presets); boss rounds are Forge puzzles
 * - pack:      adventure with a fixed worksheet
 * - practice:  staged classroom with your companion (see classroom.ts)
 * - forge:     Forge practice (order of operations) with your companion (forgePractice.ts)
 */
export type MathOptions =
  | { mode: 'adventure'; startLevel: number; seed?: number }
  | { mode: 'pack'; pack: MathPack; seed?: number }
  | { mode: 'practice'; stage: number; companionId: string; seed?: number }
  | { mode: 'forge'; companionId: string | null; tier: number; seed?: number };

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
