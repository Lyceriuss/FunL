import { getLogger } from '../log/logger';
import { MUSIC, MUSIC_SLOTS, SFX, sfxSlot, track, type MusicSlot, type MusicTrack, type SfxSlot } from './library';

const log = getLogger('audio');
const KEY = 'funl.audio';

export interface AudioSettings {
  muted: boolean;
  /** 0–1 */
  master: number;
  music: number;
  sfx: number;
  /** Chosen variant per effect slot. */
  sfxChoice: Partial<Record<SfxSlot, string>>;
  /** Chosen track per music slot ('none' = silence). */
  musicChoice: Partial<Record<MusicSlot, string>>;
}

export const DEFAULT_AUDIO: AudioSettings = { muted: false, master: 0.8, music: 0.45, sfx: 0.8, sfxChoice: {}, musicChoice: {} };

export function loadAudioSettings(): AudioSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<AudioSettings>;
    return { ...DEFAULT_AUDIO, ...raw, sfxChoice: { ...raw.sfxChoice }, musicChoice: { ...raw.musicChoice } };
  } catch {
    return { ...DEFAULT_AUDIO };
  }
}

/** Effect variant id in use for a slot. */
export function chosenSfx(s: AudioSettings, slot: SfxSlot): string {
  const def = sfxSlot(slot);
  const id = s.sfxChoice[slot];
  return id && def.variants.some((v) => v.id === id) ? id : def.default;
}

/** Track id in use for a music slot ('none' = silence). */
export function chosenTrack(s: AudioSettings, slot: MusicSlot): string {
  const id = s.musicChoice[slot];
  if (id === 'none' || (id && track(id))) return id;
  return MUSIC_SLOTS.find((m) => m.slot === slot)!.default;
}

const LOOKAHEAD_S = 0.25;
const TICK_MS = 50;

/**
 * Sound for the whole app. Lazily creates its AudioContext on the first user
 * gesture (browser autoplay rules), keeps master/music/effects buses, plays
 * effects by slot, and runs one generative music loop at a time.
 */
export class AudioEngine {
  settings: AudioSettings = loadAudioSettings();
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private playing: { track: MusicTrack; gain: GainNode; step: number; next: number; timer: ReturnType<typeof setInterval> } | null = null;
  /** The music slot the app asked for (previews temporarily override it). */
  private wantedSlot: MusicSlot | null = null;
  private wantedTrack: string | null = null;
  private ducked = false;
  private listeners = new Set<() => void>();

  /** Call from a user gesture: creates/resumes the AudioContext. */
  unlock(): void {
    if (typeof window === 'undefined' || !('AudioContext' in window)) return;
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
        this.master = this.ctx.createGain();
        this.musicBus = this.ctx.createGain();
        this.sfxBus = this.ctx.createGain();
        this.musicBus.connect(this.master);
        this.sfxBus.connect(this.master);
        this.master.connect(this.ctx.destination);
        this.applyVolumes();
        log.info('audio started', { sampleRate: this.ctx.sampleRate });
      } catch (err) {
        log.warn('audio unavailable', err);
        return;
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    // Start music the app asked for before audio was allowed.
    if (this.wantedTrack && !this.playing) this.startTrack(this.wantedTrack);
  }

  get ready(): boolean {
    return !!this.ctx && this.ctx.state === 'running';
  }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  update(patch: Partial<AudioSettings>): void {
    this.settings = {
      ...this.settings,
      ...patch,
      sfxChoice: { ...this.settings.sfxChoice, ...patch.sfxChoice },
      musicChoice: { ...this.settings.musicChoice, ...patch.musicChoice },
    };
    try {
      localStorage.setItem(KEY, JSON.stringify(this.settings));
    } catch {
      /* storage unavailable: settings last for this visit only */
    }
    this.applyVolumes();
    // A different track chosen for the slot that is playing: switch now.
    if (this.wantedSlot && patch.musicChoice?.[this.wantedSlot]) this.music(this.wantedSlot, true);
    this.listeners.forEach((l) => l());
  }

  /** Play the chosen effect for a game moment. */
  sfx(slot: SfxSlot): void {
    this.playVariant(slot, chosenSfx(this.settings, slot));
  }

  /** Play a specific effect variant (auditioning in the Sound panel). */
  playVariant(slot: SfxSlot, id: string): void {
    if (!this.ctx || !this.sfxBus || this.settings.muted) return;
    const v = SFX.find((s) => s.slot === slot)?.variants.find((x) => x.id === id);
    if (!v) return;
    try {
      v.play(this.ctx, this.sfxBus, this.ctx.currentTime + 0.01);
    } catch (err) {
      log.warn('sound failed', { slot, id, error: err });
    }
  }

  /** Switch music to the track chosen for a mood slot (null = silence). */
  music(slot: MusicSlot | null, force = false): void {
    this.wantedSlot = slot;
    const id = slot ? chosenTrack(this.settings, slot) : 'none';
    if (!force && id === this.wantedTrack) return;
    this.wantedTrack = id;
    this.startTrack(id);
  }

  /** Audition a track; `restoreMusic()` goes back to what the app wants. */
  previewTrack(id: string): void {
    this.startTrack(id);
  }

  restoreMusic(): void {
    if (this.wantedTrack) this.startTrack(this.wantedTrack);
  }

  /** Lower the music (e.g. while paused). */
  duck(on: boolean): void {
    this.ducked = on;
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx || !this.master || !this.musicBus || !this.sfxBus) return;
    const t = this.ctx.currentTime;
    const s = this.settings;
    this.master.gain.setTargetAtTime(s.muted ? 0 : s.master, t, 0.03);
    this.musicBus.gain.setTargetAtTime(s.music * (this.ducked ? 0.35 : 1), t, 0.08);
    this.sfxBus.gain.setTargetAtTime(s.sfx, t, 0.03);
  }

  private stopTrack(): void {
    if (!this.playing || !this.ctx) return;
    const { gain, timer } = this.playing;
    clearInterval(timer);
    gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.15);
    setTimeout(() => gain.disconnect(), 1200);
    this.playing = null;
  }

  private startTrack(id: string): void {
    const t = track(id);
    if (this.playing?.track.id === id) return;
    this.stopTrack();
    if (!t || !this.ctx || !this.musicBus) return;
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.setTargetAtTime(1, ctx.currentTime, 0.4);
    gain.connect(this.musicBus);
    const stepDur = 60 / t.bpm / 2;
    const loop = t.bars * 8;
    const state = { track: t, gain, step: 0, next: ctx.currentTime + 0.1, timer: 0 as unknown as ReturnType<typeof setInterval> };
    state.timer = setInterval(() => {
      while (state.next < ctx.currentTime + LOOKAHEAD_S) {
        try {
          t.step(ctx, gain, state.step % loop, state.next, stepDur);
        } catch (err) {
          log.warn('music step failed', { track: id, error: err });
        }
        state.step++;
        state.next += stepDur;
      }
    }, TICK_MS);
    this.playing = state;
  }

  /** For tests/diagnostics: what is playing. */
  status(): { track: string | null; slot: MusicSlot | null; state: string } {
    return { track: this.playing?.track.id ?? null, slot: this.wantedSlot, state: this.ctx?.state ?? 'not-started' };
  }
}

/** App-wide instance. */
export const audio = new AudioEngine();

export { MUSIC, MUSIC_SLOTS, SFX };
