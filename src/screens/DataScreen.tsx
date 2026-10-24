import { useEffect, useState } from 'react';
import { clearPersistedLogs, readPersistedLogs } from '../core/log/idbLogSink';
import { getLogger, logs, type LogEntry } from '../core/log/logger';
import { APP_VERSION } from '../core/telemetry/TelemetrySession';
import { getModule } from '../core/modules/registry';
import { deleteProfile, exportAll, listProfiles, listSessions } from '../core/telemetry/storage';
import type { Profile, SessionRecord } from '../core/telemetry/types';
import { Screen } from '../core/ui/Screen';
import { ConfirmButton } from '../core/ui/ConfirmButton';
import { PaceTable } from '../core/ui/PaceTable';

const log = getLogger('data');

/** Grown-up view: recorded sessions, raw data export and diagnostics. */
export function DataScreen({ onBack }: { onBack: () => void }) {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [problems, setProblems] = useState<LogEntry[]>([]);

  const refresh = async () => {
    setSessions(await listSessions());
    setProfiles(await listProfiles());
    const persisted = await readPersistedLogs().catch(() => logs.recent());
    setProblems(persisted.filter((e) => e.level === 'warn' || e.level === 'error').slice(-20).reverse());
  };
  useEffect(() => {
    void refresh();
  }, []);

  const download = async () => {
    const data = await exportAll();
    saveJson('funl-export', data);
    log.info('play data exported', { sessions: data.sessions.length });
  };

  const downloadDiagnostics = async () => {
    const persisted = await readPersistedLogs().catch(() => []);
    saveJson('funl-diagnostics', {
      exportedAt: new Date().toISOString(),
      appVersion: APP_VERSION,
      userAgent: navigator.userAgent,
      logLevel: logs.level,
      persisted,
      // In-memory buffer also holds debug entries that are not persisted.
      recent: logs.recent(),
    });
  };

  const name = (id: string) => {
    const p = profiles.find((x) => x.id === id);
    return p ? `${p.avatar} ${p.name}` : '?';
  };

  return (
    <Screen
      title="Play data"
      onBack={onBack}
      actions={
        <button type="button" className="btn btn--primary" data-focusable onClick={download}>
          ⬇ Export JSON
        </button>
      }
    >
      {sessions.length === 0 && <p className="muted">No sessions recorded yet.</p>}
      {sessions.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>When</th>
                <th>Player</th>
                <th>Game</th>
                <th>Score</th>
                <th>Correct</th>
                <th>Accuracy</th>
                <th>Median time</th>
                <th>Missed taps</th>
                <th>Length</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => {
                const sum = (s.summary ?? {}) as Record<string, unknown>;
                const mis = (sum.misinputs ?? {}) as Record<string, number>;
                return (
                  <tr key={s.id}>
                    <td>{new Date(s.startedAt).toLocaleString()}</td>
                    <td>{name(s.profileId)}</td>
                    <td>{getModule(s.moduleId)?.title ?? s.moduleId}</td>
                    <td>{fmt(sum.score)}</td>
                    <td>{fmt(sum.correct)}</td>
                    <td>{typeof sum.accuracy === 'number' ? `${Math.round(sum.accuracy * 100)}%` : '–'}</td>
                    <td>{typeof sum.medianResponseMs === 'number' ? `${(sum.medianResponseMs / 1000).toFixed(1)} s` : '–'}</td>
                    <td>{fmt(mis.missedTaps)}</td>
                    <td>{s.endedAt ? `${Math.round((s.endedAt - s.startedAt) / 1000)} s` : 'unfinished'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {profiles.length > 0 && (
        <section>
          <h2 className="section-title">Input pace</h2>
          <div className="pace-list">
            {profiles.map((p) => (
              <PaceTable key={p.id} profile={p} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="section-title">Diagnostics</h2>
        <div className="row">
          <button type="button" className="btn" data-focusable onClick={downloadDiagnostics}>
            ⬇ Download logs
          </button>
          <button
            type="button"
            className="btn"
            data-focusable
            onClick={async () => {
              await clearPersistedLogs();
              logs.clear();
              await refresh();
            }}
          >
            Clear logs
          </button>
          <span className="muted">Log level: {logs.level} (add ?log=debug to the URL for more)</span>
        </div>
        {problems.length > 0 ? (
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="table">
              <tbody>
                {problems.map((e, i) => (
                  <tr key={e.id ?? i}>
                    <td>{new Date(e.t).toLocaleString()}</td>
                    <td style={{ color: e.level === 'error' ? 'var(--danger)' : 'var(--gold, #fbbf24)' }}>{e.level}</td>
                    <td>{e.ns}</td>
                    <td>{e.msg}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">No warnings or errors recorded.</p>
        )}
      </section>

      {profiles.length > 0 && (
        <section>
          <h2 className="section-title">Players</h2>
          <div className="chip-row">
            {profiles.map((p) => (
              <ConfirmButton
                key={p.id}
                question={`Delete ${p.name} and all their data?`}
                yes="Delete"
                onConfirm={async () => {
                  await deleteProfile(p.id);
                  await refresh();
                }}
              >
                {p.avatar} {p.name} ✕
              </ConfirmButton>
            ))}
          </div>
        </section>
      )}
    </Screen>
  );
}

function fmt(v: unknown): string {
  return v === undefined || v === null ? '–' : String(v);
}

function saveJson(prefix: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${prefix}-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}
