/**
 * Structured application logging (diagnostics), separate from telemetry.
 *
 *   telemetry = what the *player* did (answers, taps, timings) → research data
 *   logs      = what the *app* did (errors, lifecycle, storage) → debugging
 *
 * Usage:
 *   const log = getLogger('telemetry');
 *   log.info('session started', { sessionId });
 *   log.error('flush failed', err);
 *
 * Entries go to an in-memory ring buffer, the console (in dev or when the
 * level allows) and any registered sinks (e.g. IndexedDB, see idbLogSink).
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export const LEVELS: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export interface LogEntry {
  /** Assigned by IndexedDB when persisted. */
  id?: number;
  /** Wall-clock epoch ms. */
  t: number;
  level: LogLevel;
  /** Namespace, e.g. "input", "telemetry", "math-monster". */
  ns: string;
  msg: string;
  data?: Record<string, unknown>;
  /** Global context at the time of logging (route, sessionId, ...). */
  ctx?: Record<string, unknown>;
}

export interface LogSink {
  /** Minimum level this sink wants. */
  level: LogLevel;
  write(entry: LogEntry): void;
}

export interface Logger {
  debug(msg: string, data?: unknown): void;
  info(msg: string, data?: unknown): void;
  warn(msg: string, data?: unknown): void;
  error(msg: string, data?: unknown): void;
  child(ns: string): Logger;
}

const RING_SIZE = 500;

export class LogHub {
  /** Minimum level that is recorded at all. */
  level: LogLevel = 'info';
  /** Whether entries are echoed to the browser console (off under Vitest). */
  console = import.meta.env?.MODE !== 'test';
  private ring: LogEntry[] = [];
  private sinks = new Set<LogSink>();
  private context: Record<string, unknown> = {};

  logger(ns: string): Logger {
    const write = (level: LogLevel) => (msg: string, data?: unknown) => this.write(level, ns, msg, data);
    return {
      debug: write('debug'),
      info: write('info'),
      warn: write('warn'),
      error: write('error'),
      child: (sub) => this.logger(`${ns}.${sub}`),
    };
  }

  /** Merge values into the context attached to every following entry; `undefined` removes a key. */
  setContext(values: Record<string, unknown>): void {
    for (const [k, v] of Object.entries(values)) {
      if (v === undefined) delete this.context[k];
      else this.context[k] = v;
    }
  }

  addSink(sink: LogSink): () => void {
    this.sinks.add(sink);
    return () => this.sinks.delete(sink);
  }

  /** Most recent entries (oldest first), e.g. for a diagnostics export. */
  recent(): LogEntry[] {
    return [...this.ring];
  }

  clear(): void {
    this.ring = [];
  }

  write(level: LogLevel, ns: string, msg: string, data?: unknown): void {
    if (LEVELS[level] < LEVELS[this.level]) return;
    const entry: LogEntry = { t: Date.now(), level, ns, msg };
    const normalized = normalize(data);
    if (normalized) entry.data = normalized;
    if (Object.keys(this.context).length) entry.ctx = { ...this.context };

    this.ring.push(entry);
    if (this.ring.length > RING_SIZE) this.ring.shift();

    if (this.console) toConsole(entry);
    for (const sink of this.sinks) {
      if (LEVELS[level] < LEVELS[sink.level]) continue;
      try {
        sink.write(entry);
      } catch {
        // A broken sink must never break the app (or recurse into logging).
      }
    }
  }
}

/** Turn whatever was passed (Error, object, primitive) into plain JSON-safe data. */
export function normalize(data: unknown): Record<string, unknown> | undefined {
  if (data === undefined) return undefined;
  if (data instanceof Error) return { error: serializeError(data) };
  if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) out[k] = v instanceof Error ? serializeError(v) : v;
    return out;
  }
  return { value: data };
}

export function serializeError(e: Error): { name: string; message: string; stack?: string; cause?: unknown } {
  return {
    name: e.name,
    message: e.message,
    stack: e.stack?.split('\n').slice(0, 12).join('\n'),
    cause: e.cause instanceof Error ? serializeError(e.cause) : e.cause,
  };
}

function toConsole(e: LogEntry): void {
  const fn =
    e.level === 'error' ? console.error
    : e.level === 'warn' ? console.warn
    : e.level === 'info' ? console.info
    : console.debug;
  const prefix = `[${e.ns}] ${e.msg}`;
  if (e.data) fn(prefix, e.data);
  else fn(prefix);
}

/** App-wide hub. */
export const logs = new LogHub();

export function getLogger(ns: string): Logger {
  return logs.logger(ns);
}
