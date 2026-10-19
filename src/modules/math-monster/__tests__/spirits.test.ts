import { describe, expect, it } from 'vitest';
import { CREATURES, glowColor, lerpHsl } from '../creatures';
import { classroomUnlocked, emptyProgress, encounterOrder, masteryOf, purify, recordForm, recordPractice, recordStage, setCompanion } from '../spirits';

describe('creature roster', () => {
  it('every creature has 5 forms, a story and unique ids', () => {
    expect(new Set(CREATURES.map((c) => c.id)).size).toBe(CREATURES.length);
    for (const c of CREATURES) {
      expect(c.forms).toHaveLength(5);
      expect(c.story.length).toBeGreaterThanOrEqual(2);
      expect(c.befriendLine).not.toBe('');
    }
  });

  it('interpolates colour the short way round the hue circle', () => {
    expect(lerpHsl([350, 50, 50], [10, 50, 50], 0.5)[0]).toBe(0);
    expect(glowColor(CREATURES[0], 0)).toMatch(/^hsl\(/);
  });
});

describe('spirit progress', () => {
  it('meets unpurified creatures first, then repeats purified ones', () => {
    let p = emptyProgress();
    expect(encounterOrder(p)[0].id).toBe(CREATURES[0].id);
    p = purify(p, CREATURES[0].id, 1);
    const order = encounterOrder(p).map((c) => c.id);
    expect(order[0]).toBe(CREATURES[1].id);
    expect(order.at(-1)).toBe(CREATURES[0].id);
  });

  it('tracks the best form reached and keeps the first purification time', () => {
    let p = recordForm(emptyProgress(), 'nyx', 2);
    p = recordForm(p, 'nyx', 1);
    expect(p.spirits.nyx.bestForm).toBe(2);
    p = purify(p, 'nyx', 100);
    p = purify(p, 'nyx', 200);
    expect(p.spirits.nyx).toMatchObject({ bestForm: 4, purifiedAt: 100 });
  });

  it('only allows purified spirits as companions', () => {
    let p = setCompanion(emptyProgress(), 'nyx');
    expect(p.companion).toBeNull();
    p = setCompanion(purify(p, 'nyx', 1), 'nyx');
    expect(p.companion).toBe('nyx');
    expect(setCompanion(p, null).companion).toBeNull();
  });

  it('raises mastery per finished practice session, capped at 5, only once purified', () => {
    let p = recordPractice(emptyProgress(), 'nyx');
    expect(masteryOf(p, 'nyx')).toBe(0);
    p = purify(p, 'nyx', 1);
    for (let i = 0; i < 7; i++) p = recordPractice(p, 'nyx');
    expect(masteryOf(p, 'nyx')).toBe(5);
  });

  it('unlocks the next classroom stage only when a stage is passed', () => {
    let p = emptyProgress();
    expect(classroomUnlocked(p)).toBe(1);
    p = recordStage(p, 1, false);
    expect(classroomUnlocked(p)).toBe(1);
    p = recordStage(p, 1, true);
    expect(classroomUnlocked(p)).toBe(2);
    p = recordStage(p, 1, true); // replaying an old stage never lowers it
    expect(classroomUnlocked(p)).toBe(2);
  });
});
