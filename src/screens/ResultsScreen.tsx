import type { GameResult } from '../core/modules/types';
import { Screen } from '../core/ui/Screen';

export function ResultsScreen({
  result,
  onAgain,
  onDone,
}: {
  result: GameResult;
  onAgain: () => void;
  onDone: () => void;
}) {
  const title =
    result.reason === 'completed' ? 'All done! 🎉' : result.reason === 'gameover' ? 'Good fight! 💪' : 'Nice practice!';
  const hardest = (result.summary.hardestFacts ?? []) as { key: string; ms: number | null; missed: boolean }[];

  return (
    <Screen title={title} onBack={onDone}>
      <div className="stat-grid">
        {result.highlights.map((h) => (
          <div key={h.label} className="stat">
            <span className="stat__value">{h.value}</span>
            <span className="stat__label">{h.label}</span>
          </div>
        ))}
      </div>

      {hardest.length > 0 && (
        <section>
          <h2 className="section-title">Practise these</h2>
          <div className="chip-row">
            {hardest.map((f, i) => (
              <span key={`${f.key}-${i}`} className={`chip ${f.missed ? 'chip--missed' : ''}`}>
                {f.key.replace(/([+\-×÷])/, ' $1 ')}
                {f.ms !== null && <small> {(f.ms / 1000).toFixed(1)}s</small>}
              </span>
            ))}
          </div>
        </section>
      )}

      <div className="row row--center">
        <button type="button" className="btn btn--primary btn--big" data-focusable onClick={onAgain}>
          ▶ Play again
        </button>
        <button type="button" className="btn btn--big" data-focusable onClick={onDone}>
          Done
        </button>
      </div>
    </Screen>
  );
}
