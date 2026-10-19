import { db } from '../telemetry/storage';
import type { LogEntry, LogLevel, LogSink } from './logger';

const MAX_PERSISTED = 5000;
const FLUSH_MS = 2000;

/**
 * Persists log entries to IndexedDB so problems on a child's tablet can be
 * looked at later (Data screen → "Diagnostics"). Writes are batched.
 */
export function createIdbLogSink(level: LogLevel = 'info'): LogSink & { flush(): Promise<void> } {
  let pending: LogEntry[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = async () => {
    timer = null;
    if (pending.length === 0) return;
    const batch = pending;
    pending = [];
    try {
      const tx = (await db()).transaction('logs', 'readwrite');
      await Promise.all([...batch.map((e) => tx.store.add(e)), tx.done]);
    } catch {
      // Can't log a logging failure through the logger (it would loop); drop it.
    }
  };

  return {
    level,
    write(entry) {
      pending.push(entry);
      timer ??= setTimeout(() => void flush(), FLUSH_MS);
    },
    flush,
  };
}

/** Keep the persisted log bounded. Call once at startup. */
export async function pruneLogs(max = MAX_PERSISTED): Promise<number> {
  const d = await db();
  const count = await d.count('logs');
  if (count <= max) return 0;
  const tx = d.transaction('logs', 'readwrite');
  let cursor = await tx.store.openCursor();
  let toDelete = count - max;
  while (cursor && toDelete-- > 0) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
  return count - max;
}

export async function readPersistedLogs(): Promise<LogEntry[]> {
  return (await db()).getAll('logs');
}

export async function clearPersistedLogs(): Promise<void> {
  await (await db()).clear('logs');
}
