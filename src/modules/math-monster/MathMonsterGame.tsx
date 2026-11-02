import type { GameProps } from '../../core/modules/types';
import { AdventureGame } from './AdventureGame';
import { ChallengeGame } from './ChallengeGame';
import type { MathOptions } from './options';
import { ForgePracticeGame } from './ForgePracticeGame';
import { PracticeGame } from './PracticeGame';

export type { MathOptions } from './options';

/** Module entry: picks the game mode (adventure / worksheet pack / practice classroom / forge practice / challenge stage). */
export function MathMonsterGame(props: GameProps<MathOptions>) {
  if (props.options.mode === 'challenge') return <ChallengeGame {...props} />;
  if (props.options.mode === 'forge') return <ForgePracticeGame {...props} />;
  return props.options.mode === 'practice' ? <PracticeGame {...props} /> : <AdventureGame {...props} />;
}
