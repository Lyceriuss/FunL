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
   * (e.g. a collection, journal or progress view for this player). Used when
   * the module has no `modes`.
   */
  Hub?: ComponentType<PanelProps<Options>>;
  /**
   * Top-level choices on the module screen (e.g. Adventure, Practice). The
   * screen opens on big cards for these; each mode shows its own settings,
   * presets and panel. Without modes, everything is on one page.
   */
  modes?: ModuleMode<Options>[];
  /**
   * Extra pages in the module screen's settings bar (e.g. a journal, progress
   * reset). The shell adds Worksheets (if `importPack`) and Controls itself.
   */
  extras?: ModuleExtra<Options>[];
  Component: ComponentType<GameProps<Options>>;
}

/** Props for a module's panels on the module screen. */
export interface PanelProps<Options = unknown> {
  profileId: string;
  onStart: (options: Options) => void;
  /** A mode panel's sub-page (one of `ModuleMode.pages`), or undefined for its overview. */
  page?: string;
  /** Open a sub-page of this mode (`null` = its overview). B / Back goes up again. */
  openPage?: (page: string | null) => void;
}

export interface ModuleMode<Options = unknown> {
  id: string;
  title: string;
  /** Emoji for the mode card. */
  icon: string;
  description: string;
  /** Ids of the settings shown in this mode. */
  settings?: string[];
  /** Ids of the presets shown in this mode. */
  presets?: string[];
  /** Heading for those presets (default "Play"). */
  presetsTitle?: string;
  /** Heading for this mode's settings (shown under the panel). */
  settingsTitle?: string;
  /** The mode's main content (e.g. a world map, practice blocks), shown first. */
  Panel?: ComponentType<PanelProps<Options>>;
  /** Sub-pages the panel can open (id → title), e.g. { classroom: 'Classroom' }. */
  pages?: Record<string, string>;
}

export interface ModuleExtra<Options = unknown> {
  id: string;
  /** Short label for the settings bar, e.g. "Journal". */
  label: string;
  icon: string;
  Panel: ComponentType<PanelProps<Options>>;
}
