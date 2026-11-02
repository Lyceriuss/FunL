import { getProgress, saveProgress } from '../../core/telemetry/storage';
import type { RivalLevel } from './ai';

export const MODULE_ID = 'maze-duel';

export interface DuelRecord {
  version: 1;
  /** Results against Glitch per difficulty. */
  record: Record<RivalLevel['id'], { won: number; lost: number; draw: number }>;
  /** Fewest correct answers it took you to win (any difficulty). */
  bestWinAnswers: number | null;
}

export function emptyRecord(): DuelRecord {
  const z = () => ({ won: 0, lost: 0, draw: 0 });
  return { version: 1, record: { easy: z(), medium: z(), hard: z() }, bestWinAnswers: null };
}

export async function loadRecord(profileId: string): Promise<DuelRecord> {
  const r = await getProgress<DuelRecord>(MODULE_ID, profileId);
  return r?.version === 1 ? r : emptyRecord();
}

export async function addResult(profileId: string, level: RivalLevel['id'], result: 'won' | 'lost' | 'draw', answers: number): Promise<DuelRecord> {
  const r = await loadRecord(profileId);
  r.record[level][result]++;
  if (result === 'won' && (r.bestWinAnswers === null || answers < r.bestWinAnswers)) r.bestWinAnswers = answers;
  await saveProgress(MODULE_ID, profileId, r);
  return r;
}
