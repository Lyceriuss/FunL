import type { TelemetryEvent } from '../../core/telemetry/types';
import type { EngineState, SolvedRecord } from './engine';

/** What summarize() needs: an engine state, or merged stats from several stages. */
export type SummaryInput = Pick<EngineState, 'score' | 'level' | 'bestStreak' | 'time' | 'stats'>;

export interface MathSummary {
  [key: string]: unknown;
  score: number;
  levelReached: number;
  correct: number;
  wrongAnswers: number;
  timeouts: number;
  accuracy: number | null;
  medianResponseMs: number | null;
  medianFirstInputMs: number | null;
  bestStreak: number;
  byOp: Record<string, { attempts: number; correct: number; medianMs: number | null }>;
  /** Facts that took longest or were missed — good practice targets. */
  hardestFacts: { key: string; ms: number | null; missed: boolean }[];
  misinputs: { missedTaps: number; unmappedKeys: number; emptySubmits: number; backspaces: number };
  /** Input time (first input movement → answer) on the device used most, for correct answers. */
  inputPace: { device: string | null; medianInputMs: number | null; medianMsPerDigit: number | null; answers: number };
  playMs: number;
}

export function summarize(state: SummaryInput, events: readonly TelemetryEvent[]): MathSummary {
  const solved = state.stats.solved;
  const correct = solved.filter((r) => r.correct);
  const attempts = state.stats.correct + state.stats.wrong + state.stats.timeouts;

  const byOp: MathSummary['byOp'] = {};
  for (const r of solved) {
    const o = (byOp[r.op] ??= { attempts: 0, correct: 0, medianMs: null });
    o.attempts++;
    if (r.correct) o.correct++;
  }
  for (const op of Object.keys(byOp)) {
    byOp[op].medianMs = median(correct.filter((r) => r.op === op).map((r) => r.responseMs));
  }

  const count = (pred: (e: TelemetryEvent) => boolean) => events.filter(pred).length;

  return {
    score: state.score,
    levelReached: state.level,
    correct: state.stats.correct,
    wrongAnswers: state.stats.wrong,
    timeouts: state.stats.timeouts,
    accuracy: attempts ? round2(state.stats.correct / attempts) : null,
    medianResponseMs: median(correct.map((r) => r.responseMs)),
    medianFirstInputMs: median(correct.map((r) => r.firstInputMs).filter((n): n is number => n !== null)),
    bestStreak: state.bestStreak,
    byOp,
    hardestFacts: hardest(solved),
    misinputs: {
      missedTaps: count((e) => e.kind === 'input.miss' && e.data.source === 'Pointer'),
      unmappedKeys: count((e) => e.kind === 'input.miss' && e.data.source !== 'Pointer'),
      emptySubmits: count((e) => e.kind === 'math.input.rejected' && e.data.reason === 'empty-submit'),
      backspaces: count((e) => e.kind === 'math.input.backspace'),
    },
    playMs: Math.round(state.time),
    inputPace: inputPaceOf(events),
  };
}

function inputPaceOf(events: readonly TelemetryEvent[]): MathSummary['inputPace'] {
  const answers = events.filter((e) => e.kind === 'math.answer.correct' && typeof e.data.typingMs === 'number');
  const byDevice = new Map<string, TelemetryEvent[]>();
  for (const e of answers) {
    const d = e.device ?? 'unknown';
    byDevice.set(d, [...(byDevice.get(d) ?? []), e]);
  }
  const main = [...byDevice.entries()].sort((a, b) => b[1].length - a[1].length)[0];
  if (!main) return { device: null, medianInputMs: null, medianMsPerDigit: null, answers: 0 };
  const [device, list] = main;
  return {
    device,
    medianInputMs: median(list.map((e) => e.data.typingMs as number)),
    medianMsPerDigit: median(list.map((e) => (e.data.typingMs as number) / Math.max(1, (e.data.digits as number) ?? 1))),
    answers: list.length,
  };
}

/**
 * Facts worth practising: missed, answered wrong first, or clearly slower
 * than this player's own typical time.
 */
function hardest(solved: SolvedRecord[]): MathSummary['hardestFacts'] {
  const typical = median(solved.filter((r) => r.correct).map((r) => r.responseMs)) ?? 0;
  const slow = Math.max(typical * 1.75, 3000);
  return solved
    .filter((r) => !r.correct || r.wrongAnswers.length > 0 || r.responseMs > slow)
    .sort((a, b) => difficulty(b) - difficulty(a))
    .slice(0, 6)
    .map((r) => ({ key: r.key, ms: r.correct ? Math.round(r.responseMs) : null, missed: !r.correct }));
}

function difficulty(r: SolvedRecord): number {
  return (r.correct ? r.responseMs : 1e9) + r.wrongAnswers.length * 5000;
}

export function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return Math.round(s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
