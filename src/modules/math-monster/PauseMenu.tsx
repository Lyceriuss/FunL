import { useEffect, useRef } from 'react';
import { useControlScheme, useMenuNavigation } from '../../core/input/hooks';
import { baseScheme } from '../../core/input/types';

export function PauseMenu({
  onResume,
  onQuit,
  resumeLabel = '▶ Keep fighting',
  quitLabel = 'Retreat',
}: {
  onResume: () => void;
  onQuit: () => void;
  resumeLabel?: string;
  quitLabel?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useControlScheme(baseScheme);
  useMenuNavigation(ref, { onBack: onResume, onPause: onResume });
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[data-focusable]')?.focus();
  }, []);
  return (
    <div className="mm-pause" ref={ref} role="dialog" aria-label="Paused">
      <h2>PAUSED</h2>
      <button type="button" data-focusable className="btn btn--primary btn--big" onClick={onResume}>
        {resumeLabel}
      </button>
      <button type="button" data-focusable className="btn btn--big" onClick={onQuit}>
        {quitLabel}
      </button>
    </div>
  );
}
