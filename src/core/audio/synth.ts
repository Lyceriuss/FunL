/**
 * Tiny Web Audio synth helpers. Everything is generated, so there are no
 * audio files to load or license. Times are absolute AudioContext seconds.
 */

export type Ctx = BaseAudioContext;

/** Frequency of a MIDI note (60 = middle C). */
export function hz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

export interface ToneOpts {
  type?: OscillatorType;
  /** MIDI note or Hz (if `hz` is true). */
  note: number;
  hz?: boolean;
  /** Glide to this note (or Hz) over the duration. */
  to?: number;
  at: number;
  dur: number;
  gain?: number;
  attack?: number;
  release?: number;
  /** Vibrato in Hz and depth in Hz. */
  vibrato?: { rate: number; depth: number };
  /** Low-pass the tone (softer). */
  lowpass?: number;
}

export function tone(ctx: Ctx, out: AudioNode, o: ToneOpts): void {
  const f = o.hz ? o.note : hz(o.note);
  const osc = ctx.createOscillator();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(f, o.at);
  if (o.to !== undefined) osc.frequency.exponentialRampToValueAtTime(o.hz ? o.to : hz(o.to), o.at + o.dur);

  const g = ctx.createGain();
  const peak = o.gain ?? 0.25;
  const attack = Math.min(o.attack ?? 0.005, o.dur / 2);
  const release = Math.min(o.release ?? o.dur * 0.7, o.dur);
  g.gain.setValueAtTime(0.0001, o.at);
  g.gain.exponentialRampToValueAtTime(peak, o.at + attack);
  g.gain.setValueAtTime(peak, o.at + Math.max(attack, o.dur - release));
  g.gain.exponentialRampToValueAtTime(0.0001, o.at + o.dur);

  let node: AudioNode = osc;
  if (o.lowpass) {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = o.lowpass;
    osc.connect(lp);
    node = lp;
  }
  node.connect(g).connect(out);

  if (o.vibrato) {
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = o.vibrato.rate;
    depth.gain.value = o.vibrato.depth;
    lfo.connect(depth).connect(osc.frequency);
    lfo.start(o.at);
    lfo.stop(o.at + o.dur + 0.05);
  }
  osc.start(o.at);
  osc.stop(o.at + o.dur + 0.05);
}

let noiseBuffer: AudioBuffer | null = null;
function whiteNoise(ctx: Ctx): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) return noiseBuffer;
  const len = Math.floor(ctx.sampleRate * 0.5);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  noiseBuffer = buf;
  return buf;
}

export interface NoiseOpts {
  at: number;
  dur: number;
  gain?: number;
  filter?: BiquadFilterType;
  freq?: number;
  /** Sweep the filter to this frequency. */
  to?: number;
  q?: number;
}

/** Filtered noise: hats, snares, whooshes. */
export function noise(ctx: Ctx, out: AudioNode, o: NoiseOpts): void {
  const src = ctx.createBufferSource();
  src.buffer = whiteNoise(ctx);
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = o.filter ?? 'highpass';
  f.frequency.setValueAtTime(o.freq ?? 6000, o.at);
  if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, o.at + o.dur);
  f.Q.value = o.q ?? 0.8;
  const g = ctx.createGain();
  g.gain.setValueAtTime(o.gain ?? 0.1, o.at);
  g.gain.exponentialRampToValueAtTime(0.0001, o.at + o.dur);
  src.connect(f).connect(g).connect(out);
  src.start(o.at);
  src.stop(o.at + o.dur + 0.05);
}

/** Notes one after another. */
export function seq(ctx: Ctx, out: AudioNode, at: number, notes: number[], step: number, o: Omit<ToneOpts, 'note' | 'at'>): void {
  notes.forEach((n, i) => tone(ctx, out, { ...o, note: n, at: at + i * step }));
}

/** Several notes at once. */
export function chord(ctx: Ctx, out: AudioNode, at: number, notes: number[], o: Omit<ToneOpts, 'note' | 'at'>): void {
  notes.forEach((n) => tone(ctx, out, { ...o, note: n, at }));
}
