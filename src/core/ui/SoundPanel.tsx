import { useEffect, useState } from 'react';
import { audio, chosenSfx, chosenTrack, MUSIC, MUSIC_SLOTS, SFX, type AudioSettings } from '../audio';

const LEVELS: { label: string; value: number }[] = [
  { label: 'Off', value: 0 },
  { label: 'Low', value: 0.3 },
  { label: 'Medium', value: 0.6 },
  { label: 'High', value: 1 },
];

/** Nearest level button for a stored volume. */
function levelOf(v: number): number {
  return LEVELS.reduce((best, l) => (Math.abs(l.value - v) < Math.abs(best - v) ? l.value : best), LEVELS[0].value);
}

/**
 * Sound settings and library: volumes, which music plays for each mood, and
 * which effect plays for each game moment. Picking a variant plays it, so
 * you can hear how it feels. Works with touch, mouse, keyboard and
 * controller (all buttons are data-focusable).
 */
export function SoundPanel({ compact = false }: { compact?: boolean }) {
  const [s, setS] = useState<AudioSettings>(audio.settings);
  useEffect(() => audio.onChange(() => setS({ ...audio.settings })), []);
  // Leaving the panel stops any music preview and returns to the scene's music.
  useEffect(() => () => audio.restoreMusic(), []);

  const vol = (key: 'master' | 'music' | 'sfx', label: string) => (
    <div className="setting">
      <span className="setting__label">{label}</span>
      <div className="segmented" role="radiogroup" aria-label={label}>
        {LEVELS.map((l) => (
          <button
            key={l.label}
            type="button"
            role="radio"
            aria-checked={levelOf(s[key]) === l.value}
            className={levelOf(s[key]) === l.value ? 'is-selected' : ''}
            data-focusable
            onClick={() => {
              audio.unlock();
              audio.update({ [key]: l.value });
              if (key !== 'music') audio.sfx('correct');
            }}
          >
            {l.label}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className={`sound-panel ${compact ? 'sound-panel--compact' : ''}`}>
      <section className="settings">
        <div className="setting">
          <span className="setting__label">Sound</span>
          <div className="segmented" role="radiogroup" aria-label="Sound on or off">
            {[false, true].map((muted) => (
              <button
                key={String(muted)}
                type="button"
                role="radio"
                aria-checked={s.muted === muted}
                className={s.muted === muted ? 'is-selected' : ''}
                data-focusable
                onClick={() => {
                  audio.unlock();
                  audio.update({ muted });
                }}
              >
                {muted ? '🔇 Off' : '🔊 On'}
              </button>
            ))}
          </div>
        </div>
        {vol('master', 'Volume')}
        {vol('music', 'Music')}
        {vol('sfx', 'Effects')}
      </section>

      <section>
        <h2 className="section-title">Music · pick a mood for each place</h2>
        {MUSIC_SLOTS.map((m) => {
          const current = chosenTrack(s, m.slot);
          return (
            <div key={m.slot} className="sound-row">
              <div className="sound-row__label">
                <strong>{m.label}</strong>
                <span className="muted">{m.when}</span>
              </div>
              <div className="sound-row__chips">
                {[...MUSIC, { id: 'none', name: 'Silent', mood: 'quiet' }].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`sound-chip ${current === t.id ? 'is-selected' : ''}`}
                    data-focusable
                    aria-pressed={current === t.id}
                    onClick={() => {
                      audio.unlock();
                      audio.update({ musicChoice: { [m.slot]: t.id } });
                      audio.previewTrack(t.id);
                    }}
                  >
                    {t.name}
                    <small>{t.mood}</small>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </section>

      <section>
        <h2 className="section-title">Effects · pick how each moment feels</h2>
        {SFX.map((slot) => {
          const current = chosenSfx(s, slot.slot);
          return (
            <div key={slot.slot} className="sound-row">
              <div className="sound-row__label">
                <strong>{slot.label}</strong>
                <span className="muted">{slot.when}</span>
              </div>
              <div className="sound-row__chips">
                {slot.variants.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    className={`sound-chip ${current === v.id ? 'is-selected' : ''}`}
                    data-focusable
                    aria-pressed={current === v.id}
                    onClick={() => {
                      audio.unlock();
                      audio.update({ sfxChoice: { [slot.slot]: v.id } });
                      audio.playVariant(slot.slot, v.id);
                    }}
                  >
                    {v.name}
                    <small>{v.mood}</small>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
