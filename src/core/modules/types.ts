import type { ComponentType } from 'react';
import type { ControlScheme } from '../input/types';
import type { TelemetrySession } from '../telemetry/TelemetrySession';
import type { Profile } from '../telemetry/types';

export type Subject = 'math' | 'reading' | 'language' | 'science' | 'other';

export interface GameResult {
  /** Module-specific summary, also stored on the session record. */
  summary: Record<string, unknown>;
  /** Short lines shown on the results screen. */
  highlights: { label: string; value: string }[];
  reason: 'completed' | 'gameover' | 'quit';
}

export type SettingValue = string | number;
export type Settings = Record<string, SettingValue>;

/** A player-adjustable setting, rendered by the shell as a segmented control. */
export interface SettingDef {
  id: string;
  label: string;
  choices: { label: string; value: SettingValue }[];
  default: SettingValue;
}

export interface GameProps<Options = unknown> {
  profile: Profile;
  telemetry: TelemetrySession;
  options: Options;
  /** Player settings (see GameModule.settings), always fully populated. */
  settings: Settings;
  onFinish: (result: GameResult) => void;
}

/**
 * Contract every learning game implements. The shell (menus, profiles,
 * telemetry, input) is shared; a module only supplies these pieces.
 */
export interface GameModule<Options = unknown> {
  id: string;
  title: string;
  subject: Subject;
  description: string;
  /** Emoji or short glyph for the menu card. */
  icon: string;
  controls: ControlScheme;
  /** Selectable presets / content packs shown before starting. */
  presets: { id: string; label: string; description?: string; options: Options }[];
  /** Heading for the presets on the module screen (default "Play"). */
  presetsTitle?: string;
  /** Adjustable settings (speed etc.), remembered per player. */
  settings?: SettingDef[];
  /**
   * Validate imported content (e.g. produced by the MCP server from a
   * worksheet) and turn it into game options. Throws with a readable message.
   */
  importPack?: (raw: unknown) => { title: string; description?: string; options: Options };
  /**
   * Optional module hub shown on the module screen under the play options
   * (e.g. a collection, journal or progress view for this player).
   */
  Hub?: ComponentType<{ profileId: string; onStart: (options: Options) => void }>;
  Component: ComponentType<GameProps<Options>>;
}
