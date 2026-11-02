import type { CSSProperties } from 'react';
import type { InputDevice } from '../../core/input/types';
import { cellLabel, H, W } from './board';
import type { DuelState } from './duel';

/**
 * The maze. Your path is cyan, Glitch's is pink; each square shows the number
 * carried after it. While you're spending a piece, the squares you can use
 * glow (with the number you'd get), and the aimed one has a cursor.
 */
export function BoardView({
  state,
  hints,
  device,
  onTap,
}: {
  state: DuelState;
  /** Mark which build squares still lead to the gate. */
  hints: boolean;
  device: InputDevice;
  onTap: (cell: number, device: InputDevice) => void;
}) {
  const { board, you, rival, stones } = state;
  const acting = state.phase === 'playing' && state.stage === 'action';
  const build = new Map(acting ? state.options.build.map((o) => [o.cell, o]) : []);
  const block = new Set(acting ? state.options.block.map((o) => o.cell) : []);
  const youHead = you.path[you.path.length - 1];
  const rivalHead = rival.path[rival.path.length - 1];
  const fresh = new Map(state.effects.filter((e) => e.cell !== null && state.time - e.at < 700).map((e) => [e.cell!, e]));

  return (
    <div
      className={`dd-board ${acting ? `is-acting is-${state.mode}` : ''}`}
      style={{ '--w': W, '--h': H } as CSSProperties}
      role="grid"
      aria-label={`Maze. Target ${board.target}.`}
    >
      {board.cells.map((cell, i) => {
        const yi = you.path.indexOf(i);
        const ri = rival.path.indexOf(i);
        const stone = stones.get(i);
        const b = build.get(i);
        const canBlock = block.has(i);
        const e = fresh.get(i);
        const cls = [
          'dd-cell',
          `dd-cell--${cell.kind}`,
          cell.kind === 'op' ? `dd-op--${cell.op === '-' ? 'minus' : cell.op === '+' ? 'plus' : cell.op === '×' ? 'times' : 'div'}` : '',
          yi >= 0 ? 'is-you' : '',
          ri >= 0 ? 'is-rival' : '',
          i === youHead ? 'is-you-head' : '',
          i === rivalHead ? 'is-rival-head' : '',
          stone ? `is-stone is-stone-${stone}` : '',
          b ? `can-build ${hints ? (b.good ? 'is-good' : 'is-dead') : ''} ${b.wins ? 'is-win' : ''}` : '',
          canBlock ? 'can-block' : '',
          acting && state.aim === i ? 'is-aim' : '',
          e ? `fx-${e.kind}` : '',
        ].join(' ');
        const value = yi >= 0 ? you.values[yi] : ri >= 0 ? rival.values[ri] : null;
        const tappable = acting && (b || canBlock);
        return (
          <button
            key={i}
            type="button"
            className={cls}
            tabIndex={-1}
            disabled={!tappable}
            onPointerDown={(ev) => {
              if (!tappable) return;
              ev.preventDefault();
              onTap(i, ev.pointerType === 'touch' ? 'touch' : ev.pointerType === 'pen' ? 'pen' : 'mouse');
            }}
            aria-label={cellAria(cell.kind, cellLabel(cell), value)}
            data-cell={i}
          >
            {cell.kind === 'gate' && (
              <span className="dd-gate">
                <span className="dd-gate__star">★</span>
                <span className="dd-gate__target">{board.target}</span>
              </span>
            )}
            {cell.kind === 'op' && <span className="dd-cell__op">{cellLabel(cell)}</span>}
            {stone && <span className="dd-stone" aria-hidden />}
            {value !== null && <span className="dd-cell__value">{value}</span>}
            {b && !b.wins && <span className="dd-cell__preview">→{b.value}</span>}
            {acting && state.aim === i && <span className="dd-cursor" aria-hidden>{device === 'gamepad' ? 'A' : device === 'keyboard' ? '⏎' : ''}</span>}
          </button>
        );
      })}
    </div>
  );
}

function cellAria(kind: string, op: string, value: number | null): string {
  const base = kind === 'rock' ? 'wall' : kind === 'gate' ? 'gate' : kind === 'op' ? op : 'empty';
  return value === null ? base : `${base}, path ${value}`;
}
