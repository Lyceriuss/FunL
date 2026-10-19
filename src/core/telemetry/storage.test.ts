import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { describe, expect, it } from 'vitest';
import { db, getProgress, listSessions, saveProgress } from './storage';

describe('storage migrations', () => {
  it('upgrades a v1 database to the latest version without losing data', async () => {
    // Simulate a browser that ran the original v1 schema.
    const v1 = await openDB('funl', 1, {
      upgrade(d) {
        d.createObjectStore('profiles', { keyPath: 'id' });
        const sessions = d.createObjectStore('sessions', { keyPath: 'id' });
        sessions.createIndex('byProfile', 'profileId');
        sessions.createIndex('byModule', 'moduleId');
        const events = d.createObjectStore('events', { keyPath: 'id', autoIncrement: true });
        events.createIndex('bySession', 'sessionId');
        const packs = d.createObjectStore('packs', { keyPath: 'id' });
        packs.createIndex('byModule', 'moduleId');
      },
    });
    await v1.put('sessions', { id: 's1', profileId: 'p', moduleId: 'm', startedAt: 1 });
    v1.close();

    const d = await db();
    expect(d.version).toBe(3);
    expect([...d.objectStoreNames]).toEqual(expect.arrayContaining(['logs', 'progress']));
    expect((await listSessions()).map((s) => s.id)).toEqual(['s1']);
  });

  it('stores module progress per player', async () => {
    await saveProgress('mod', 'p1', { stars: 3 });
    expect(await getProgress('mod', 'p1')).toEqual({ stars: 3 });
    expect(await getProgress('mod', 'p2')).toBeUndefined();
  });
});
