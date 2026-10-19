import { describe, expect, it } from 'vitest';
import { PASS_CORRECT, TOPIC_LADDER, stageConfig, stagePassed } from '../classroom';
import { MathMonsterEngine, type EngineEvent } from '../engine';
import { DEFAULT_LEVELS } from '../levels';
import { GeneratedSource } from '../problems';

describe('classroom stages', () => {
  it('climbs topic by topic, calm then quick', () => {
    expect(stageConfig(1)).toMatchObject({ topic: TOPIC_LADDER[0].label, pace: 'calm', lanes: 1, speedFactor: 1 });
    expect(stageConfig(2)).toMatchObject({ topic: TOPIC_LADDER[0].label, pace: 'quick', lanes: 2 });
    expect(stageConfig(3)).toMatchObject({ topic: TOPIC_LADDER[1].label, pace: 'calm' });
    expect(stageConfig(2).speedFactor).toBeGreaterThan(stageConfig(1).speedFactor);
  });

  it('has a three-number "find a 10" topic whose sums always contain a ten-pair', async () => {
    const { generate } = await import('../problems');
    const { createRng } = await import('../rng');
    const stage = stageConfig(5);
    expect(stage.topic).toMatch(/find a 10/);
    const rng = createRng(2);
    for (let i = 0; i < 100; i++) {
      const p = generate(rng, stage.levelConfig.rules[0]);
      expect(p.terms).toHaveLength(3);
      const t = p.terms;
      expect(t[0] + t[1] === 10 || t[0] + t[2] === 10 || t[1] + t[2] === 10).toBe(true);
      expect(p.answer).toBe(t[0] + t[1] + t[2]);
    }
  });

  it('keeps getting faster past the last topic', () => {
    const last = TOPIC_LADDER.length * 2;
    expect(stageConfig(last).topic).toBe(TOPIC_LADDER.at(-1)!.label);
    expect(stageConfig(last + 3).speedFactor).toBeGreaterThan(stageConfig(last).speedFactor);
    expect(stageConfig(last + 3).topic).toBe(TOPIC_LADDER.at(-1)!.label);
  });

  it('passes at 75%', () => {
    expect(PASS_CORRECT).toBe(9);
    expect(stagePassed(9)).toBe(true);
    expect(stagePassed(8)).toBe(false);
  });
});

describe('engine.answerFor (companion answers)', () => {
  function setup() {
    const engine = new MathMonsterEngine({ levels: DEFAULT_LEVELS, source: new GeneratedSource(4), lanes: 2 });
    const events: EngineEvent[] = [];
    engine.on((e) => events.push(e));
    engine.start();
    for (let i = 0; i < 20 && engine.state.active.length < 2; i++) engine.tick(1000);
    return { engine, events };
  }

  it('answers exactly the equation it targets', () => {
    const { engine, events } = setup();
    const [first, second] = engine.state.active;
    engine.answerFor(second.id, second.problem.answer);
    expect(events.at(-1)).toMatchObject({ type: 'answer.correct', id: second.id });
    expect(engine.state.active.map((p) => p.id)).toEqual([first.id]);
  });

  it('a wrong targeted answer penalises that equation only', () => {
    const { engine, events } = setup();
    const [first, second] = engine.state.active;
    const before = first.progress;
    engine.answerFor(second.id, second.problem.answer + 1);
    expect(events.at(-1)).toMatchObject({ type: 'answer.wrong', id: second.id });
    expect(first.progress).toBe(before);
    expect(engine.state.active).toHaveLength(2);
  });
});
