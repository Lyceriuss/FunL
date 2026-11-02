import { describe, expect, it } from 'vitest';
import { CLEAN_TRIES, FORGE_PRACTICE_LENGTH, ForgePractice, HINT_AFTER, PASS_CLEAN, type ForgePracticeEvent } from '../forgePractice';
import { emptyProgress, forgeUnlockedOf, recordForgeLesson } from '../spirits';

function solveYours(s: ForgePractice) {
  for (const id of s.you.board.puzzle.solution) {
    s.take(id);
    s.drop(s.you.board.row.length);
  }
  return s.check();
}

function wrongTry(s: ForgePractice) {
  // Tray order (numbers first) is never a valid row.
  for (const id of s.you.board.puzzle.pieces.map((p) => p.id)) {
    s.take(id);
    s.drop(s.you.board.row.length);
  }
  const c = s.check();
  for (const id of [...s.you.board.row]) {
    s.take(id);
    s.stash();
  }
  return c;
}

describe('Forge practice', () => {
  it('runs a lesson with the companion; it ends when you finish (no waiting for the companion)', () => {
    const s = new ForgePractice({ tier: 1, seed: 5, mastery: 3 });
    const events: ForgePracticeEvent[] = [];
    s.on((e) => events.push(e));
    s.start();
    for (let i = 0; i < FORGE_PRACTICE_LENGTH; i++) {
      // A steady child pace: 12 s per puzzle, so the companion gets through several of its own.
      s.tick(12000);
      expect(solveYours(s)?.status).toBe('right');
      s.tick(1300);
    }
    expect(s.done).toBe(true);
    expect(s.results).toHaveLength(FORGE_PRACTICE_LENGTH);
    expect(s.petDone).toBeGreaterThan(0);
    expect(s.petDone).toBeLessThanOrEqual(FORGE_PRACTICE_LENGTH);
    expect(events.filter((e) => e.type === 'forge.companion')).toHaveLength(s.petDone);
    expect(events.at(-1)).toMatchObject({ type: 'forge.practice.end', sealed: FORGE_PRACTICE_LENGTH, petRight: s.petScore.right });
  });

  it('gives a hint after wrong tries; a hinted puzzle is not clean', () => {
    const s = new ForgePractice({ tier: 2, seed: 8, mastery: 0 });
    s.start();
    for (let i = 0; i < HINT_AFTER; i++) expect(wrongTry(s)?.status).toBe('invalid');
    expect(s.you.hint).toMatch(/first step is/);
    expect(solveYours(s)?.status).toBe('right');
    expect(s.results.at(-1)).toMatchObject({ hinted: true, tries: HINT_AFTER + 1 });
    expect(s.clean).toBe(0);
    expect(s.tier).toBe(2); // the level stays the same within a lesson
  });

  it('passes with enough clean puzzles, fails without', () => {
    const run = (wrongOn: number[]) => {
      const s = new ForgePractice({ tier: 3, seed: 4, mastery: null });
      const events: ForgePracticeEvent[] = [];
      s.on((e) => events.push(e));
      s.start();
      for (let i = 0; i < FORGE_PRACTICE_LENGTH; i++) {
        // Three wrong tries make a puzzle not clean.
        if (wrongOn.includes(i)) for (let k = 0; k < CLEAN_TRIES + 1; k++) wrongTry(s);
        solveYours(s);
        s.tick(1300);
      }
      return events.at(-1);
    };
    expect(run([0, 1])).toMatchObject({ type: 'forge.practice.end', clean: PASS_CLEAN, passed: true, tier: 3 });
    expect(run([0, 1, 2])).toMatchObject({ type: 'forge.practice.end', clean: PASS_CLEAN - 1, passed: false });
  });

  it('solo: no companion, the lesson ends when you finish', () => {
    const s = new ForgePractice({ tier: 1, seed: 3, mastery: null });
    s.start();
    expect(s.withPet).toBe(false);
    expect(s.pet).toBeNull();
    for (let i = 0; i < FORGE_PRACTICE_LENGTH; i++) {
      solveYours(s);
      s.tick(1300);
    }
    expect(s.done).toBe(true);
    expect(s.passed).toBe(true);
  });

  it('the ladder: passing unlocks the next level; old saves map onto the new levels', () => {
    let p = emptyProgress();
    expect(forgeUnlockedOf(p)).toBe(1);
    p = recordForgeLesson(p, 1, false);
    expect(forgeUnlockedOf(p)).toBe(1);
    p = recordForgeLesson(p, 1, true);
    expect(forgeUnlockedOf(p)).toBe(2);
    p = recordForgeLesson(p, 1, true); // replaying an easier level never locks anything
    expect(forgeUnlockedOf(p)).toBe(2);
    p = recordForgeLesson(p, 6, true);
    expect(forgeUnlockedOf(p)).toBe(6);
    // The equation classroom ladder is separate and kept.
    expect(recordForgeLesson({ ...emptyProgress(), classroom: { unlocked: 5 } }, 1, true).classroom?.unlocked).toBe(5);
    // v0.12 adaptive tiers 1–4 → levels 1, 2, 4, 5.
    expect([1, 2, 3, 4].map((t) => forgeUnlockedOf({ ...emptyProgress(), classroom: { unlocked: 1, forgeTier: t } }))).toEqual([1, 2, 4, 5]);
  });

  it('the companion reveals its steps and lays pieces as it thinks', () => {
    const s = new ForgePractice({ tier: 2, seed: 11, mastery: 1 });
    s.start();
    const pet = s.pet!;
    expect(s.petSteps()).toHaveLength(1);
    expect(s.petRow()).toHaveLength(0);
    s.tick(pet.thinkMs * 0.9);
    expect(s.petRow().length).toBeGreaterThan(0);
    s.tick(pet.thinkMs * 0.2);
    expect(pet.outcome).not.toBeNull();
    expect(s.petSteps()).toEqual(pet.thought.steps);
  });
});
