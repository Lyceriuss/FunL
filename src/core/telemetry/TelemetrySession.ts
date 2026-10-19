import type { InputManager } from '../input/InputManager';
import type { InputDevice } from '../input/types';
import { getLogger } from '../log/logger';
import type { SessionRecord, TelemetryEvent, TelemetrySink } from './types';

export const APP_VERSION = __APP_VERSION__;

const log = getLogger('telemetry');
/** Stop retrying after this many failed flushes in a row; keep events in memory instead. */
const MAX_FLUSH_FAILURES = 5;

export interface SessionOptions {
  profileId: string;
  moduleId: string;
  config?: Record<string, unknown>;
  sink: TelemetrySink;
  /** Injected for tests. Defaults to performance.now / Date.now. */
  now?: () => number;
  wall?: () => number;
  flushIntervalMs?: number;
}

/**
 * Records everything that happens during one play session. Events are
 * buffered in memory and flushed to the sink periodically and on end.
 */
export class TelemetrySession {
  readonly id: string;
  readonly record: SessionRecord;
  private buffer: TelemetryEvent[] = [];
  private all: TelemetryEvent[] = [];
  private readonly t0: number;
  private readonly now: () => number;
  private readonly wall: () => number;
  private readonly sink: TelemetrySink;
  private timer: ReturnType<typeof setInterval> | null = null;
  private unsubs: (() => void)[] = [];
  private ended = false;
  private flushFailures = 0;

  constructor(opts: SessionOptions) {
    this.now = opts.now ?? (() => performance.now());
    this.wall = opts.wall ?? (() => Date.now());
    this.sink = opts.sink;
    this.t0 = this.now();
    this.id = makeId();
    this.record = {
      id: this.id,
      profileId: opts.profileId,
      moduleId: opts.moduleId,
      config: opts.config ?? {},
      startedAt: this.wall(),
      env: captureEnv(),
    };
    this.sink.putSession(this.record).catch((err: unknown) => log.error('could not save session record', err));
    this.log('session.start', {});
    log.info('session started', { sessionId: this.id, moduleId: opts.moduleId, profileId: opts.profileId });
    if (opts.flushIntervalMs !== 0) {
      this.timer = setInterval(() => void this.flush(), opts.flushIntervalMs ?? 2000);
    }
  }

  /** Milliseconds since session start for a given performance.now() timestamp. */
  rel(t: number = this.now()): number {
    return Math.round((t - this.t0) * 10) / 10;
  }

  log(kind: string, data: Record<string, unknown>, device?: InputDevice, at?: number): TelemetryEvent {
    const e: TelemetryEvent = {
      sessionId: this.id,
      t: this.rel(at),
      wall: this.wall(),
      kind,
      device,
      data,
    };
    if (this.ended) return e;
    this.buffer.push(e);
    this.all.push(e);
    return e;
  }

  /** Record every raw input (incl. unmapped keys and taps that hit nothing). */
  captureInput(manager: InputManager): () => void {
    const unsub = manager.onRaw((raw) => {
      const { device, t, ...rest } = raw;
      this.log(raw.mapped ? 'input.raw' : 'input.miss', rest, device, t);
    });
    this.unsubs.push(unsub);
    this.record.env.gamepad = manager.gamepadId;
    return unsub;
  }

  /** Events recorded so far in this session (in-memory copy). */
  events(): readonly TelemetryEvent[] {
    return this.all;
  }

  /**
   * Write buffered events to the sink. On failure the batch is put back so
   * nothing is lost; after repeated failures we stop retrying (events remain
   * available via `events()` for the rest of the session).
   */
  async flush(): Promise<void> {
    if (this.buffer.length === 0 || this.flushFailures >= MAX_FLUSH_FAILURES) return;
    const batch = this.buffer;
    this.buffer = [];
    try {
      await this.sink.addEvents(batch);
      if (this.flushFailures > 0) log.info('telemetry flush recovered', { sessionId: this.id });
      this.flushFailures = 0;
    } catch (err) {
      this.buffer = batch.concat(this.buffer);
      this.flushFailures++;
      log.error('telemetry flush failed', {
        sessionId: this.id,
        pending: this.buffer.length,
        attempt: this.flushFailures,
        error: err,
      });
    }
  }

  async end(summary: Record<string, unknown>, reason = 'completed'): Promise<SessionRecord> {
    if (this.ended) return this.record;
    this.log('session.end', { reason });
    this.ended = true;
    if (this.timer) clearInterval(this.timer);
    this.unsubs.forEach((u) => u());
    this.record.endedAt = this.wall();
    this.record.summary = summary;
    await this.flush();
    try {
      await this.sink.putSession(this.record);
    } catch (err) {
      log.error('could not save session summary', { sessionId: this.id, error: err });
    }
    log.info('session ended', {
      sessionId: this.id,
      reason,
      events: this.all.length,
      unsaved: this.buffer.length,
      durationMs: this.record.endedAt - this.record.startedAt,
    });
    return this.record;
  }
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function captureEnv(): SessionRecord['env'] {
  const hasWindow = typeof window !== 'undefined';
  return {
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    screen: hasWindow
      ? { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio }
      : { w: 0, h: 0, dpr: 1 },
    touch: typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0,
    gamepad: null,
    appVersion: APP_VERSION,
  };
}
