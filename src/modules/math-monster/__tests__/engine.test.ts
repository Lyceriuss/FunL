import { describe, expect, it } from 'vitest';
import { MathMonsterEngine, type EngineEvent } from '../engine';
import { DEFAULT_LEVELS, levelAt } from '../levels';
import { GeneratedSource, PackSource, generate, levelsForPack } from '../problems';
import { createRng } from '../rng';
import { parseMathPack, type LevelConfig } from '../schema';

function setup(levels: LevelConfig[] = DEFAULT_LEVELS, lives = 3) {
  const engine = new MathMonsterEngine({ levels, source: new GeneratedSource(42), lives });
  const events: EngineEvent[] = [];
  engine.on((e) => events.push(e));
  engine.start();
  engine.tick(1500); // past the intro -> first problem spawns
  return { engine, events };
}

function type(engine: MathMonsterEngine, n: number) {
  for (const ch of String(n)) engine.digit(Number(ch));
  engine.submit();
}

describe('problem generation', () => {
  it('respects rules for every default level', () => {
    const rng = createRng(1);
    for (const level of DEFAULT_LEVELS) {
      for (const rule of level.rules) {
        for (let i = 0; i < 300; i++) {
          const p = generate(rng, rule);
          expect(Number.isInteger(p.answer)).toBe(true);
          expect(p.answer).toBeGreaterThanOrEqual(0);
          if (rule.maxAnswer !== undefined) expect(p.answer).toBeLessThanOrEqual(rule.maxAnswer);
        }
      }
    }
  });

  it('never repeats the same problem twice in a row', () => {
    const src = new GeneratedSource(7);
    let prev = null;
    for (let i = 0; i < 200; i++) {
      const p = src.next(DEFAULT_LEVELS[0], prev);
      if (prev) expect(p.key).not.toBe(prev.key);
      prev = p;
    }
  });

  it('gets faster past the last level, with a floor', () => {
    const last = DEFAULT_LEVELS[DEFAULT_LEVELS.length - 1];
    expect(levelAt(DEFAULT_LEVELS, DEFAULT_LEVELS.length + 1).travelMs).toBeLessThan(last.travelMs);
    expect(levelAt(DEFAULT_LEVELS, 500).travelMs).toBe(2000);
    expect(levelAt(DEFAULT_LEVELS, 500).lanes).toBe(4);
  });
});

describe('engine', () => {
  it('scores a correct answer and records response time', () => {
    const { engine, events } = setup();
    const answer = engine.state.active[0].problem.answer;
    engine.tick(1500);
    type(engine, answer);
    const correct = events.find((e) => e.type === 'answer.correct');
    expect(correct).toMatchObject({ responseMs: 1500, streak: 1, concurrent: 1, frontmost: true });
    expect(engine.state.score).toBeGreaterThan(0);
    expect(engine.state.monsterHp).toBe(DEFAULT_LEVELS[0].hitsToDefeat - 1);
  });

  it('pushes the front equation closer on a wrong answer', () => {
    const { engine, events } = setup();
    const answer = engine.state.active[0].problem.answer;
    type(engine, answer + 1);
    expect(events.some((e) => e.type === 'answer.wrong')).toBe(true);
    expect(engine.state.active[0].progress).toBeGreaterThan(0.1);
    expect(engine.state.streak).toBe(0);
  });

  it('loses a life on timeout and ends the game at zero lives', () => {
    const { engine, events } = setup(DEFAULT_LEVELS, 2);
    engine.tick(DEFAULT_LEVELS[0].travelMs);
    expect(engine.state.lives).toBe(1);
    engine.tick(2000);
    engine.tick(DEFAULT_LEVELS[0].travelMs);
    expect(engine.state.phase).toBe('gameover');
    expect(events.filter((e) => e.type === 'problem.timeout')).toHaveLength(2);
  });

  it('defeats the monster and levels up', () => {
    const { engine, events } = setup();
    for (let i = 0; i < DEFAULT_LEVELS[0].hitsToDefeat; i++) {
      type(engine, engine.state.active[0].problem.answer);
      engine.tick(1000);
    }
    expect(events.some((e) => e.type === 'monster.defeated')).toBe(true);
    expect(engine.state.level).toBe(2);
  });

  it('does not advance time while paused', () => {
    const { engine } = setup();
    engine.pause();
    engine.tick(60_000);
    expect(engine.state.lives).toBe(3);
    engine.resume();
    expect(engine.state.phase).toBe('playing');
  });

  it('rejects input that cannot be an answer', () => {
    const { engine, events } = setup();
    engine.submit();
    for (let i = 0; i < 6; i++) engine.digit(9);
    expect(engine.state.input).toBe('9999');
    expect(events.filter((e) => e.type === 'input.rejected').map((e) => (e as { reason: string }).reason)).toEqual([
      'empty-submit',
      'too-long',
      'too-long',
    ]);
  });

  it('runs several equations at once and hits the one that matches', () => {
    const engine = new MathMonsterEngine({ levels: DEFAULT_LEVELS, source: new GeneratedSource(3), lanes: 3 });
    const events: EngineEvent[] = [];
    engine.on((e) => events.push(e));
    engine.start();
    for (let i = 0; i < 40 && engine.state.active.length < 3; i++) engine.tick(500);
    const active = engine.state.active;
    expect(active).toHaveLength(3);
    expect(new Set(active.map((p) => p.lane)).size).toBe(3);

    // Answer the newest (least dangerous) one.
    const newest = active[active.length - 1];
    const sameAnswer = active.filter((p) => p.problem.answer === newest.problem.answer);
    type(engine, newest.problem.answer);
    const hit = events.find((e) => e.type === 'answer.correct') as { key: string; concurrent: number };
    expect(hit.concurrent).toBe(3);
    expect(engine.state.active).toHaveLength(2);
    // If several share the answer, the most advanced one is hit.
    const expected = sameAnswer.sort((a, b) => b.progress - a.progress)[0];
    expect(hit.key).toBe(expected.problem.key);
  });

  it('speed setting shortens travel time, with a floor', () => {
    const make = (speedMultiplier: number) =>
      new MathMonsterEngine({ levels: DEFAULT_LEVELS, source: new GeneratedSource(1), speedMultiplier, lanes: 1 });
    expect(make(2).currentTravelMs()).toBe(DEFAULT_LEVELS[0].travelMs / 2);
    expect(make(100).currentTravelMs()).toBe(1200);
  });
});

describe('encounters', () => {
  /** Beat the current round by answering everything as it appears. */
  function clearRound(engine: MathMonsterEngine) {
    const level = engine.state.level;
    for (let i = 0; i < 200 && engine.state.level === level; i++) {
      engine.tick(500);
      const cur = engine.state.active[0];
      if (cur) type(engine, cur.problem.answer);
    }
  }

  it('groups rounds into encounters with a boss as the last round', () => {
    const engine = new MathMonsterEngine({ levels: DEFAULT_LEVELS, source: new GeneratedSource(5), startLevel: 3 });
    const starts: { round: number; boss: boolean; encounter: number; hitsToDefeat: number }[] = [];
    engine.on((e) => e.type === 'level.start' && starts.push(e));
    engine.start();
    for (let r = 0; r < 6; r++) clearRound(engine);

    expect(starts.map((s) => [s.encounter, s.round, s.boss])).toEqual([
      [0, 1, false],
      [0, 2, false],
      [0, 3, false],
      [0, 4, false],
      [0, 5, true],
      [1, 1, false],
      [1, 2, false],
    ]);
    // Boss round (level 7) has 1.5× the base hits.
    expect(starts[4].hitsToDefeat).toBe(Math.ceil(levelAt(DEFAULT_LEVELS, 7).hitsToDefeat * 1.5));
  });

  it('gives the boss an extra lane on auto lanes', () => {
    const engine = new MathMonsterEngine({
      levels: DEFAULT_LEVELS,
      source: new GeneratedSource(1),
      startLevel: 1,
      roundsPerEncounter: 1, // every round is a boss round
    });
    expect(engine.state.boss).toBe(true);
    expect(engine.state.lanes).toBe((DEFAULT_LEVELS[0].lanes ?? 1) + 1);
  });

  it('ignores ticks before start()', () => {
    const engine = new MathMonsterEngine({ levels: DEFAULT_LEVELS, source: new GeneratedSource(1) });
    const events: EngineEvent[] = [];
    engine.on((e) => events.push(e));
    engine.tick(5000); // e.g. the view's frame loop running while player data loads
    expect(engine.state.active).toHaveLength(0);
    expect(engine.state.time).toBe(0);
    engine.start();
    engine.tick(1500);
    expect(events.map((e) => e.type)).toEqual(['level.start', 'problem.spawn']);
  });

  it('reports pause reasons', () => {
    const { engine, events } = setup();
    engine.pause('story');
    expect(events.at(-1)).toEqual({ type: 'game.pause', reason: 'story' });
  });
});

describe('packs', () => {
  const raw = {
    id: 'hw-1',
    title: 'Homework',
    order: 'sequence',
    problems: [
      { a: 2, op: '+', b: 2 },
      { a: 9, op: '-', b: 4, answer: 5 },
      { a: 12, op: '÷', b: 3 },
    ],
  };

  it('validates answers given in the pack', () => {
    expect(() => parseMathPack({ ...raw, problems: [{ a: 2, op: '+', b: 2, answer: 5 }] })).toThrow(/is 4/);
    expect(() => parseMathPack({ ...raw, problems: [{ a: 7, op: '÷', b: 2 }] })).toThrow(/evenly/);
  });

  it('plays a pack to completion, retrying missed problems', () => {
    const pack = parseMathPack(raw);
    const engine = new MathMonsterEngine({ levels: levelsForPack(pack), source: new PackSource(pack, 1) });
    const keys: string[] = [];
    engine.on((e) => e.type === 'problem.spawn' && keys.push(e.key));
    engine.start();
    engine.tick(1500);
    engine.tick(pack.travelMs); // miss the first one
    for (let i = 0; i < 40 && engine.state.phase !== 'complete'; i++) {
      engine.tick(1000);
      const cur = engine.state.active[0];
      if (cur) type(engine, cur.problem.answer);
    }
    expect(engine.state.phase).toBe('complete');
    expect(keys).toEqual(['2+2', '9-4', '12÷3', '2+2']);
  });
});
