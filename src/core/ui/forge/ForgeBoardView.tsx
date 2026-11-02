import { useRef } from 'react';
import { operatorOrder, pieceText, REASON_LABEL, stepText, type Piece } from '../../math/expression';
import { forgePreview, trayOf, type ForgeBoard, type ForgeCheck } from '../../math/forge';
import type { InputDevice } from '../../input/types';
import { useFlip } from '../useFlip';
import './forge.css';

/**
 * A timer shown inside the row being built, where the player is looking.
 * Countdown: `left` = share of time remaining (1 → 0), drawn as a draining bar.
 * Stopwatch: just the time spent so far.
 */
export type ForgeTimer = { kind: 'countdown'; left: number; ms: number } | { kind: 'stopwatch'; ms: number };

export interface ForgeFeedback {
  check: ForgeCheck;
  /** Changes on every check (restarts the animation). */
  key: number;
}

/**
 * A Forge board: the target, the row being built (with the order each sign
 * is worked out in), the tray of pieces, and feedback after a check.
 *
 * Pieces glide between tray and row (FLIP), the held piece rides along the
 * row at the cursor so the others make room, and placing snaps it in.
 * Touch: tap a piece, then tap where it goes (it goes *before* the piece you
 * tap, or at the end); tap a placed piece to move it; tap the tray to put a
 * held piece back.
 */
export function ForgeBoardView({
  board,
  feedback,
  device,
  onTake,
  onDrop,
  onStash,
  onCheck,
  className = '',
  checkLabel = 'Forge',
  timer,
}: {
  board: ForgeBoard;
  feedback: ForgeFeedback | null;
  device: InputDevice;
  onTake: (id: number, dev: InputDevice) => void;
  onDrop: (gap: number, dev: InputDevice) => void;
  onStash: (dev: InputDevice) => void;
  onCheck: (dev: InputDevice) => void;
  className?: string;
  checkLabel?: string;
  timer?: ForgeTimer;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useFlip(ref);
  const { puzzle, row, held, cursor } = board;
  const tray = trayOf(board);
  const preview = forgePreview(board);
  const order = preview ? operatorOrder(preview.steps) : new Map<number, number>();
  const holdingInRow = held !== null && cursor.zone === 'row';
  const pad = device === 'gamepad';
  const keys = device === 'keyboard';
  const status = feedback?.check.status;
  const errorAt = feedback?.check.status === 'invalid' ? feedback.check.error.at : -1;
  const sealed = status === 'right';

  // Row as shown: the held piece rides at the cursor gap.
  type Item = { id: number; held: boolean; rowIndex: number };
  const items: Item[] = row.map((id, i) => ({ id, held: false, rowIndex: i }));
  if (holdingInRow) items.splice(Math.min(cursor.index, items.length), 0, { id: held, held: true, rowIndex: -1 });

  const devOf = (e: React.PointerEvent): InputDevice => (e.pointerType === 'touch' ? 'touch' : e.pointerType === 'pen' ? 'pen' : 'mouse');
  const tapRowPiece = (item: Item, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const dev = devOf(e);
    if (item.held) onDrop(cursor.index, dev);
    else if (held !== null) onDrop(item.rowIndex, dev);
    else onTake(item.id, dev);
  };

  return (
    <div className={`fg-board ${sealed ? 'is-sealed' : ''} ${held !== null ? 'is-holding' : ''} ${className}`} ref={ref}>
      <div className="fg-target" aria-label={`Make ${puzzle.target}`}>
        <span className="fg-target__eq">=</span>
        <span className="fg-target__num" key={puzzle.key + puzzle.target}>
          {puzzle.target}
        </span>
      </div>

      <div
        className={`fg-row ${status === 'wrong' || status === 'invalid' ? 'is-wrong' : ''} ${cursor.zone === 'row' ? 'has-cursor' : ''}`}
        key={`row${feedback?.key ?? 0}`}
        onPointerDown={(e) => {
          // Tap on empty row space: drop at the end.
          if (held !== null) {
            e.preventDefault();
            onDrop(row.length, devOf(e));
          }
        }}
        aria-label="Your calculation"
      >
        {items.length === 0 && <span className="fg-row__empty">{pad ? 'A picks up a piece' : keys ? 'Type a number or sign, or Enter picks up' : 'Tap a piece below'}</span>}
        {items.map((item) => {
          const p = puzzle.pieces[item.id];
          const rowPos = item.rowIndex;
          const n = rowPos >= 0 ? order.get(rowPos) : undefined;
          return (
            <PieceTile
              key={item.id}
              piece={p}
              flip={item.id}
              className={[
                item.held ? 'is-held' : '',
                !holdingInRow && cursor.zone === 'row' && cursor.index === rowPos ? 'is-cursor' : '',
                rowPos === errorAt ? 'is-error' : '',
              ].join(' ')}
              badge={n}
              onPointerDown={(e) => tapRowPiece(item, e)}
            />
          );
        })}
        {timer && <RowTimer timer={timer} />}
        {holdingInRow && <span className="fg-row__hint">{pad ? 'A: place' : keys ? '⏎ place' : 'tap to place'}</span>}
      </div>

      <div className="fg-order" aria-live="polite">
        {preview && preview.steps.length > 0 ? (
          preview.steps.map((s, i) => (
            <span key={i} className={`fg-step fg-step--${s.reason}`}>
              <b>{i + 1}</b> {preview.steps.length > 1 && s.reason !== 'left-to-right' ? <em>{REASON_LABEL[s.reason]}:</em> : null} {stepText(s)}
            </span>
          ))
        ) : (
          <span className="fg-order__idle">{row.length ? '…' : ''}</span>
        )}
        {preview && <span className={`fg-order__total ${preview.value === puzzle.target && preview.whole ? 'is-match' : ''}`}>= {Number.isInteger(preview.value) ? preview.value : preview.value.toFixed(2)}</span>}
      </div>

      <div
        className={`fg-tray ${cursor.zone === 'tray' ? 'has-cursor' : ''}`}
        onPointerDown={(e) => {
          if (held !== null) {
            e.preventDefault();
            onStash(devOf(e));
          }
        }}
        aria-label="Pieces"
      >
        {tray.map((id, i) => (
          <PieceTile
            key={id}
            piece={puzzle.pieces[id]}
            flip={id}
            className={cursor.zone === 'tray' && cursor.index === i ? 'is-cursor' : ''}
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onTake(id, devOf(e));
            }}
          />
        ))}
        {held !== null && !holdingInRow && <PieceTile piece={puzzle.pieces[held]} flip={held} className="is-held" onPointerDown={() => {}} />}
        {tray.length === 0 && held === null && <span className="fg-tray__done">All pieces placed</span>}
      </div>

      <div className="fg-foot">
        <span className={`fg-status ${status ? `is-${status}` : ''}`} key={`st${feedback?.key ?? 0}`}>
          {feedbackText(feedback?.check, puzzle.target)}
        </span>
        <button
          type="button"
          className="fg-check"
          tabIndex={-1}
          onPointerDown={(e) => {
            e.preventDefault();
            onCheck(devOf(e));
          }}
        >
          {pad && <span className="fg-btn fg-btn--y">Y</span>} ✓ {checkLabel}
        </button>
      </div>
      {pad && (
        <div className="fg-help" aria-hidden>
          <span><span className="fg-btn fg-btn--a">A</span> {held !== null ? 'place' : 'pick up'}</span>
          <span><span className="fg-btn fg-btn--x">X</span> {held !== null ? 'put back' : 'take out'}</span>
          <span><span className="fg-btn fg-btn--y">Y</span> check</span>
        </div>
      )}
    </div>
  );
}

function RowTimer({ timer }: { timer: ForgeTimer }) {
  const secs = Math.max(0, Math.ceil(timer.ms / 1000));
  const text = secs >= 60 ? `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}` : `${secs}s`;
  if (timer.kind === 'stopwatch') {
    return (
      <span className="fg-timer fg-timer--stopwatch" aria-label={`${secs} seconds so far`}>
        <span className="fg-timer__label">⏱ {text}</span>
      </span>
    );
  }
  const level = timer.left < 0.2 ? 'is-danger' : timer.left < 0.45 ? 'is-warn' : '';
  return (
    <span className={`fg-timer fg-timer--countdown ${level}`} role="timer" aria-label={`${secs} seconds left`}>
      <span className="fg-timer__label">⏱ {text}</span>
      <span className="fg-timer__track">
        <span className="fg-timer__bar" style={{ width: `${Math.max(0, Math.min(1, timer.left)) * 100}%` }} />
      </span>
    </span>
  );
}

function PieceTile({
  piece,
  flip,
  className,
  badge,
  onPointerDown,
}: {
  piece: Piece;
  flip: number;
  className: string;
  badge?: number;
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  return (
    <span className={`fg-piece fg-piece--${piece.kind} ${className}`} data-flip={flip} data-piece={piece.id} onPointerDown={onPointerDown} role="button">
      {pieceText(piece)}
      {badge !== undefined && <span className="fg-piece__badge">{badge}</span>}
    </span>
  );
}

function feedbackText(check: ForgeCheck | undefined, target: number): string {
  if (!check) return `Use every piece to make ${target}`;
  switch (check.status) {
    case 'incomplete':
      return `Use every piece (${check.left} left)`;
    case 'invalid':
      return check.error.message;
    case 'wrong':
      return check.whole ? `That makes ${check.value}, not ${target}. Look at the order!` : 'That doesn’t come out even. Try another order';
    case 'right':
      return `${check.text} = ${target}!`;
  }
}
