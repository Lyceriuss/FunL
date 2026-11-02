import { describe, expect, it } from 'vitest';
import { DEFAULT_LEVELS } from '../../../core/math/levels';
import { GeneratedSource } from '../../../core/math/problems';
import { FORGE_SEALED_MS, FORGE_SEALS, MathMonsterEngine, type EngineEvent } from '../engine';

/** Every round is a boss round, so the first round is a Forge round. */
function bossEngine(extra: Partial<ConstructorParameters<typeof MathMonsterEngine>[0]> = {}) {
  const e = new MathMonsterEngine({ levels: DEFAULT_LEVELS, source: new GeneratedSource(1), roundsPerEncounter: 1, forge: { seed: 3 }, ...extra });
  const events: EngineEvent[] = [];
  e.on((ev) => events.push(ev));
  e.start();
  e.tick(5000);
  return { e, events };
}

function solve(e: MathMonsterEngine) {
  const f = e.state.forge!;
  for (const id of f.board.puzzle.solution) {
    e.forgeTake(id);
    e.forgeDrop(e.state.forge!.board.row.length);
  }
  return e.forgeCheck();
}

describe('Forge boss round', () => {
  it('replaces flying equations with a Forge puzzle', () => {
    const { e, events } = bossEngine();
    expect(e.state.boss).toBe(true);
    expect(e.state.forge).not.toBeNull();
    expect(e.state.active).toHaveLength(0);
    expect(e.state.monsterHp).toBe(FORGE_SEALS);
    expect(events.find((x) => x.type === 'forge.start')).toMatchObject({ tier: 1 });
    e.tick(3000);
    expect(e.state.active).toHaveLength(0);
  });

  it('three forged seals purify the boss', () => {
    const { e, events } = bossEngine();
    for (let i = 0; i < FORGE_SEALS; i++) {
      expect(solve(e)?.status).toBe('right');
      e.tick(FORGE_SEALED_MS + 10);
    }
    expect(events.filter((x) => x.type === 'forge.sealed')).toHaveLength(FORGE_SEALS);
    expect(events.find((x) => x.type === 'monster.defeated')).toMatchObject({ boss: true });
    expect(e.state.stats.forge).toHaveLength(FORGE_SEALS);
    expect(e.state.score).toBeGreaterThan(0);
  });

  it('a full charge costs a life but the puzzle stays', () => {
    const { e, events } = bossEngine();
    const key = e.state.forge!.board.puzzle.key;
    const lives = e.state.lives;
    e.tick(e.state.forge!.chargeMs + 10);
    expect(e.state.lives).toBe(lives - 1);
    expect(e.state.forge!.board.puzzle.key).toBe(key);
    expect(e.state.forge!.charge).toBeLessThan(0.1);
    expect(events.some((x) => x.type === 'forge.charge')).toBe(true);
  });

  it('wrong or unfinished checks explain and never seal', () => {
    const { e } = bossEngine();
    expect(e.forgeCheck()?.status).toBe('incomplete');
    // All pieces in tray order (numbers first) is never valid.
    const f = e.state.forge!;
    for (const id of f.board.puzzle.pieces.map((p) => p.id)) {
      e.forgeTake(id);
      e.forgeDrop(e.state.forge!.board.row.length);
    }
    expect(e.forgeCheck()?.status).toBe('invalid');
    expect(e.state.monsterHp).toBe(FORGE_SEALS);
    expect(e.state.forge!.tries).toBe(1);
  });

  it('the player input pace adds charge time', () => {
    const slow = bossEngine({ forge: { seed: 3, allowance: (pieces) => pieces * 1000 } }).e;
    const fast = bossEngine().e;
    expect(slow.state.forge!.chargeMs - fast.state.forge!.chargeMs).toBe(slow.state.forge!.board.puzzle.pieces.length * 1000);
  });

  it('controller flow: A picks, A places, X takes back', () => {
    const { e } = bossEngine();
    expect(e.forgePrimary()).toBe(true);
    expect(e.state.forge!.board.held).not.toBeNull();
    e.forgePrimary();
    expect(e.state.forge!.board.row).toHaveLength(1);
    e.forgeNav('up');
    e.forgeSecondary();
    expect(e.state.forge!.board.row).toHaveLength(0);
  });
});
