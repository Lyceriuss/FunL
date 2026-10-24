import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { getLogger, type LogEntry } from '../log/logger';
import type { ContentPack, Profile, ProgressRecord, SessionRecord, TelemetryEvent, TelemetrySink } from './types';

interface FunlDB extends DBSchema {
  profiles: { key: string; value: Profile };
  sessions: {
    key: string;
    value: SessionRecord;
    indexes: { byProfile: string; byModule: string };
  };
  events: {
    key: number;
    value: TelemetryEvent;
    indexes: { bySession: string };
  };
  packs: {
    key: string;
    value: ContentPack;
    indexes: { byModule: string };
  };
  logs: {
    key: number;
    value: LogEntry;
  };
  progress: {
    key: string;
    value: ProgressRecord;
    indexes: { byProfile: string };
  };
}

const DB_NAME = 'funl';
/**
 * Bump when the schema changes and add a `if (oldVersion < N)` step below.
 * Never edit an existing step: browsers that already ran it won't run it again.
 */
const DB_VERSION = 3;
const log = getLogger('storage');

let dbPromise: Promise<IDBPDatabase<FunlDB>> | null = null;

export function db(): Promise<IDBPDatabase<FunlDB>> {
  dbPromise ??= openDB<FunlDB>(DB_NAME, DB_VERSION, {
    upgrade(d, oldVersion, newVersion) {
      log.info('upgrading database', { from: oldVersion, to: newVersion });
      if (oldVersion < 1) {
        d.createObjectStore('profiles', { keyPath: 'id' });
        const sessions = d.createObjectStore('sessions', { keyPath: 'id' });
        sessions.createIndex('byProfile', 'profileId');
        sessions.createIndex('byModule', 'moduleId');
        const events = d.createObjectStore('events', { keyPath: 'id', autoIncrement: true });
        events.createIndex('bySession', 'sessionId');
        const packs = d.createObjectStore('packs', { keyPath: 'id' });
        packs.createIndex('byModule', 'moduleId');
      }
      if (oldVersion < 2) {
        d.createObjectStore('logs', { keyPath: 'id', autoIncrement: true });
      }
      if (oldVersion < 3) {
        const progress = d.createObjectStore('progress', { keyPath: 'key' });
        progress.createIndex('byProfile', 'profileId');
      }
    },
    blocked() {
      log.warn('database upgrade blocked by another open tab');
    },
    blocking() {
      log.warn('this tab is blocking a database upgrade; reload recommended');
    },
    terminated() {
      log.error('database connection terminated unexpectedly');
      dbPromise = null;
    },
  }).catch((err: unknown) => {
    log.error('failed to open database', err);
    dbPromise = null;
    throw err;
  });
  return dbPromise;
}

export const idbSink: TelemetrySink = {
  async putSession(s) {
    await (await db()).put('sessions', s);
  },
  async addEvents(events) {
    if (events.length === 0) return;
    const tx = (await db()).transaction('events', 'readwrite');
    await Promise.all([...events.map((e) => tx.store.add(e)), tx.done]);
  },
};

export async function listProfiles(): Promise<Profile[]> {
  const all = await (await db()).getAll('profiles');
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function saveProfile(p: Profile): Promise<void> {
  await (await db()).put('profiles', p);
}

export async function deleteProfile(id: string): Promise<void> {
  const d = await db();
  for (const s of await d.getAllFromIndex('sessions', 'byProfile', id)) {
    await deleteSession(s.id);
  }
  for (const key of await d.getAllKeysFromIndex('progress', 'byProfile', id)) {
    await d.delete('progress', key);
  }
  await d.delete('profiles', id);
}

export async function listSessions(profileId?: string): Promise<SessionRecord[]> {
  const d = await db();
  const all = profileId
    ? await d.getAllFromIndex('sessions', 'byProfile', profileId)
    : await d.getAll('sessions');
  return all.sort((a, b) => b.startedAt - a.startedAt);
}

export async function getSessionEvents(sessionId: string): Promise<TelemetryEvent[]> {
  const events = await (await db()).getAllFromIndex('events', 'bySession', sessionId);
  return events.sort((a, b) => a.t - b.t);
}

export async function deleteSession(sessionId: string): Promise<void> {
  const d = await db();
  const tx = d.transaction(['sessions', 'events'], 'readwrite');
  const keys = await tx.objectStore('events').index('bySession').getAllKeys(sessionId);
  await Promise.all([
    ...keys.map((k) => tx.objectStore('events').delete(k)),
    tx.objectStore('sessions').delete(sessionId),
    tx.done,
  ]);
}

export async function listPacks(moduleId: string): Promise<ContentPack[]> {
  const all = await (await db()).getAllFromIndex('packs', 'byModule', moduleId);
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function savePack(p: ContentPack): Promise<void> {
  await (await db()).put('packs', p);
}

export async function deletePack(id: string): Promise<void> {
  await (await db()).delete('packs', id);
}

export async function getProgress<T>(moduleId: string, profileId: string): Promise<T | undefined> {
  const rec = await (await db()).get('progress', `${moduleId}:${profileId}`);
  return rec?.data as T | undefined;
}

export async function saveProgress(moduleId: string, profileId: string, data: unknown): Promise<void> {
  await (await db()).put('progress', {
    key: `${moduleId}:${profileId}`,
    moduleId,
    profileId,
    data,
    updatedAt: Date.now(),
  });
}

/** Forget a player's long-lived progress for one module (e.g. start the adventure over). */
export async function deleteProgress(moduleId: string, profileId: string): Promise<void> {
  await (await db()).delete('progress', `${moduleId}:${profileId}`);
  log.info('module progress reset', { moduleId, profileId });
}

/** Full dump of everything, for export / hand-off to analysis or an MCP server. */
export async function exportAll(): Promise<{
  exportedAt: string;
  profiles: Profile[];
  progress: ProgressRecord[];
  sessions: (SessionRecord & { events: TelemetryEvent[] })[];
}> {
  const profiles = await listProfiles();
  const sessions = await listSessions();
  return {
    exportedAt: new Date().toISOString(),
    profiles,
    progress: await (await db()).getAll('progress'),
    sessions: await Promise.all(
      sessions.map(async (s) => ({ ...s, events: await getSessionEvents(s.id) })),
    ),
  };
}
