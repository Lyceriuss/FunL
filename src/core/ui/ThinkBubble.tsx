import type { Reasoning, Step } from '../mental-math';
import './think.css';

/**
 * A thinker's thought bubble (companion, rival): the problem, the strategy it picked, its
 * reasoning step by step, and finally its answer. When it's wrong, the step
 * where it slipped is highlighted and it says what went wrong.
 */
export function ThinkBubble({
  question,
  reasoning: r,
  answerText,
  steps,
  outcome,
  className = '',
}: {
  /** The problem as shown, e.g. "7 + 8". */
  question: string;
  reasoning: Pick<Reasoning, 'strategyLabel' | 'steps' | 'answer' | 'slip'>;
  /** The answer line (default "<question> = <answer>"). */
  answerText?: string;
  /** Steps revealed so far (all of them once answered). */
  steps: Step[];
  /** Set once it has answered (unsure = ran out of time). */
  outcome?: 'right' | 'wrong' | 'unsure';
  className?: string;
}) {
  const shown = steps.slice(-4);
  const hidden = steps.length - shown.length;
  return (
    <div className={`think-bubble ${outcome ? `is-${outcome}` : 'is-thinking'} ${className}`} aria-live="polite">
      <div className="think-bubble__head">
        <span className="think-bubble__q">{question}</span>
        <span className="think-bubble__strategy">💡 {r.strategyLabel}</span>
      </div>
      <ol className="think-bubble__steps">
        {hidden > 0 && <li className="think-bubble__more">…</li>}
        {shown.map((s, i) => (
          <li
            key={hidden + i}
            className={[
              'think-bubble__step',
              `think-bubble__step--${s.kind}`,
              outcome === 'wrong' && s.slip ? 'is-slip' : '',
              !outcome && i === shown.length - 1 ? 'is-new' : '',
            ].join(' ')}
          >
            {s.say}
            {s.note !== undefined && <span className="think-bubble__note" title="written down">📝</span>}
          </li>
        ))}
        {!outcome && (
          <li className="think-bubble__step pr-dots" aria-label="thinking">
            <i />
            <i />
            <i />
          </li>
        )}
      </ol>
      {outcome && (
        <div className="think-bubble__answer">
          {outcome === 'unsure' ? (
            <span>…out of time!</span>
          ) : (
            <span>
              {answerText ?? `${question} = ${r.answer}`} {outcome === 'right' ? '✓' : '✗'}
            </span>
          )}
        </div>
      )}
      {outcome === 'wrong' && r.slip && <div className="think-bubble__oops">Oops: {r.slip.label}</div>}
    </div>
  );
}
