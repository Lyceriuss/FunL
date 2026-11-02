import type { GameResult } from '../../core/modules/types';
import type { DuelEvent, DuelState } from './duel';

type Answer = Extract<DuelEvent, { firstInputMs: number }>;

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return Math.round(s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2);
};
const secs = (ms: number | null) => (ms === null ? '–' : `${(ms / 1000).toFixed(1)} s`);

/** Session summary + results-screen highlights for one duel. */
export function buildDuelResult(
  state: DuelState,
  answers: Answer[],
  meta: { rival: string; topic: string; device: string; rivalAnswers: { correct: boolean }[] },
  reason: GameResult['reason'],
): GameResult {
  const correct = answers.filter((a) => a.type === 'answer.correct');
  const wrong = answers.filter((a) => a.type === 'answer.wrong');
  const accuracy = answers.length ? correct.length / answers.length : null;
  const result = state.phase === 'won' || state.phase === 'lost' || state.phase === 'draw' ? state.phase : 'quit';
  const rivalRight = meta.rivalAnswers.filter((a) => a.correct).length;
  const summary = {
    result,
    rival: meta.rival,
    topic: meta.topic,
    board: { seed: state.board.seed, target: state.board.target, shortest: state.board.shortest },
    durationMs: Math.round(state.time),
    answers: answers.length,
    correct: correct.length,
    wrong: wrong.length,
    accuracy,
    medianResponseMs: median(correct.map((a) => a.responseMs)),
    medianThinkMs: median(correct.map((a) => a.firstInputMs)),
    medianInputMs: median(correct.map((a) => a.typingMs)),
    you: { pathLength: state.you.path.length - 1, value: state.you.values[state.you.values.length - 1], builds: state.you.builds, blocks: state.you.blocks, backs: state.you.backs },
    glitch: { pathLength: state.rival.path.length - 1, value: state.rival.values[state.rival.values.length - 1], builds: state.rival.builds, blocks: state.rival.blocks, backs: state.rival.backs, answers: meta.rivalAnswers.length, correct: rivalRight },
    wrongFacts: wrong.map((a) => ({ key: a.key, given: a.given, answer: a.answer })),
    device: meta.device,
  };
  const headline = result === 'won' ? 'You reached the gate first! 🌟' : result === 'lost' ? 'Glitch got there first' : result === 'draw' ? 'A draw' : 'Duel left early';
  return {
    reason,
    summary,
    highlights: [
      { label: 'Result', value: headline },
      { label: 'Correct answers', value: `${correct.length} of ${answers.length}${accuracy !== null ? ` (${Math.round(accuracy * 100)}%)` : ''}` },
      { label: 'Typical answer time', value: secs(summary.medianResponseMs) },
      { label: 'Your path', value: `${summary.you.pathLength} squares, number ${summary.you.value} (target ${state.board.target})` },
      { label: 'Stones dropped', value: `${state.you.blocks} by you, ${state.rival.blocks} by Glitch` },
      { label: "Glitch's answers", value: `${rivalRight} of ${meta.rivalAnswers.length} right` },
    ],
  };
}
