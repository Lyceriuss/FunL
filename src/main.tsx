import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { audio } from './core/audio';
import { input } from './core/input/InputManager';
import { configureLogLevel, createIdbLogSink, getLogger, installGlobalErrorHandlers, logs, pruneLogs } from './core/log';
import { APP_VERSION } from './core/telemetry/TelemetrySession';
import './styles.css';

// Logging first, so everything after it (incl. DB upgrades) is captured.
const level = configureLogLevel();
installGlobalErrorHandlers();
logs.addSink(createIdbLogSink('info'));
const log = getLogger('app');
log.info('app start', {
  version: APP_VERSION,
  mode: import.meta.env.MODE,
  logLevel: level,
  userAgent: navigator.userAgent,
  screen: { w: innerWidth, h: innerHeight, dpr: devicePixelRatio },
  touch: navigator.maxTouchPoints > 0,
});
pruneLogs()
  .then((n) => n > 0 && log.debug('pruned old log entries', { removed: n }))
  .catch((err: unknown) => log.warn('log pruning failed', err));

input.attach();
// Audio may only start after a user gesture; any input counts. The current
// device is also exposed for styling (e.g. stronger focus rings for controllers).
input.onRaw((e) => {
  audio.unlock();
  document.documentElement.dataset.input = e.device;
});
// Dev-only handles for debugging and browser tests.
if (import.meta.env.DEV) Object.assign(window as unknown as Record<string, unknown>, { __funlInput: input, __funlAudio: audio });

const root = createRoot(document.getElementById('root')!);

if (import.meta.env.DEV && new URLSearchParams(location.search).has('gallery')) {
  // Dev-only art gallery (see src/dev/Gallery.tsx); never shipped in production builds.
  void import('./dev/Gallery').then(({ Gallery }) => root.render(<Gallery />));
} else {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
