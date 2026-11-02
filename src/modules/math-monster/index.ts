import type { GameModule } from '../../core/modules/types';
import { mathControls } from './controls';
import { MathMonsterGame } from './MathMonsterGame';
import type { MathOptions } from './options';
import { parseMathPack } from '../../core/math/schema';
import { JournalPanel, PracticePanel, ProgressPanel } from './MathHub';
import { AdventureMap } from './AdventureMap';
import { CustomPanel } from './ChallengeHub';

export const mathMonsterModule: GameModule<MathOptions> = {
  id: 'math-monster',
  title: 'Math Monster',
  subject: 'math',
  description: 'Free the moon-fox brothers in Adventure, then practise maths together in class.',
  icon: '👾',
  controls: mathControls,
  presets: [
    { id: 'start', label: 'From the start', description: 'Small sums, getting harder', options: { mode: 'adventure', startLevel: 1 } },
    { id: 'plus-minus', label: 'Plus & minus to 20', options: { mode: 'adventure', startLevel: 5 } },
    { id: 'tables', label: 'Times tables', options: { mode: 'adventure', startLevel: 6 } },
    { id: 'big', label: 'Big numbers', options: { mode: 'adventure', startLevel: 8 } },
  ],
  settings: [
    {
      id: 'speed',
      label: 'Speed',
      choices: [
        { label: 'Chill', value: 0.7 },
        { label: 'Normal', value: 1 },
        { label: 'Fast', value: 1.4 },
        { label: 'Turbo', value: 2 },
        { label: 'Insane', value: 3 },
      ],
      default: 1,
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
    {
      id: 'forgeTime',
      label: 'Forge time',
      choices: [
        { label: 'Relaxed', value: 1.5 },
        { label: 'Normal', value: 1 },
        { label: 'Quick', value: 0.7 },
      ],
      default: 1,
    },
    {
      id: 'lanes',
      label: 'Equations at once',
      choices: [
        { label: 'Auto', value: 'auto' },
        { label: '1', value: 1 },
        { label: '2', value: 2 },
        { label: '3', value: 3 },
        { label: '4', value: 4 },
      ],
      default: 'auto',
    },
  ],
  importPack(raw) {
    const pack = parseMathPack(raw);
    return {
      title: pack.title,
      description: pack.description ?? `${pack.problems.length} problems`,
      options: { mode: 'pack', pack },
    };
  },
  modes: [
    {
      id: 'adventure',
      title: 'Adventure',
      icon: '⚔️',
      description: 'Fight the corrupted spirits with fast maths, forge seals in the boss round, and befriend them. Pick a spot on the map to play from there.',
      Panel: AdventureMap,
      settings: ['speed', 'forgeTime', 'lanes', 'inputHelp'],
      settingsTitle: 'Battle settings',
    },
    {
      id: 'practice',
      title: 'Practice',
      icon: '📚',
      description: 'Practise at your own pace. Pick what to practise.',
      Panel: PracticePanel,
      pages: { classroom: 'Classroom', forge: 'Forge workshop' },
    },
    {
      id: 'custom',
      title: 'Custom',
      icon: '🎯',
      description: 'Challenges made for you: a short run of stages picked by a grown-up. Clear them all to win the trophy.',
      Panel: CustomPanel,
      pages: { play: 'Challenge', build: 'Builder' },
    },
  ],
  extras: [
    { id: 'journal', label: 'Journal', icon: '📖', Panel: JournalPanel },
    { id: 'progress', label: 'Progress', icon: '⚙️', Panel: ProgressPanel },
  ],
  Component: MathMonsterGame,
};

export { parseMathPack, MathPackSchema } from '../../core/math/schema';
