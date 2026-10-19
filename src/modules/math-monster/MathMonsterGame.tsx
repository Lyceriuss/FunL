import type { GameProps } from '../../core/modules/types';
import { AdventureGame } from './AdventureGame';
import type { MathOptions } from './options';
import { PracticeGame } from './PracticeGame';

export type { MathOptions } from './options';

/** Module entry: picks the game mode (adventure / worksheet pack / practice classroom). */
export function MathMonsterGame(props: GameProps<MathOptions>) {
  return props.options.mode === 'practice' ? <PracticeGame {...props} /> : <AdventureGame {...props} />;
}
