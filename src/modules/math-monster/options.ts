import type { Settings } from '../../core/modules/types';
import { MathMonsterEngine } from './engine';
import { DEFAULT_LEVELS, levelAt } from './levels';
import { GeneratedSource, LimitedSource, PackSource, levelsForPack } from './problems';
import type { LevelConfig, MathPack } from './schema';
import { stageConfig } from './classroom';

/**
 * How a Math Monster session is played:
 * - adventure: fight and purify spirits, difficulty rises (presets)
 * - pack:      adventure with a fixed worksheet
 * - practice:  staged classroom with your companion (see classroom.ts)
 */
export type MathOptions =
  | { mode: 'adventure'; startLevel: number; seed?: number }
  | { mode: 'pack'; pack: MathPack; seed?: number }
  | { mode: 'practice'; stage: number; companionId: string; seed?: number };

export function sessionSeed(options: MathOptions): number {
  return options.seed ?? Math.floor(Math.random() * 2 ** 31);
}

export function createEngine(options: MathOptions, settings: Settings, seed: number): MathMonsterEngine {
  const speedMultiplier = Number(settings.speed ?? 1) || 1;
  const lanes = settings.lanes === 'auto' || settings.lanes === undefined ? 'auto' : Number(settings.lanes);

  switch (options.mode) {
    case 'pack':
      return new MathMonsterEngine({
        levels: levelsForPack(options.pack),
        source: new PackSource(options.pack, seed),
        speedUp: options.pack.speedUp,
        speedMultiplier,
        lanes,
      });
    case 'practice': {
      // The stage decides topic, pace and lanes; the speed setting still scales it.
      const stage = stageConfig(options.stage);
      return new MathMonsterEngine({
        levels: [{ ...stage.levelConfig, hitsToDefeat: Number.MAX_SAFE_INTEGER }],
        source: new LimitedSource(new GeneratedSource(seed), stage.length),
        speedUp: 1, // steady pace within a stage: difficulty rises between stages
        speedMultiplier: speedMultiplier * stage.speedFactor,
        lanes: stage.lanes,
        unlimitedLives: true,
        wrongPenalty: 0.05,
        roundsPerEncounter: Number.MAX_SAFE_INTEGER, // no boss rounds in class
      });
    }
    case 'adventure':
      return new MathMonsterEngine({
        levels: DEFAULT_LEVELS,
        source: new GeneratedSource(seed),
        startLevel: options.startLevel,
        speedMultiplier,
        lanes,
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
