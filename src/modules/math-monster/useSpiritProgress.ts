import { useEffect, useState } from 'react';
import { getLogger } from '../../core/log/logger';
import { deleteProgress } from '../../core/telemetry/storage';
import { emptyProgress, loadSpirits, saveSpirits, type SpiritProgress } from './spirits';

const log = getLogger('math-monster.hub');

/** Load (when the browser is idle), change and reset the player's spirit progress. */
export function useSpiritProgress(profileId: string) {
  const [progress, setProgress] = useState<SpiritProgress | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadSpirits(profileId)
      .then((p) => {
        // Render when the browser is idle, so the module screen's first frame
        // (and the controller's first press on it) isn't held up by the art.
        const show = () => !cancelled && setProgress(p);
        if ('requestIdleCallback' in window) requestIdleCallback(show, { timeout: 400 });
        else setTimeout(show, 50);
      })
      .catch((err: unknown) => log.error('could not load spirit progress', err));
    return () => {
      cancelled = true;
    };
  }, [profileId]);

  const change = (next: SpiritProgress) => {
    setProgress(next);
    saveSpirits(profileId, next).catch((err: unknown) => log.error('could not save spirit progress', err));
    log.info('companion changed in journal', { creatureId: next.companion });
  };

  const reset = async () => {
    try {
      await deleteProgress('math-monster', profileId);
      setProgress(emptyProgress());
      log.info('math monster progress reset', { profileId });
    } catch (err) {
      log.error('could not reset progress', err);
    }
  };

  return { progress, change, reset };
}
