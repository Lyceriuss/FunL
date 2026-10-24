import { useEffect, useRef, useState } from 'react';
import { SoundPanel } from '../../core/ui/SoundPanel';
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
  const [sound, setSound] = useState(false);
  useControlScheme(baseScheme);
  // B: close the sound panel first, otherwise resume.
  useMenuNavigation(ref, { onBack: () => (sound ? setSound(false) : onResume()), onPause: onResume });
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[data-focusable]')?.focus();
  }, [sound]);

  if (sound) {
    return (
      <div className="mm-pause mm-pause--sound" ref={ref} role="dialog" aria-label="Sound">
        <div className="mm-pause__sound-head">
          <button type="button" data-focusable className="btn" onClick={() => setSound(false)}>
            ← Back
          </button>
          <h2>SOUND</h2>
        </div>
        <div className="mm-pause__sound-body">
          <SoundPanel compact />
        </div>
      </div>
    );
  }
  return (
    <div className="mm-pause" ref={ref} role="dialog" aria-label="Paused">
      <h2>PAUSED</h2>
      <button type="button" data-focusable className="btn btn--primary btn--big" onClick={onResume}>
        {resumeLabel}
      </button>
      <button type="button" data-focusable className="btn btn--big" onClick={() => setSound(true)}>
        🔊 Sound
      </button>
      <button type="button" data-focusable className="btn btn--big" onClick={onQuit}>
        {quitLabel}
      </button>
    </div>
  );
}
