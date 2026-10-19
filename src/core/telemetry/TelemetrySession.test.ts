import { describe, expect, it } from 'vitest';
import { TelemetrySession } from './TelemetrySession';
import type { SessionRecord, TelemetryEvent, TelemetrySink } from './types';

function memorySink() {
  const sessions = new Map<string, SessionRecord>();
  const events: TelemetryEvent[] = [];
  const sink: TelemetrySink = {
    async putSession(s) {
      sessions.set(s.id, structuredClone(s));
    },
    async addEvents(e) {
      events.push(...e);
    },
  };
  return { sink, sessions, events };
}

describe('TelemetrySession', () => {
  it('timestamps relative to session start and flushes on end', async () => {
    let now = 1000;
    const mem = memorySink();
    const s = new TelemetrySession({
      profileId: 'p1',
      moduleId: 'm1',
      sink: mem.sink,
      now: () => now,
      flushIntervalMs: 0,
    });
    now = 1250;
    s.log('math.answer.correct', { key: '2+2' }, 'keyboard');
    await s.end({ score: 10 });

    expect(mem.events.map((e) => [e.kind, e.t])).toEqual([
      ['session.start', 0],
      ['math.answer.correct', 250],
      ['session.end', 250],
    ]);
    expect(mem.sessions.get(s.id)?.summary).toEqual({ score: 10 });
    expect(mem.sessions.get(s.id)?.endedAt).toBeDefined();
  });

  it('ignores events after the session has ended', async () => {
    const mem = memorySink();
    const s = new TelemetrySession({ profileId: 'p', moduleId: 'm', sink: mem.sink, flushIntervalMs: 0 });
    await s.end({});
    s.log('late', {});
    await s.flush();
    expect(mem.events.some((e) => e.kind === 'late')).toBe(false);
  });

  it('keeps events when a flush fails and retries later', async () => {
    const mem = memorySink();
    let fail = true;
    const sink: TelemetrySink = {
      putSession: mem.sink.putSession,
      async addEvents(e) {
        if (fail) throw new Error('quota exceeded');
        await mem.sink.addEvents(e);
      },
    };
    const s = new TelemetrySession({ profileId: 'p', moduleId: 'm', sink, flushIntervalMs: 0 });
    s.log('a', {});
    await s.flush();
    expect(mem.events).toHaveLength(0);
    fail = false;
    await s.end({});
    expect(mem.events.map((e) => e.kind)).toEqual(['session.start', 'a', 'session.end']);
  });
});
