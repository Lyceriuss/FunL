import { useEffect, useState } from 'react';
import { getLogger } from '../core/log/logger';
import { loadSettings, saveSettings } from '../core/modules/settings';
import type { GameModule, ModuleMode, SettingDef, Settings } from '../core/modules/types';
import { deletePack, listPacks, savePack } from '../core/telemetry/storage';
import type { ContentPack } from '../core/telemetry/types';
import { ConfirmButton } from '../core/ui/ConfirmButton';
import { Screen } from '../core/ui/Screen';

const log = getLogger('content');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyModule = GameModule<any>;

/**
 * Which page of the module screen is shown:
 * - 'home': the mode cards (or, without modes, everything on one page)
 * - a mode id ('adventure', 'practice'…), or 'mode/page' for one of its sub-pages
 * - 'extra:<id>', 'worksheets', 'controls': pages from the settings bar
 */
type View = string;

/** Remember the page per module for this browser tab, so "Done" after a game returns to it. */
const viewKey = (moduleId: string) => `funl.moduleView.${moduleId}`;
function loadView(moduleId: string): View {
  try {
    return sessionStorage.getItem(viewKey(moduleId)) ?? 'home';
  } catch {
    return 'home';
  }
}
function storeView(moduleId: string, view: View) {
  try {
    sessionStorage.setItem(viewKey(moduleId), view);
  } catch {
    /* private mode etc.: not remembered */
  }
}

/**
 * A module's screen. With `modes`, it opens on big cards (e.g. Adventure /
 * Practice); each mode has its own settings, starting points and panel.
 * Worksheets, controls and the module's extras live in the settings bar at
 * the top. B / Back goes up one page.
 */
export function ModuleScreen({
  module,
  profileId,
  onStart,
  onBack,
}: {
  module: AnyModule;
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
  const [view, setViewState] = useState<View>(() => {
    const v = loadView(module.id);
    return isValidView(module, v) ? v : 'home';
  });
  const setView = (v: View) => {
    setViewState(v);
    storeView(module.id, v);
  };
  const start = (options: unknown) => onStart(options, settings);

  const [modeId, page] = view.split('/') as [string, string | undefined];
  const mode = module.modes?.find((m) => m.id === modeId);
  const extra = view.startsWith('extra:') ? module.extras?.find((x) => `extra:${x.id}` === view) : undefined;
  const title =
    mode ? `${mode.icon} ${mode.title}${page ? ` › ${mode.pages?.[page] ?? page}` : ''}`
    : extra ? `${extra.icon} ${extra.label}`
    : view === 'worksheets' ? '📝 Worksheets'
    : view === 'controls' ? '🎮 Controls'
    : `${module.icon} ${module.title}`;

  const bar = (
    <nav className="module-bar" aria-label="Settings">
      {module.extras?.map((x) => (
        <BarButton key={x.id} current={view === `extra:${x.id}`} onClick={() => setView(`extra:${x.id}`)}>
          {x.icon} {x.label}
        </BarButton>
      ))}
      {module.importPack && (
        <BarButton current={view === 'worksheets'} onClick={() => setView('worksheets')}>
          📝 Worksheets
        </BarButton>
      )}
      <BarButton current={view === 'controls'} onClick={() => setView('controls')}>
        🎮 Controls
      </BarButton>
    </nav>
  );

  return (
    // Keyed by page, so each page gets fresh controller focus (its first item).
    <Screen key={view} title={title} onBack={view === 'home' ? onBack : () => setView(page ? modeId : 'home')} actions={bar}>
      {view === 'home' && module.modes && <ModeCards modes={module.modes} onPick={setView} />}
      {view === 'home' && !module.modes && (
        <>
          <SettingsList defs={module.settings ?? []} settings={settings} onChange={setSetting} />
          <Presets title={module.presetsTitle ?? 'Play'} presets={module.presets} onStart={start} />
          {module.Hub && <module.Hub profileId={profileId} onStart={start} />}
        </>
      )}
      {mode && (
        <>
          {!page && <p className="muted mode-intro">{mode.description}</p>}
          {mode.Panel && (
            <mode.Panel profileId={profileId} onStart={start} page={page} openPage={(p) => setView(p ? `${mode.id}/${p}` : mode.id)} />
          )}
          {!page && !!mode.settings?.length && (
            <section>
              {mode.settingsTitle && <h2 className="section-title">{mode.settingsTitle}</h2>}
              <SettingsList defs={(module.settings ?? []).filter((d) => mode.settings?.includes(d.id))} settings={settings} onChange={setSetting} />
            </section>
          )}
          {!page && !!mode.presets?.length && (
            <Presets title={mode.presetsTitle ?? 'Play'} presets={module.presets.filter((p) => mode.presets!.includes(p.id))} onStart={start} />
          )}
        </>
      )}
      {extra && <extra.Panel profileId={profileId} onStart={start} />}
      {view === 'worksheets' && module.importPack && <Worksheets module={module} onStart={start} />}
      {view === 'controls' && <ControlsHelp help={module.controls.help} />}
    </Screen>
  );
}

function isValidView(module: AnyModule, v: View): boolean {
  if (v === 'home' || v === 'controls') return true;
  if (v === 'worksheets') return !!module.importPack;
  if (v.startsWith('extra:')) return !!module.extras?.some((x) => `extra:${x.id}` === v);
  const [modeId, page] = v.split('/');
  const mode = module.modes?.find((m) => m.id === modeId);
  return !!mode && (page === undefined || !!mode.pages?.[page]);
}

function BarButton({ current, onClick, children }: { current: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className={`btn btn--ghost module-bar__btn ${current ? 'is-current' : ''}`} aria-current={current || undefined} data-focusable onClick={onClick}>
      {children}
    </button>
  );
}

function ModeCards({ modes, onPick }: { modes: ModuleMode[]; onPick: (id: string) => void }) {
  return (
    <div className="mode-grid">
      {modes.map((m, i) => (
        <button key={m.id} type="button" className={`card mode-card mode-card--${m.id}`} data-focusable data-autofocus={i === 0 || undefined} onClick={() => onPick(m.id)}>
          <span className="mode-card__icon" aria-hidden>
            {m.icon}
          </span>
          <span className="card__title">{m.title}</span>
          <span className="card__desc">{m.description}</span>
        </button>
      ))}
    </div>
  );
}

function SettingsList({ defs, settings, onChange }: { defs: SettingDef[]; settings: Settings; onChange: (id: string, v: Settings[string]) => void }) {
  if (!defs.length) return null;
  return (
    <section className="settings">
      {defs.map((def) => (
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
                onClick={() => onChange(def.id, c.value)}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function Presets({ title, presets, onStart }: { title: string; presets: AnyModule['presets']; onStart: (options: unknown) => void }) {
  return (
    <section>
      <h2 className="section-title">{title}</h2>
      <div className="card-grid card-grid--small">
        {presets.map((p, i) => (
          <button key={p.id} type="button" className="card" data-focusable data-autofocus={i === 0 || undefined} onClick={() => onStart(p.options)}>
            <span className="card__title">{p.label}</span>
            {p.description && <span className="card__desc">{p.description}</span>}
          </button>
        ))}
      </div>
    </section>
  );
}

function Worksheets({ module, onStart }: { module: AnyModule; onStart: (options: unknown) => void }) {
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
      await savePack({ id: crypto.randomUUID(), moduleId: module.id, title: parsed.title, data, origin, createdAt: Date.now() });
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
      onStart(module.importPack!(p.data).options);
    } catch (e) {
      log.error('stored pack no longer valid', { moduleId: module.id, packId: p.id, error: e });
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <section>
      <p className="muted mode-intro">Play a worksheet (for example one made from a paper worksheet) as an adventure.</p>
      <div className="card-grid card-grid--small">
        {packs.map((p) => (
          <div key={p.id} className="card card--pack">
            <button type="button" className="card__main" data-focusable onClick={() => startPack(p)}>
              <span className="card__title">📝 {p.title}</span>
              <span className="card__desc">
                {new Date(p.createdAt).toLocaleDateString()} · {p.origin}
              </span>
            </button>
            <span className="card__remove">
              <ConfirmButton
                className="card__remove-btn"
                question="Delete?"
                yes="Delete"
                onConfirm={async () => {
                  await deletePack(p.id);
                  await refresh();
                }}
              >
                ✕
              </ConfirmButton>
            </span>
          </div>
        ))}
        {!importing && (
          <button type="button" className="card card--add" data-focusable data-autofocus={packs.length === 0 || undefined} onClick={() => setImporting(true)}>
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
            <button type="button" className="btn btn--primary" data-focusable disabled={!text.trim()} onClick={() => doImport(text, 'paste')}>
              Import
            </button>
          </div>
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

function ControlsHelp({ help }: { help: AnyModule['controls']['help'] }) {
  return (
    <section>
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
  );
}

function deviceLabel(d: string): string {
  return d === 'keyboard' ? '⌨️ Keyboard' : d === 'gamepad' ? '🎮 Controller' : d === 'touch' ? '👆 Touch' : d;
}
