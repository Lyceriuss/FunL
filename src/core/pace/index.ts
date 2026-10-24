import { getLogger } from '../log/logger';
import { getProgress, saveProgress } from '../telemetry/storage';
import { InputPace, type PaceData } from './InputPace';

export * from './InputPace';

const log = getLogger('pace');
/** Stored in the per-player progress store under this pseudo-module id. */
const STORE_ID = 'input-pace';

export async function loadPace(profileId: string): Promise<InputPace> {
  try {
    return new InputPace(await getProgress<PaceData>(STORE_ID, profileId));
  } catch (err) {
    log.warn('could not load input pace', err);
    return new InputPace();
  }
}

export async function savePace(profileId: string, pace: InputPace): Promise<void> {
  try {
    await saveProgress(STORE_ID, profileId, pace.toJSON());
  } catch (err) {
    log.warn('could not save input pace', err);
  }
}
