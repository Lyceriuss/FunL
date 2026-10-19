import type { GameModule, Settings } from './types';

const key = (moduleId: string, profileId: string) => `funl.settings.${moduleId}.${profileId}`;

/** Saved settings for a player, filled in with defaults for anything missing. */
export function loadSettings(mod: GameModule<unknown>, profileId: string): Settings {
  const defaults: Settings = Object.fromEntries((mod.settings ?? []).map((d) => [d.id, d.default]));
  try {
    const saved = JSON.parse(localStorage.getItem(key(mod.id, profileId)) ?? '{}') as Settings;
    for (const def of mod.settings ?? []) {
      if (def.choices.some((c) => c.value === saved[def.id])) defaults[def.id] = saved[def.id];
    }
  } catch {
    /* unavailable or corrupt: use defaults */
  }
  return defaults;
}

export function saveSettings(moduleId: string, profileId: string, settings: Settings): void {
  try {
    localStorage.setItem(key(moduleId, profileId), JSON.stringify(settings));
  } catch {
    /* storage unavailable: settings just won't persist */
  }
}
