import { getLogger, LEVELS, logs, type LogLevel } from './logger';

const LEVEL_KEY = 'funl.logLevel';
const log = getLogger('app');

/**
 * Pick the log level: `?log=debug` in the URL (remembered), else the saved
 * value, else debug in dev and info in production builds.
 */
export function configureLogLevel(): LogLevel {
  let level: LogLevel = import.meta.env.DEV ? 'debug' : 'info';
  try {
    const fromUrl = new URLSearchParams(location.search).get('log');
    if (fromUrl && fromUrl in LEVELS) localStorage.setItem(LEVEL_KEY, fromUrl);
    const saved = localStorage.getItem(LEVEL_KEY);
    if (saved && saved in LEVELS) level = saved as LogLevel;
  } catch {
    /* storage unavailable: keep default */
  }
  logs.level = level;
  // Keep production consoles quiet unless someone asked for more.
  logs.console = import.meta.env.DEV || LEVELS[level] <= LEVELS.info;
  return level;
}

/** Route uncaught errors and promise rejections into the log. */
export function installGlobalErrorHandlers(win: Window = window): void {
  win.addEventListener('error', (e) => {
    log.error('uncaught error', e.error instanceof Error ? e.error : { message: e.message, source: e.filename, line: e.lineno });
  });
  win.addEventListener('unhandledrejection', (e) => {
    log.error('unhandled promise rejection', e.reason instanceof Error ? e.reason : { reason: String(e.reason) });
  });
}
