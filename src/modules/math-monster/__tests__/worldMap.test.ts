import { describe, expect, it } from 'vitest';
import { CREATURES } from '../creatures';
import { adventureCleared, emptyProgress, purify, recordCleared } from '../spirits';
import { ENDLESS_LEVEL, MAP_LEVELS, currentLevel, levelState, mapLabel, roundOf, worldOf, worldSpirit } from '../worldMap';

describe('Adventure world map', () => {
  it('groups levels into worlds of 5 with the boss last, then Endless', () => {
    expect([1, 5, 6, 10, 11].map((l) => [worldOf(l), roundOf(l)])).toEqual([
      [0, 1],
      [0, 5],
      [1, 1],
      [1, 5],
      [2, 1],
    ]);
    expect([1, 3, 10, 11, 13].map(mapLabel)).toEqual(['1-1', '1-3', '2-5', '∞ 1', '∞ 3']);
    expect(worldSpirit(0).id).toBe(CREATURES[0].id);
    expect(worldSpirit(1).id).toBe(CREATURES[1].id);
  });

  it('opens nodes one by one, with every world gate open', () => {
    const p = emptyProgress();
    expect(currentLevel(p)).toBe(1);
    expect(levelState(p, 1)).toBe('next');
    expect(levelState(p, 2)).toBe('locked');
    expect(levelState(p, 6)).toBe('open'); // world 2's gate
    expect(levelState(p, 7)).toBe('locked');
    expect(levelState(p, ENDLESS_LEVEL)).toBe('locked');

    const q = recordCleared(recordCleared(p, 1), 2);
    expect(adventureCleared(q)).toBe(2);
    expect(levelState(q, 1)).toBe('done');
    expect(levelState(q, 3)).toBe('next');
    expect(currentLevel(q)).toBe(3);
    // Replaying an earlier node never moves you back.
    expect(adventureCleared(recordCleared(q, 1))).toBe(2);
  });

  it('opens Endless after the last world and stays there', () => {
    const p = recordCleared(emptyProgress(), MAP_LEVELS);
    expect(levelState(p, ENDLESS_LEVEL)).toBe('next');
    expect(currentLevel(p)).toBe(ENDLESS_LEVEL);
    expect(currentLevel(recordCleared(p, MAP_LEVELS + 4))).toBe(ENDLESS_LEVEL);
  });

  it('reads saves from before the map: each purified spirit is a cleared world', () => {
    const p = purify(emptyProgress(), CREATURES[0].id, 1);
    expect(adventureCleared(p)).toBe(5);
    expect(currentLevel(p)).toBe(6);
  });
});
