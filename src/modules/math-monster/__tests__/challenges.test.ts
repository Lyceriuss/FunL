import { describe, expect, it } from 'vitest';
import {
  MAX_STAGES,
  MIN_STAGES,
  addStage,
  isComplete,
  levelCount,
  moveStage,
  newChallenge,
  nextTitle,
  parseBook,
  putChallenge,
  emptyBook,
  recordStageResult,
  removeStage,
  restartChallenge,
  setStage,
  stageCleared,
  stageOfKind,
  stageState,
  stageTitle,
  withLevel,
  type ChallengeStage,
} from '../challenges';
import { challengeFight, challengeForm } from '../options';

const three = (): ChallengeStage[] => [
  { kind: 'battle', level: 3, pace: 'calm' },
  { kind: 'boss', tier: 2, pace: 'normal' },
  { kind: 'forge', tier: 4 },
];

describe('building a challenge', () => {
  it('keeps between 2 and 10 stages', () => {
    let c = newChallenge('a', 'Test', 0);
    expect(c.stages).toHaveLength(MIN_STAGES);
    c = removeStage(c, 0);
    expect(c.stages).toHaveLength(MIN_STAGES);
    for (let i = 0; i < 20; i++) c = addStage(c);
    expect(c.stages).toHaveLength(MAX_STAGES);
  });

  it('adds a copy after the given stage, moves and replaces stages', () => {
    let c = newChallenge('a', 'Test', 0, three());
    c = addStage(c, 0);
    expect(c.stages.map((s) => s.kind)).toEqual(['battle', 'battle', 'boss', 'forge']);
    c = moveStage(c, 3, -1);
    expect(c.stages.map((s) => s.kind)).toEqual(['battle', 'battle', 'forge', 'boss']);
    expect(moveStage(c, 0, -1)).toBe(c);
    c = setStage(c, 1, { kind: 'classroom', stage: 9 });
    expect(stageTitle(c.stages[1])).toBe('📚 Classroom · Plus & minus to 20 · calm');
  });

  it('switching the game keeps the difficulty where it fits, and clamps levels', () => {
    expect(stageOfKind('forge', { kind: 'boss', tier: 5, pace: 'fast' })).toEqual({ kind: 'forge', tier: 5 });
    expect(stageOfKind('boss', { kind: 'forge', tier: 3 })).toEqual({ kind: 'boss', tier: 3, pace: 'normal' });
    expect(stageOfKind('battle', { kind: 'classroom', stage: 13 })).toMatchObject({ kind: 'battle', level: 7 });
    expect(withLevel({ kind: 'forge', tier: 1 }, 99)).toEqual({ kind: 'forge', tier: levelCount('forge') });
  });

  it('names new challenges with the first free number', () => {
    let b = emptyBook();
    expect(nextTitle(b)).toBe('Challenge 1');
    b = putChallenge(b, newChallenge('a', 'Challenge 2', 0));
    expect(nextTitle(b)).toBe('Challenge 3');
  });
});

describe('playing a challenge', () => {
  it('opens stages one by one and completes on the last', () => {
    let c = newChallenge('a', 'Test', 0, three());
    expect([0, 1, 2].map((i) => stageState(c, i))).toEqual(['next', 'locked', 'locked']);
    c = recordStageResult(c, 0, false, 1);
    expect(c.cleared).toBe(0);
    c = recordStageResult(c, 0, true, 1);
    c = recordStageResult(c, 2, true, 2); // not open yet: ignored
    expect(c.cleared).toBe(1);
    c = recordStageResult(c, 1, true, 3);
    c = recordStageResult(c, 0, true, 4); // replaying a cleared stage changes nothing
    c = recordStageResult(c, 2, true, 5);
    expect(isComplete(c)).toBe(true);
    expect(c.completedAt).toBe(5);
    c = restartChallenge(c);
    expect(c.cleared).toBe(0);
    expect(c.completedAt).toBeUndefined();
  });

  it('removing stages keeps the clear count within the program', () => {
    let c = newChallenge('a', 'Test', 0, three());
    c = { ...c, cleared: 3, completedAt: 9 };
    c = removeStage(c, 2);
    expect(c.cleared).toBe(2);
    expect(isComplete(c)).toBe(true);
    c = addStage(c);
    expect(isComplete(c)).toBe(false);
    expect(c.completedAt).toBeUndefined();
  });

  it('decides from the game result whether a stage was cleared', () => {
    const result = (reason: 'completed' | 'gameover' | 'quit', summary: Record<string, unknown> = {}) => ({ reason, summary, highlights: [] });
    expect(stageCleared({ kind: 'battle', level: 2, pace: 'normal' }, result('completed'))).toBe(true);
    expect(stageCleared({ kind: 'boss', tier: 2, pace: 'normal' }, result('gameover'))).toBe(false);
    expect(stageCleared({ kind: 'forge', tier: 3 }, result('completed', { forgePractice: { levelsPassed: [3] } }))).toBe(true);
    expect(stageCleared({ kind: 'forge', tier: 3 }, result('completed', { forgePractice: { levelsPassed: [] } }))).toBe(false);
    expect(stageCleared({ kind: 'classroom', stage: 4 }, result('completed', { practice: { stages: [{ stage: 4, passed: true }] } }))).toBe(true);
  });

  it('a battle is one non-boss round on its topic; a boss fight is a world boss at the Forge level', () => {
    expect(challengeFight({ kind: 'battle', level: 5, pace: 'fast' })).toMatchObject({ level: 5, boss: false, speed: 1.4 });
    expect(challengeFight({ kind: 'boss', tier: 2, pace: 'calm' })).toMatchObject({ level: 5, boss: true, tier: 2, speed: 1, forgeTime: 1.5 });
    expect(challengeFight({ kind: 'boss', tier: 6, pace: 'normal' })).toMatchObject({ level: 10, boss: true });
    expect(challengeForm(5, false)).toBe(3);
    expect(challengeForm(7, false)).toBe(1);
    expect(challengeForm(10, true)).toBe(4);
  });
});

describe('stored challenges', () => {
  it('drops broken challenges and keeps valid ones', () => {
    const good = newChallenge('a', 'Good', 0, three());
    const book = parseBook({
      version: 1,
      openId: 'gone',
      challenges: [good, { ...good, id: 'b', stages: [{ kind: 'battle', level: 99, pace: 'normal' }, good.stages[0]] }, { id: 'c' }],
    });
    expect(book.challenges.map((c) => c.id)).toEqual(['a']);
    expect(book.openId).toBeNull();
    expect(parseBook(undefined)).toEqual(emptyBook());
  });
});
