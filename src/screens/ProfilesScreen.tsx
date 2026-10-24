import { useEffect, useRef, useState } from 'react';
import { input } from '../core/input/InputManager';
import { OnScreenKeyboard } from '../core/ui/OnScreenKeyboard';
import { listProfiles, saveProfile } from '../core/telemetry/storage';
import type { Profile } from '../core/telemetry/types';
import { Screen } from '../core/ui/Screen';

const AVATARS = ['🦊', '🐼', '🐸', '🦁', '🐙', '🦄', '🐯', '🐧', '🐲', '🐵'];

export function ProfilesScreen({ onPick, onData, onSound }: { onPick: (p: Profile) => void; onData: () => void; onSound: () => void }) {
  // With a controller, typing a name happens on an on-screen keyboard.
  const usingPad = input.lastDevice === 'gamepad';
  const [keys, setKeys] = useState(usingPad);
  const formRef = useRef<HTMLFormElement>(null);
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[0]);

  // A controller showing up mid-form switches to the on-screen keyboard.
  useEffect(() => input.onRaw((e) => e.device === 'gamepad' && setKeys(true)), []);

  // When the form opens with a controller, put focus on the first letter.
  useEffect(() => {
    if (creating && keys) formRef.current?.querySelector<HTMLElement>('.osk__key')?.focus();
  }, [creating, keys]);

  useEffect(() => {
    listProfiles().then((p) => {
      setProfiles(p);
      if (p.length === 0) setCreating(true);
    });
  }, []);

  const create = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const p: Profile = { id: crypto.randomUUID(), name: trimmed, avatar, createdAt: Date.now() };
    await saveProfile(p);
    onPick(p);
  };

  return (
    <Screen
      title="Who's playing?"
      actions={
        <>
          <button type="button" className="btn btn--ghost" data-focusable onClick={onSound}>
            🔊 Sound
          </button>
          <button type="button" className="btn btn--ghost" data-focusable onClick={onData}>
            📊 Data
          </button>
        </>
      }
    >
      {!creating && (
        <div className="card-grid">
          {profiles?.map((p) => (
            <button key={p.id} type="button" className="card card--profile" data-focusable onClick={() => onPick(p)}>
              <span className="card__icon">{p.avatar}</span>
              <span className="card__title">{p.name}</span>
            </button>
          ))}
          <button type="button" className="card card--add" data-focusable onClick={() => setCreating(true)}>
            <span className="card__icon">＋</span>
            <span className="card__title">New player</span>
          </button>
        </div>
      )}

      {creating && (
        <form
          ref={formRef}
          className="panel form"
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
        >
          <label className="form__label">
            <span className="row">
              Name
              <button type="button" className="btn btn--ghost osk-toggle" data-focusable onClick={() => setKeys((k) => !k)}>
                ⌨ {keys ? 'Hide' : 'Show'} on-screen keyboard
              </button>
            </span>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
              autoFocus={!keys}
              data-focusable={!keys || undefined}
            />
          </label>
          {keys && <OnScreenKeyboard value={name} onChange={(v) => setName(v.slice(0, 20))} />}
          <div className="avatar-row" role="radiogroup" aria-label="Pick an animal">
            {AVATARS.map((a) => (
              <button
                key={a}
                type="button"
                role="radio"
                aria-checked={a === avatar}
                className={`avatar ${a === avatar ? 'is-selected' : ''}`}
                data-focusable
                onClick={() => setAvatar(a)}
              >
                {a}
              </button>
            ))}
          </div>
          <div className="row">
            {!!profiles?.length && (
              <button type="button" className="btn" data-focusable onClick={() => setCreating(false)}>
                Cancel
              </button>
            )}
            <button type="submit" className="btn btn--primary" data-focusable disabled={!name.trim()}>
              Let's go!
            </button>
          </div>
        </form>
      )}
    </Screen>
  );
}
