import { DEFAULT_LEVELS } from '../../core/math/levels';
import type { LevelConfig } from '../../core/math/schema';

/** Which equations earn the pieces (the same rules as Math Monster's levels). */
export interface DuelTopic {
  id: string;
  label: string;
  description: string;
  level: LevelConfig;
}

const byName = (name: string) => {
  const l = DEFAULT_LEVELS.find((x) => x.name === name);
  if (!l) throw new Error(`unknown level ${name}`);
  return l;
};

export const DUEL_TOPICS: DuelTopic[] = [
  { id: 'to-10', label: 'Plus & minus to 10', description: 'Sums and take-aways up to 10', level: byName('Mix to 10') },
  { id: 'to-20', label: 'Plus & minus to 20', description: 'Sums and take-aways up to 20', level: byName('Sums to 20') },
  { id: 'tables', label: 'Times tables', description: 'All the times tables', level: byName('Times tables') },
  { id: 'big', label: 'Big numbers', description: 'Two-digit sums', level: byName('Big sums') },
];

export function topicById(id: string): DuelTopic {
  return DUEL_TOPICS.find((t) => t.id === id) ?? DUEL_TOPICS[0];
}
