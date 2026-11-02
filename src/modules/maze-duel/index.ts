import type { GameModule } from '../../core/modules/types';
import { answerControls } from './controls';
import { DuelGame, type DuelGameOptions } from './DuelGame';
import { DuelHub } from './DuelHub';
import { DUEL_TOPICS } from './topics';

export const mazeDuelModule: GameModule<DuelGameOptions> = {
  id: 'maze-duel',
  title: 'Maze Duel',
  subject: 'math',
  description: 'Race Glitch through a number maze: right answers build your path to the ★ gate.',
  icon: '🧩',
  controls: answerControls,
  presetsTitle: 'Duel with',
  presets: DUEL_TOPICS.map((t) => ({ id: t.id, label: t.label, description: t.description, options: { topic: t.id } })),
  settings: [
    {
      id: 'rival',
      label: 'Glitch',
      choices: [
        { label: 'Easy', value: 'easy' },
        { label: 'Medium', value: 'medium' },
        { label: 'Hard', value: 'hard' },
      ],
      default: 'easy',
    },
    {
      id: 'hints',
      label: 'Path hints',
      choices: [
        { label: 'On', value: 'on' },
        { label: 'Off', value: 'off' },
      ],
      default: 'on',
    },
    {
      id: 'inputHelp',
      label: 'Input time help',
      choices: [
        { label: 'Auto', value: 'auto' },
        { label: 'Off', value: 'off' },
      ],
      default: 'auto',
    },
  ],
  Hub: DuelHub,
  Component: DuelGame,
};
