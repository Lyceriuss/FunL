import { useRef } from 'react';
import { getLogger } from '../../core/log/logger';
import type { GameProps, GameResult } from '../../core/modules/types';
import { AdventureGame } from './AdventureGame';
import { ForgePracticeGame } from './ForgePracticeGame';
import { PracticeGame } from './PracticeGame';
import { isComplete, loadChallenges, putChallenge, recordStageResult, saveChallenges, stageCleared, stageOfKind } from './challenges';
import type { ChallengeOptions, MathOptions } from './options';

const log = getLogger('math-monster.challenge');

/**
 * One stage of a custom challenge: plays the stage's game (a fight, a Forge
 * lesson or a classroom lesson) and, when it ends, records whether the stage
 * was cleared so the challenge map opens the next one.
 */
export function ChallengeGame(props: GameProps<MathOptions>) {
  const o = props.options as ChallengeOptions;
  const done = useRef(false);

  const onFinish = async (result: GameResult) => {
    if (done.current) return;
    done.current = true;
    const passed = stageCleared(o.stage, result);
    let completed = false;
    try {
      const book = await loadChallenges(props.profile.id);
      const c = book.challenges.find((x) => x.id === o.challengeId);
      if (c) {
        const next = recordStageResult(c, o.index, passed, Date.now());
        completed = isComplete(next) && !isComplete(c);
        await saveChallenges(props.profile.id, putChallenge(book, next));
      }
    } catch (err) {
      log.error('could not save challenge progress', err);
    }
    props.telemetry.log('math.challenge.stage', {
      challengeId: o.challengeId,
      index: o.index,
      stages: o.total,
      kind: o.stage.kind,
      stage: o.stage,
      passed,
      challengeComplete: completed,
    });
    log.info('challenge stage finished', { challengeId: o.challengeId, index: o.index, passed, completed });
    props.onFinish({
      ...result,
      summary: { ...result.summary, challenge: { id: o.challengeId, index: o.index, stages: o.total, kind: o.stage.kind, passed, completed } },
      highlights: [
        {
          label: o.title,
          value: completed ? '🏆 Challenge complete!' : passed ? `Stage ${o.index + 1} of ${o.total} cleared ✓` : `Stage ${o.index + 1} not cleared yet`,
        },
        ...result.highlights,
      ],
    });
  };

  const inner = { ...props, onFinish: (r: GameResult) => void onFinish(r) };
  const s = o.stage;
  if (s.kind === 'forge') return <ForgePracticeGame {...inner} options={{ mode: 'forge', tier: s.tier, companionId: o.companionId, seed: o.seed, oneLesson: true }} />;
  if (s.kind === 'classroom' && o.companionId)
    return <PracticeGame {...inner} options={{ mode: 'practice', stage: s.stage, companionId: o.companionId, seed: o.seed, oneLesson: true }} />;
  // A classroom stage needs a companion (the map won't start one without);
  // just in case, it becomes a battle on the same topic.
  if (s.kind === 'classroom') return <AdventureGame {...inner} options={{ ...o, stage: stageOfKind('battle', s) }} />;
  return <AdventureGame {...inner} />;
}
