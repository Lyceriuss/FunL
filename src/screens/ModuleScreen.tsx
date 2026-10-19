import { useEffect, useState } from 'react';
import { loadSettings, saveSettings } from '../core/modules/settings';
import type { GameModule, Settings } from '../core/modules/types';
import { deletePack, listPacks, savePack } from '../core/telemetry/storage';
import type { ContentPack } from '../core/telemetry/types';
import { Screen } from '../core/ui/Screen';
import { getLogger } from '../core/log/logger';

const log = getLogger('content');

export function ModuleScreen({
  module,
  profileId,
  onStart,
  onBack,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  module: GameModule<any>;
  profileId: string;
  onStart: (options: unknown, settings: Settings) => void;
  onBack: () => void;
}) {
  const [settings, setSettings] = useState<Settings>(() => loadSettings(module, profileId));
  const setSetting = (id: string, value: Settings[string]) => {
    const next = { ...settings, [id]: value };
    setSettings(next);
    saveSettings(module.id, profileId, next);
  };
  const [packs, setPacks] = useState<ContentPack[]>([]);
  const [importing, setImporting] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const refresh = () => listPacks(module.id).then(setPacks);
  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [module.id]);

  const doImport = async (raw: string, origin: string) => {
    setError(null);
    try {
      const data: unknown = JSON.parse(raw);
      const parsed = module.importPack!(data);
      await savePack({
        id: crypto.randomUUID(),
        moduleId: module.id,
        title: parsed.title,
        data,
        origin,
        createdAt: Date.now(),
      });
      log.info('pack imported', { moduleId: module.id, title: parsed.title, origin });
      setText('');
      setImporting(false);
      await refresh();
    } catch (e) {
      log.warn('pack import rejected', { moduleId: module.id, origin, error: e });
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const startPack = (p: ContentPack) => {
    try {
      onStart(module.importPack!(p.data).options, settings);
    } catch (e) {
      log.error('stored pack no longer valid', { moduleId: module.id, packId: p.id, error: e });
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const help = module.controls.help;

  return (
    <Screen title={`${module.icon} ${module.title}`} onBack={onBack}>
      {!!module.settings?.length && (
        <section className="settings">
          {module.settings.map((def) => (
            <div key={def.id} className="setting">
              <span className="setting__label">{def.label}</span>
              <div className="segmented" role="radiogroup" aria-label={def.label}>
                {def.choices.map((c) => (
                  <button
                    key={String(c.value)}
                    type="button"
                    role="radio"
                    aria-checked={settings[def.id] === c.value}
                    className={settings[def.id] === c.value ? 'is-selected' : ''}
                    data-focusable
                    onClick={() => setSetting(def.id, c.value)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      <section>
        <h2 className="section-title">{module.presetsTitle ?? 'Play'}</h2>
        <div className="card-grid card-grid--small">
          {module.presets.map((p, i) => (
            <button
              key={p.id}
              type="button"
              className="card"
              data-focusable
              data-autofocus={i === 0 || undefined}
              onClick={() => onStart(p.options, settings)}
            >
              <span className="card__title">{p.label}</span>
              {p.description && <span className="card__desc">{p.description}</span>}
            </button>
          ))}
        </div>
      </section>

      {module.Hub && <module.Hub profileId={profileId} onStart={(options: unknown) => onStart(options, settings)} />}

      {module.importPack && (
        <section>
          <h2 className="section-title">Worksheets</h2>
          <div className="card-grid card-grid--small">
            {packs.map((p) => (
              <div key={p.id} className="card card--pack">
                <button type="button" className="card__main" data-focusable onClick={() => startPack(p)}>
                  <span className="card__title">📝 {p.title}</span>
                  <span className="card__desc">{new Date(p.createdAt).toLocaleDateString()} · {p.origin}</span>
                </button>
                <button
                  type="button"
                  className="card__remove"
                  data-focusable
                  aria-label={`Delete ${p.title}`}
                  onClick={async () => {
                    if (confirm(`Delete "${p.title}"?`)) {
                      await deletePack(p.id);
                      await refresh();
                    }
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
            {!importing && (
              <button type="button" className="card card--add" data-focusable onClick={() => setImporting(true)}>
                <span className="card__title">＋ Import worksheet</span>
                <span className="card__desc">Paste or load a JSON pack</span>
              </button>
            )}
          </div>

          {importing && (
            <div className="panel form">
              <textarea
                className="input input--code"
                rows={8}
                placeholder='{"id":"week-42","title":"Week 42","problems":[{"a":3,"op":"+","b":4}]}'
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <div className="row">
                <label className="btn" data-focusable tabIndex={0}>
                  Load file…
                  <input
                    type="file"
                    accept="application/json,.json"
                    hidden
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) await doImport(await file.text(), 'file');
                    }}
                  />
                </label>
                <span className="spacer" />
                <button type="button" className="btn" data-focusable onClick={() => setImporting(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn--primary"
                  data-focusable
                  disabled={!text.trim()}
                  onClick={() => doImport(text, 'paste')}
                >
                  Import
                </button>
              </div>
            </div>
          )}
          {error && <p className="error" role="alert">{error}</p>}
        </section>
      )}

      <section>
        <h2 className="section-title">Controls</h2>
        <div className="help-grid">
          {Object.entries(help).map(([device, lines]) => (
            <div key={device} className="panel">
              <strong>{deviceLabel(device)}</strong>
              <ul>
                {lines?.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </Screen>
  );
}

function deviceLabel(d: string): string {
  return d === 'keyboard' ? '⌨️ Keyboard' : d === 'gamepad' ? '🎮 Controller' : d === 'touch' ? '👆 Touch' : d;
}
