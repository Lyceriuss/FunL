import { mathMonsterModule } from '../../modules/math-monster';
import type { GameModule } from './types';

/**
 * All installed learning games. Adding a module = implement GameModule in
 * src/modules/<name>/ and list it here.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const MODULES: GameModule<any>[] = [mathMonsterModule];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getModule(id: string): GameModule<any> | undefined {
  return MODULES.find((m) => m.id === id);
}
