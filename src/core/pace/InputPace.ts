import type { InputDevice } from '../input/types';

/**
 * Input pace: how long *this player* needs to physically enter an answer on
 * a given device, separate from thinking time.
 *
 * Measured per answer as "input time": from the first input movement (stick
 * moved, button, key or tap) to the answer arriving. Learned per device and
 * per answer length (number of digits, "units") as a running median of
 * recent answers, so one distracted moment doesn't skew it.
 *
 * Games use `allowance()` to give each equation enough extra time for the
 * player's real input speed, compared with the keyboard pace the difficulty
 * curve was tuned for.
 */

/** Total input time for n units on a device, before we know the player: base + perUnit × n. */
export const PRIORS: Record<InputDevice, { base: number; perUnit: number }> = {
  keyboard: { base: 500, perUnit: 300 },
  touch: { base: 700, perUnit: 500 },
  mouse: { base: 700, perUnit: 450 },
  pen: { base: 750, perUnit: 500 },
  // Radial dial: point the stick, press A, per digit; then Y.
  gamepad: { base: 1200, perUnit: 1000 },
};

/** The pace the difficulty curve assumes (a typical keyboard player). */
export const BASELINE: InputDevice = 'keyboard';
/** Margin on top of the expected extra time. */
export const ALLOWANCE_MARGIN = 1.25;
export const MAX_ALLOWANCE_MS = 8000;
/** Recent samples kept per device and length. */
const KEEP = 15;
/** Samples needed before the median replaces the prior. */
const MIN_SAMPLES = 3;
const MIN_MS = 150;
const MAX_MS = 20000;
/** Reject samples this many times slower than the current estimate (distracted). */
const OUTLIER_FACTOR = 3;

export interface PaceData {
  version: 1;
  samples: Partial<Record<InputDevice, Record<string, number[]>>>;
}

export interface PaceRow {
  device: InputDevice;
  units: number;
  expectedMs: number;
  samples: number;
  source: 'measured' | 'estimated' | 'default';
}

export function emptyPace(): PaceData {
  return { version: 1, samples: {} };
}

export function priorMs(device: InputDevice, units: number): number {
  const p = PRIORS[device] ?? PRIORS.keyboard;
  return p.base + p.perUnit * Math.max(1, units);
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

const bucket = (units: number) => String(Math.min(Math.max(1, units), 4));

export class InputPace {
  data: PaceData;

  constructor(data?: PaceData | null) {
    this.data = data?.version === 1 ? structuredClone(data) : emptyPace();
  }

  /**
   * Add one measured input time. Returns false if it was rejected as
   * impossible or an outlier (e.g. the child looked away).
   */
  observe(device: InputDevice, units: number, ms: number): boolean {
    if (!Number.isFinite(ms) || ms < MIN_MS || ms > MAX_MS || units < 1) return false;
    const list = this.samplesOf(device, units);
    if (list.length >= MIN_SAMPLES && ms > this.expected(device, units) * OUTLIER_FACTOR) return false;
    const dev = (this.data.samples[device] ??= {});
    const b = bucket(units);
    dev[b] = [...(dev[b] ?? []), Math.round(ms)].slice(-KEEP);
    return true;
  }

  samplesOf(device: InputDevice, units: number): number[] {
    return this.data.samples[device]?.[bucket(units)] ?? [];
  }

  /** Expected input time (ms) for an answer of `units` digits on `device`. */
  expected(device: InputDevice, units: number): number {
    return this.row(device, units).expectedMs;
  }

  row(device: InputDevice, units: number): PaceRow {
    const own = this.samplesOf(device, units);
    if (own.length >= MIN_SAMPLES) {
      return { device, units, expectedMs: Math.round(median(own)), samples: own.length, source: 'measured' };
    }
    // Borrow from the nearest length we have measured on this device, scaled by the prior shape.
    const dev = this.data.samples[device] ?? {};
    const measured = Object.entries(dev)
      .filter(([, v]) => v.length >= MIN_SAMPLES)
      .map(([k, v]) => ({ u: Number(k), m: median(v) }))
      .sort((a, b) => Math.abs(a.u - units) - Math.abs(b.u - units));
    if (measured.length) {
      const { u, m } = measured[0];
      const est = (m * priorMs(device, units)) / priorMs(device, u);
      // Blend in any own samples we have.
      const blended = own.length ? (est * 2 + own.reduce((a, b) => a + b, 0)) / (2 + own.length) : est;
      return { device, units, expectedMs: Math.round(blended), samples: own.length, source: 'estimated' };
    }
    const prior = priorMs(device, units);
    if (own.length) {
      return { device, units, expectedMs: Math.round((prior + own.reduce((a, b) => a + b, 0)) / (1 + own.length)), samples: own.length, source: 'estimated' };
    }
    return { device, units, expectedMs: prior, samples: 0, source: 'default' };
  }

  /**
   * Extra time (ms) to give an equation so this player can enter an answer
   * of `units` digits on `device`: how much slower than the baseline pace
   * they are, with a margin. Never negative.
   */
  allowance(device: InputDevice, units: number): number {
    const extra = this.expected(device, units) - priorMs(BASELINE, units);
    return Math.round(Math.min(MAX_ALLOWANCE_MS, Math.max(0, extra * ALLOWANCE_MARGIN)));
  }

  /** Table for display: every device used (plus the given one), lengths 1–3. */
  summary(include: InputDevice[] = []): PaceRow[] {
    const devices = new Set<InputDevice>([...(Object.keys(this.data.samples) as InputDevice[]), ...include]);
    return [...devices].flatMap((d) => [1, 2, 3].map((u) => this.row(d, u)));
  }

  toJSON(): PaceData {
    return this.data;
  }
}
