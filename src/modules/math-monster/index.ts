import type { GameModule } from '../../core/modules/types';
import { mathControls } from './controls';
import { MathMonsterGame } from './MathMonsterGame';
import type { MathOptions } from './options';
import { parseMathPack } from './schema';
import { MathHub } from './MathHub';

export const mathMonsterModule: GameModule<MathOptions> = {
  id: 'math-monster',
  title: 'Math Monster',
  subject: 'math',
  description: 'Free the moon-fox brothers in Adventure, then practise maths together in class.',
  icon: '👾',
  controls: mathControls,
  presetsTitle: 'Adventure',
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
  Hub: MathHub,
  Component: MathMonsterGame,
};

export { parseMathPack, MathPackSchema } from './schema';
