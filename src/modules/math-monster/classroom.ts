import { PRACTICE_LENGTH } from './companion';
import { levelAt, DEFAULT_LEVELS } from './levels';
import type { LevelConfig } from './schema';

/**
 * The practice classroom's stage ladder. Every stage is one lesson of
 * PRACTICE_LENGTH equations. Pass it (PASS_CORRECT right) and the next,
 * harder stage unlocks and starts automatically; otherwise try again.
 *
 * Difficulty climbs topic by topic; each topic is played twice: first at a
 * calm pace in one lane, then faster in two lanes. After the last topic the
 * pace keeps rising.
 */

export interface Topic {
  /** Adventure difficulty level whose rules it uses (unless `config` is given). */
  level: number;
  label: string;
  /** Classroom-only rules, e.g. three-number sums. */
  config?: LevelConfig;
}

export const TOPIC_LADDER: Topic[] = [
  { level: 1, label: 'Small sums' },
  { level: 2, label: 'Sums to 10' },
  {
    level: 2,
    label: 'Three numbers: find a 10',
    config: {
      name: 'Three numbers',
      rules: [{ op: '+', a: { min: 1, max: 9 }, b: { min: 1, max: 9 }, terms: 3, makeTen: true }],
      travelMs: 15000,
      hitsToDefeat: 8,
      lanes: 1,
    },
  },
  { level: 3, label: 'Take away' },
  { level: 5, label: 'Plus & minus to 20' },
  { level: 6, label: '2, 5 and 10 tables' },
  { level: 7, label: 'Times tables' },
  { level: 8, label: 'Big sums' },
  { level: 9, label: 'Sharing (÷)' },
];

/** Correct answers needed (out of PRACTICE_LENGTH) to pass a stage: 75%. */
export const PASS_CORRECT = Math.ceil(PRACTICE_LENGTH * 0.75);

export interface StageConfig {
  stage: number;
  /** Difficulty level whose rules generate the equations. */
  level: number;
  /** The rules and base pace used for this stage. */
  levelConfig: LevelConfig;
  topic: string;
  /** 'calm' = first time on a topic, 'quick' = second time, faster. */
  pace: 'calm' | 'quick';
  /** Multiplies the player's speed setting. */
  speedFactor: number;
  /** Lanes per column. */
  lanes: number;
  length: number;
}

const QUICK_FACTOR = 1.3;
const BEYOND_FACTOR = 1.1;

export function stageConfig(stage: number): StageConfig {
  const s = Math.max(1, Math.floor(stage));
  const i = s - 1;
  const topicIdx = Math.min(Math.floor(i / 2), TOPIC_LADDER.length - 1);
  const topic = TOPIC_LADDER[topicIdx];
  const beyond = Math.max(0, i - (TOPIC_LADDER.length * 2 - 1));
  const quick = i % 2 === 1 || beyond > 0;
  return {
    stage: s,
    level: topic.level,
    levelConfig: topic.config ?? levelAt(DEFAULT_LEVELS, topic.level),
    topic: topic.label,
    pace: quick ? 'quick' : 'calm',
    speedFactor: (quick ? QUICK_FACTOR : 1) * BEYOND_FACTOR ** beyond,
    lanes: quick ? 2 : 1,
    length: PRACTICE_LENGTH,
  };
}

export function stagePassed(correct: number, length = PRACTICE_LENGTH): boolean {
  return correct >= Math.ceil(length * 0.75);
}

export function stageLabel(c: StageConfig): string {
  return `${c.topic} · ${c.pace === 'quick' ? 'quick' : 'calm'}`;
}
