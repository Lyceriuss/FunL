import { describe, expect, it } from 'vitest';
import { GeneratedSource } from '../../../core/math/problems';
import { createRng } from '../../../core/math/rng';
import { makeProblem } from '../../../core/math/schema';
import { createRival, newMemory, plan, RIVAL_LEVELS } from '../ai';
import { applyCell, dirTo, findRoute, generateBoard, H, mirror, START_VALUE, W, xy } from '../board';
import { DuelEngine, FEEDBACK_MS, INTRO_MS, STONES, type DuelEvent, type RivalBrain } from '../duel';
import { DUEL_TOPICS } from '../topics';

const level = DUEL_TOPICS[0].level;

/** A rival that never finishes thinking (for testing your side alone). */
const sleepy: RivalBrain = {
  id: 'sleepy',
  solve: (p) => ({ reasoning: { expr: { op: p.op, terms: p.terms }, strategy: 's', strategyLabel: 's', steps: [], answer: p.answer, correct: true }, thinkMs: 1e9 }),
  decide: () => ({ kind: 'none' }),
};

function engine(seed: number, rival: RivalBrain = sleepy) {
  return new DuelEngine({
    board: generateBoard(seed),
    level,
    source: new GeneratedSource(seed + 1),
    rivalSource: new GeneratedSource(seed + 2),
    rival,
  });
}

function answer(e: DuelEngine, value: number) {
  for (const ch of String(value)) e.digit(Number(ch));
  e.submit();
}

/** Start the duel and skip the intro. */
function begin(e: DuelEngine) {
  e.start();
  e.tick(INTRO_MS + 1);
}

describe('board', () => {
  it('is seeded, mirror-symmetric and solvable from both sides', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const b = generateBoard(seed);
      expect(generateBoard(seed)).toEqual(b);
      expect(b.cells).toHaveLength(W * H);
      for (let i = 0; i < b.cells.length; i++) expect(b.cells[mirror(i)]).toEqual(b.cells[i]);
      expect(b.start.rival).toBe(mirror(b.start.you));
      const you = findRoute(b, b.start.you, START_VALUE, new Set(), 22);
      const rival = findRoute(b, b.start.rival, START_VALUE, new Set(), 22);
      expect(you, `seed ${seed}`).not.toBeNull();
      expect(rival).not.toBeNull();
      expect(you!.length).toBe(b.shortest);
      for (let y = 0; y < H; y++) if (y !== 3) expect(b.cells[y * W + 4].kind).toBe('rock');
      expect(you![you!.length - 1]).toBe(b.gate);
      expect(b.shortest).toBeGreaterThanOrEqual(5);
    }
  });

  it('needs operator squares to hit the target', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const b = generateBoard(seed);
      const plain = { ...b, cells: b.cells.map((c) => (c.kind === 'op' ? { kind: 'rock' as const } : c)) };
      expect(findRoute(plain, b.start.you, START_VALUE, new Set(), 22)).toBeNull();
    }
  });

  it('applies operator squares with child-sized rules', () => {
    expect(applyCell({ kind: 'op', op: '+', n: 3 }, 4, 0)).toBe(7);
    expect(applyCell({ kind: 'op', op: '×', n: 2 }, 4, 0)).toBe(8);
    expect(applyCell({ kind: 'op', op: '÷', n: 2 }, 6, 0)).toBe(3);
    expect(applyCell({ kind: 'op', op: '÷', n: 2 }, 5, 0)).toBeNull(); // not divisible
    expect(applyCell({ kind: 'op', op: '-', n: 3 }, 2, 0)).toBeNull(); // below zero
    expect(applyCell({ kind: 'op', op: '×', n: 3 }, 40, 0)).toBeNull(); // too big
    expect(applyCell({ kind: 'rock' }, 4, 0)).toBeNull();
    expect(applyCell({ kind: 'gate' }, 9, 9)).toBe(9);
    expect(applyCell({ kind: 'gate' }, 8, 9)).toBeNull();
  });
});

describe('duel engine', () => {
  it('a correct answer earns a piece; following a route reaches the gate and wins', () => {
    const e = engine(7);
    const events: DuelEvent[] = [];
    e.on((ev) => events.push(ev));
    begin(e);
    const route = findRoute(e.state.board, e.state.board.start.you, START_VALUE, new Set([e.state.board.start.rival]), 22)!;
    let at = e.state.board.start.you;
    for (const cell of route) {
      expect(e.state.stage).toBe('question');
      answer(e, e.state.question!.problem.answer);
      expect(e.state.stage).toBe('action');
      expect(e.aim(dirTo(at, cell)!)).toBe(true);
      expect(e.place()).toBe(true);
      at = cell;
      e.tick(16);
    }
    expect(e.state.phase).toBe('won');
    expect(e.state.you.values[e.state.you.values.length - 1]).toBe(e.state.board.target);
    expect(events.filter((x) => x.type === 'answer.correct')).toHaveLength(route.length);
    expect(events.at(-1)).toMatchObject({ type: 'game.end', result: 'won' });
  });

  it('a wrong answer earns nothing and shows the right answer before the next equation', () => {
    const e = engine(3);
    begin(e);
    const first = e.state.question!;
    answer(e, first.problem.answer + 1);
    expect(e.state.stage).toBe('feedback');
    expect(e.state.you.pieces).toBe(0);
    expect(e.state.feedback?.answer).toBe(first.problem.answer);
    e.tick(FEEDBACK_MS + 1);
    expect(e.state.stage).toBe('question');
    expect(e.state.question!.id).not.toBe(first.id);
  });

  it('times input from the first movement (think time vs input time)', () => {
    const e = engine(5);
    const events: DuelEvent[] = [];
    e.on((ev) => events.push(ev));
    begin(e);
    e.tick(1000);
    e.markInputStart();
    e.tick(700);
    answer(e, e.state.question!.problem.answer);
    const a = events.find((x) => x.type === 'answer.correct') as Extract<DuelEvent, { firstInputMs: number }>;
    expect(a.firstInputMs).toBe(1000);
    expect(a.typingMs).toBe(700);
  });

  it('never lets anyone be sealed off from the gate (random legal play)', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const e = engine(seed);
      const rng = createRng(seed);
      begin(e);
      for (let turn = 0; turn < 60 && e.state.phase === 'playing'; turn++) {
        answer(e, e.state.question!.problem.answer);
        const { build, block, back } = e.state.options;
        const r = rng();
        if (block.length && r < 0.3) e.placeAt(block[Math.floor(rng() * block.length)].cell);
        else if (build.length && r < 0.85) e.placeAt(build[Math.floor(rng() * build.length)].cell);
        else if (back) e.stepBack();
        else if (build.length) e.placeAt(build[0].cell);
        else if (block.length) e.placeAt(block[0].cell);
        const b = e.state.board;
        const stones = new Set(e.state.stones.keys());
        // Each side can still get there from its start, around the other's path and the stones.
        expect(findRoute(b, b.start.you, START_VALUE, new Set([...stones, ...e.state.rival.path]), 22), `seed ${seed} turn ${turn}`).not.toBeNull();
        expect(findRoute(b, b.start.rival, START_VALUE, new Set([...stones, ...e.state.you.path]), 22)).not.toBeNull();
      }
      expect(e.state.you.stones).toBeGreaterThanOrEqual(0);
      expect(e.state.you.stones).toBeLessThanOrEqual(STONES);
    }
  });

  it('stones go next to the rival head and are limited', () => {
    const e = engine(11);
    begin(e);
    let placed = 0;
    for (let i = 0; i < 12; i++) {
      answer(e, e.state.question!.problem.answer);
      const opts = e.state.options.block;
      const rivalHead = e.state.rival.path.at(-1)!;
      for (const o of opts) {
        const a = xy(o.cell);
        const h = xy(rivalHead);
        expect(Math.abs(a.x - h.x) + Math.abs(a.y - h.y)).toBe(1);
      }
      if (e.state.you.stones === 0) expect(opts).toHaveLength(0);
      if (opts.length) {
        e.setMode('block');
        expect(e.state.mode).toBe('block');
        expect(e.placeAt(opts[0].cell)).toBe(true);
        placed++;
      } else {
        e.setMode('block');
        expect(e.state.mode).toBe('build');
        if (e.state.options.build.length) e.placeAt(e.state.options.build[0].cell);
        else e.stepBack();
      }
    }
    expect(placed).toBeGreaterThan(0);
    expect(placed).toBeLessThanOrEqual(STONES);
    expect(e.state.you.stones).toBe(STONES - placed);
    expect(e.state.stones.size).toBe(placed);
  });

  it('step back takes the last square again', () => {
    const e = engine(9);
    begin(e);
    answer(e, e.state.question!.problem.answer);
    e.placeAt(e.state.options.build[0].cell);
    expect(e.state.you.path).toHaveLength(2);
    answer(e, e.state.question!.problem.answer);
    expect(e.state.options.back).toBe(true);
    e.stepBack();
    expect(e.state.you.path).toHaveLength(1);
    expect(e.state.you.values).toEqual([START_VALUE]);
  });

  it('is deterministic for a seed (same rival answers and moves)', () => {
    const run = () => {
      const e = engine(21, createRival(RIVAL_LEVELS.medium, createRng(99)));
      const out: string[] = [];
      e.on((ev) => {
        if (ev.type === 'rival.answer' || ev.type === 'move') out.push(JSON.stringify(ev));
      });
      begin(e);
      for (let i = 0; i < 1200; i++) e.tick(50);
      return out;
    };
    const a = run();
    expect(a.length).toBeGreaterThan(5);
    expect(run()).toEqual(a);
  });
});

describe('rival', () => {
  it('a hard rival reaches the gate on its own against an idle player', () => {
    for (const seed of [2, 4, 8, 16]) {
      const e = engine(seed, createRival(RIVAL_LEVELS.hard, createRng(seed)));
      begin(e);
      for (let i = 0; i < 6000 && e.state.phase === 'playing'; i++) e.tick(50);
      expect(e.state.phase, `seed ${seed}`).toBe('lost');
      expect(e.state.rival.values.at(-1)).toBe(e.state.board.target);
    }
  });

  it('games always finish: rival against an AI player on many boards', () => {
    const results: Record<string, number> = { won: 0, lost: 0, draw: 0 };
    for (let seed = 1; seed <= 30; seed++) {
      const e = engine(seed * 7, createRival(RIVAL_LEVELS.medium, createRng(seed)));
      const me = newMemory();
      const rng = createRng(seed + 1000);
      begin(e);
      for (let i = 0; i < 20000 && e.state.phase === 'playing'; i++) {
        e.tick(50);
        // The AI player answers every 5 s and plays like a medium rival.
        if (e.state.stage === 'question' && e.state.time - e.state.question!.shownAt > 5000) answer(e, e.state.question!.problem.answer);
        if (e.state.stage === 'action') {
          const d = plan(
            { board: e.state.board, me: e.state.you, them: e.state.rival, options: e.state.options, occupied: e.occupied(), myRoute: e.routeFor('you'), theirRoute: e.routeFor('rival') },
            RIVAL_LEVELS.medium,
            rng,
            me,
          );
          if (d.kind === 'build' || d.kind === 'block') expect(e.placeAt(d.cell)).toBe(true);
          else if (d.kind === 'back') expect(e.stepBack()).toBe(true);
          else if (!e.placeAt(e.state.options.build[0]?.cell ?? e.state.options.block[0]?.cell ?? -1)) e.stepBack();
        }
      }
      expect(['won', 'lost'], `seed ${seed * 7}: ${e.state.phase} after ${e.state.moves} moves`).toContain(e.state.phase);
      results[e.state.phase]++;
    }
    // Both sides win sometimes.
    expect(results.won).toBeGreaterThan(3);
    expect(results.lost).toBeGreaterThan(3);
  });

  it('blocks your next square when you are about to win', () => {
    const b = generateBoard(5);
    const theirRoute = [10, 11];
    const d = plan(
      {
        board: b,
        me: { path: [b.start.rival], values: [1], stones: 3, pieces: 0, answered: 0, builds: 0, blocks: 0, backs: 0 },
        them: { path: [b.start.you], values: [1], stones: 3, pieces: 0, answered: 0, builds: 0, blocks: 0, backs: 0 },
        options: { build: [{ cell: 1, value: 2, good: true }], block: [{ cell: 10 }], back: false },
        occupied: new Set([b.start.rival, b.start.you]),
        myRoute: [1, 2, 3, 4, 5],
        theirRoute,
      },
      RIVAL_LEVELS.hard,
      createRng(1),
    );
    expect(d).toEqual({ kind: 'block', cell: 10 });
  });

  it('thinks with mental-math strategies and slips in its reasoning when wrong', () => {
    const brain = createRival(RIVAL_LEVELS.easy, createRng(4));
    let wrong = 0;
    for (let i = 0; i < 80; i++) {
      const { reasoning, thinkMs } = brain.solve(makeProblem(7, '+', 8));
      expect(thinkMs).toBeGreaterThan(500);
      expect(reasoning.steps.length).toBeGreaterThan(0);
      if (!reasoning.correct) {
        wrong++;
        expect(reasoning.slip).toBeDefined();
        expect(reasoning.answer).not.toBe(15);
      }
    }
    expect(wrong).toBeGreaterThan(0);
  });
});

