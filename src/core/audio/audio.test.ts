import { describe, expect, it } from 'vitest';
import { DEFAULT_AUDIO, chosenSfx, chosenTrack } from './AudioEngine';
import { MUSIC, MUSIC_SLOTS, SFX } from './library';

/**
 * Minimal fake Web Audio context: records node creation so every sound
 * recipe can run in Node without a real audio device.
 */
function fakeCtx() {
  const param = () => ({
    value: 0,
    setValueAtTime() {},
    exponentialRampToValueAtTime() {},
    linearRampToValueAtTime() {},
    setTargetAtTime() {},
  });
  const node = () => {
    const n: Record<string, unknown> = {
      connect: (x: unknown) => x,
      disconnect() {},
      start() {},
      stop() {},
      gain: param(),
      frequency: param(),
      Q: param(),
      type: '',
      buffer: null,
      loop: false,
    };
    return n;
  };
  let created = 0;
  const ctx = {
    currentTime: 0,
    sampleRate: 8000,
    createOscillator: () => (created++, node()),
    createGain: () => (created++, node()),
    createBiquadFilter: () => (created++, node()),
    createBufferSource: () => (created++, node()),
    createBuffer: (_c: number, len: number) => ({ getChannelData: () => new Float32Array(len), sampleRate: 8000 }),
  };
  return { ctx: ctx as unknown as BaseAudioContext, created: () => created };
}

describe('sound library', () => {
  it('every effect slot has a default and at least 3 audible variants plus silence', () => {
    for (const s of SFX) {
      expect(s.variants.some((v) => v.id === s.default), s.slot).toBe(true);
      expect(s.variants.filter((v) => v.id !== 'none').length, s.slot).toBeGreaterThanOrEqual(3);
      expect(s.variants.some((v) => v.id === 'none'), s.slot).toBe(true);
      for (const v of s.variants) expect(v.mood).toBeTruthy();
    }
  });

  it('every effect plays without errors and makes sound (except silence)', () => {
    for (const s of SFX) {
      for (const v of s.variants) {
        const { ctx, created } = fakeCtx();
        expect(() => v.play(ctx, {} as AudioNode, 0)).not.toThrow();
        if (v.id !== 'none') expect(created(), `${s.slot}/${v.id}`).toBeGreaterThan(0);
      }
    }
  });

  it('every music track runs a whole loop without errors', () => {
    for (const t of MUSIC) {
      const { ctx, created } = fakeCtx();
      for (let step = 0; step < t.bars * 8; step++) t.step(ctx, {} as AudioNode, step, step * 0.2, 0.2);
      expect(created(), t.id).toBeGreaterThan(0);
    }
    for (const m of MUSIC_SLOTS) expect(MUSIC.some((t) => t.id === m.default), m.slot).toBe(true);
  });

  it('falls back to defaults for unknown or missing choices', () => {
    const s = { ...DEFAULT_AUDIO, sfxChoice: { correct: 'does-not-exist' }, musicChoice: { boss: 'none' as const } };
    expect(chosenSfx(s, 'correct')).toBe('chime');
    expect(chosenSfx(s, 'wrong')).toBe('soft-boop');
    expect(chosenTrack(s, 'boss')).toBe('none');
    expect(chosenTrack(s, 'menu')).toBe('calm-pads');
  });
});
