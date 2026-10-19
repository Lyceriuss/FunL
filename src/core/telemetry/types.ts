import type { InputDevice } from '../input/types';

/**
 * One recorded fact. Everything a player does ends up as one of these so it
 * can be analysed later (response times, misclicks, corrections, ...).
 *
 * `kind` is namespaced: "input.*" for raw/mapped input, "session.*" for
 * lifecycle, and "<moduleId>.*" for module-specific game events.
 */
export interface TelemetryEvent {
  id?: number;
  sessionId: string;
  /** Milliseconds since session start (monotonic, high resolution). */
  t: number;
  /** Wall-clock epoch ms, for cross-session ordering. */
  wall: number;
  kind: string;
  device?: InputDevice;
  data: Record<string, unknown>;
}

export interface SessionRecord {
  id: string;
  profileId: string;
  moduleId: string;
  /** Module content/level config used, so sessions are reproducible. */
  config: Record<string, unknown>;
  startedAt: number;
  endedAt?: number;
  /** Environment details useful when interpreting timing data. */
  env: {
    userAgent: string;
    screen: { w: number; h: number; dpr: number };
    touch: boolean;
    gamepad: string | null;
    appVersion: string;
  };
  /** Module-computed summary, written when the session ends. */
  summary?: Record<string, unknown>;
}

export interface Profile {
  id: string;
  name: string;
  avatar: string;
  createdAt: number;
}

/** Where telemetry goes. IndexedDB in the browser, memory in tests, a server later. */
export interface TelemetrySink {
  putSession(s: SessionRecord): Promise<void>;
  addEvents(events: TelemetryEvent[]): Promise<void>;
}

/**
 * Module content imported from outside (a teacher, an MCP server reading a
 * worksheet, ...). `data` is the module's own format, validated by the module.
 */
export interface ContentPack {
  id: string;
  moduleId: string;
  title: string;
  data: unknown;
  /** Where it came from, e.g. "mcp", "paste", "file". */
  origin: string;
  createdAt: number;
}

/**
 * Long-lived, module-owned state for one player (e.g. which creatures they
 * have befriended). `data` is the module's own format; modules version it.
 */
export interface ProgressRecord {
  /** `${moduleId}:${profileId}` */
  key: string;
  moduleId: string;
  profileId: string;
  data: unknown;
  updatedAt: number;
}
