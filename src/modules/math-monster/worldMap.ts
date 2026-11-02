import { DEFAULT_LEVELS } from '../../core/math/levels';
import { CREATURES, type Creature } from './creatures';
import { adventureCleared, type SpiritProgress } from './spirits';

/**
 * The Adventure world map (pure). Levels are grouped into worlds of 5 rounds,
 * one spirit per world; round 5 is its boss. After the last world comes the
 * Endless node (level 11 onwards).
 *
 * World 1 = levels 1–5 (Nyx), World 2 = levels 6–10 (Myx), Endless = 11+.
 */

export const ROUNDS_PER_WORLD = 5;
/** Levels on the map before Endless. */
export const MAP_LEVELS = DEFAULT_LEVELS.length;
export const WORLD_COUNT = Math.ceil(MAP_LEVELS / ROUNDS_PER_WORLD);
export const ENDLESS_LEVEL = MAP_LEVELS + 1;

/** 0-based world of a level (also the engine's encounter number in Adventure). */
export const worldOf = (level: number) => Math.floor((level - 1) / ROUNDS_PER_WORLD);
/** 1-based round of a level within its world (5 = boss). */
export const roundOf = (level: number) => ((level - 1) % ROUNDS_PER_WORLD) + 1;

/** The spirit of a world (worlds past the roster are rematches). */
export const worldSpirit = (world: number): Creature => CREATURES[world % CREATURES.length];

/** "1-3" on the map, "∞ 2" past the last world. */
export function mapLabel(level: number): string {
  return level > MAP_LEVELS ? `∞ ${level - MAP_LEVELS}` : `${worldOf(level) + 1}-${roundOf(level)}`;
}

export type MapNodeState = 'done' | 'next' | 'open' | 'locked';

/**
 * A level's state on the map. Nodes open one by one as they are cleared; the
 * first node of every world is always open, so an older child can skip ahead
 * (like the old "where to start" choices). Endless opens after the last world.
 */
export function levelState(p: SpiritProgress, level: number): MapNodeState {
  const cleared = adventureCleared(p, ROUNDS_PER_WORLD);
  const next = Math.min(cleared + 1, ENDLESS_LEVEL);
  if (level >= ENDLESS_LEVEL) return cleared >= MAP_LEVELS ? 'next' : 'locked';
  if (level === next) return 'next';
  if (level <= cleared) return 'done';
  return roundOf(level) === 1 ? 'open' : 'locked';
}

/** Where the player is: the next level to play. */
export function currentLevel(p: SpiritProgress): number {
  return Math.min(adventureCleared(p, ROUNDS_PER_WORLD) + 1, ENDLESS_LEVEL);
}
