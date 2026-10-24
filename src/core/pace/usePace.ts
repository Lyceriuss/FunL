import { useEffect, useRef, useState } from 'react';
import { input } from '../input/InputManager';
import type { InputDevice } from '../input/types';
import { getLogger } from '../log/logger';
import { InputPace } from './InputPace';
import { loadPace, savePace } from './index';

const log = getLogger('pace');
const SAVE_EVERY = 4;

export interface PaceHandle {
  ready: boolean;
  /** Extra ms for an answer of `units` digits on the player's current device (0 when disabled). */
  allowance: (units: number) => number;
  /** Feed one measured input time. */
  observe: (device: InputDevice, units: number, ms: number) => void;
  /** The live model (for summaries). */
  model: () => InputPace | null;
}

/**
 * Loads the player's input pace, gives games a stable allowance function,
 * learns from every answer and saves when the screen closes.
 */
export function usePace(profileId: string, enabled: boolean): PaceHandle {
  const ref = useRef<InputPace | null>(null);
  const dirty = useRef(false);
  const unsaved = useRef(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadPace(profileId).then((p) => {
      if (cancelled) return;
      ref.current = p;
      setReady(true);
    });
    return () => {
      cancelled = true;
      if (ref.current && dirty.current) void savePace(profileId, ref.current);
    };
  }, [profileId]);

  // Functions read refs, so they are safe to hand to an engine created once.
  const enabledRef = useRef(enabled);
  const [fns] = useState<Omit<PaceHandle, 'ready'>>(() => ({
    allowance: (units) => (enabledRef.current && ref.current ? ref.current.allowance(input.lastDevice, units) : 0),
    observe: (device, units, ms) => {
      if (!ref.current) return;
      if (ref.current.observe(device, units, ms)) {
        dirty.current = true;
        // Save every few answers, so closing the browser mid-game loses little.
        if (++unsaved.current >= SAVE_EVERY) {
          unsaved.current = 0;
          void savePace(profileId, ref.current);
        }
      }
      else log.debug('input sample ignored', { device, units, ms });
    },
    model: () => ref.current,
  }));
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  return { ready, ...fns };
}
