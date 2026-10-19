import { describe, expect, it } from 'vitest';
import { LogHub, type LogEntry } from './logger';

function hub() {
  const h = new LogHub();
  h.console = false;
  const got: LogEntry[] = [];
  h.addSink({ level: 'warn', write: (e) => got.push(e) });
  return { h, got };
}

describe('LogHub', () => {
  it('filters by hub level and by sink level', () => {
    const { h, got } = hub();
    h.level = 'info';
    const log = h.logger('test');
    log.debug('hidden');
    log.info('kept in buffer only');
    log.error('to sink too');
    expect(h.recent().map((e) => e.msg)).toEqual(['kept in buffer only', 'to sink too']);
    expect(got.map((e) => e.msg)).toEqual(['to sink too']);
  });

  it('serializes errors and attaches context', () => {
    const { h } = hub();
    h.setContext({ route: 'game', sessionId: 's1' });
    h.logger('x').child('y').error('boom', new Error('bad', { cause: new Error('root') }));
    const [e] = h.recent();
    expect(e.ns).toBe('x.y');
    expect(e.ctx).toEqual({ route: 'game', sessionId: 's1' });
    const err = e.data?.error as { message: string; cause: { message: string } };
    expect(err.message).toBe('bad');
    expect(err.cause.message).toBe('root');

    h.setContext({ sessionId: undefined });
    h.logger('x').info('later');
    expect(h.recent()[1].ctx).toEqual({ route: 'game' });
  });

  it('keeps a bounded ring buffer', () => {
    const { h } = hub();
    for (let i = 0; i < 600; i++) h.logger('x').info(`m${i}`);
    expect(h.recent()).toHaveLength(500);
    expect(h.recent()[0].msg).toBe('m100');
  });

  it('survives a throwing sink', () => {
    const { h } = hub();
    h.addSink({ level: 'debug', write: () => { throw new Error('sink down'); } });
    expect(() => h.logger('x').error('still fine')).not.toThrow();
  });
});
