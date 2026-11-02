import { useRef, useState, type ReactNode } from 'react';
import './pathMap.css';

/**
 * A world map of nodes on a winding path, like a classic console world map
 * (layout only, no art). Regions (worlds, stage groups…) are rows; the path
 * snakes from row to row. Moving onto a node (D-pad, Tab, hover, tap) selects
 * it and shows its details; A / Enter on the selected node plays it. A tap on
 * a node only selects it the first time, so touch players can read first.
 */

export type PathNodeState = 'done' | 'next' | 'open' | 'locked';

export interface PathNode {
  id: string;
  /** Short text inside the node, e.g. "1-3". */
  label: string;
  state: PathNodeState;
  /** Bigger node, e.g. a boss. */
  big?: boolean;
  /** Small emoji on the node's corner, e.g. ⚡ for a quick stage. */
  badge?: string;
  /** Spoken name, e.g. "World 1-3, Take away". */
  title: string;
}

export interface PathRegion {
  id: string;
  title: ReactNode;
  nodes: PathNode[];
}

const STATE_TEXT: Record<PathNodeState, string> = { done: 'cleared', next: 'you are here', open: 'open', locked: 'locked' };

export function PathMap({
  regions,
  columns,
  initialId,
  details,
  onPlay,
  playLabel = '▶ Play',
}: {
  regions: PathRegion[];
  /** Nodes per row (the widest region). */
  columns: number;
  /** Node selected (and focused) first: usually where the player is. */
  initialId?: string;
  /** Details for the selected node. */
  details: (node: PathNode) => ReactNode;
  onPlay: (node: PathNode) => void;
  playLabel?: string;
}) {
  const all = regions.flatMap((r) => r.nodes);
  const [selectedId, setSelectedId] = useState(initialId ?? all[0]?.id);
  const selected = all.find((n) => n.id === selectedId) ?? all[0];
  /** Was the node already selected when the pointer went down? (A first tap only selects.) */
  const tapOnSelected = useRef<boolean | null>(null);

  // Lay the regions out as one grid: a header row and a node row per region.
  // Odd regions run right to left, so the path snakes and each region starts
  // in the column where the previous one ended.
  let col = 1;
  let row = 1;
  const items: ReactNode[] = [];
  regions.forEach((region, ri) => {
    const reverse = ri % 2 === 1;
    const cols = region.nodes.map((_, i) => (reverse ? col - i : col + i));
    const startCol = cols[0];
    const turn = ri > 0;
    // Keep the header clear of the turn coming down from the previous row.
    const headerCols = !turn ? [1, columns + 1] : startCol === 1 ? [2, columns + 1] : [1, columns];
    items.push(
      <div key={`${region.id}-h`} className={`pmap__region ${startCol === 1 ? '' : 'is-right'}`} style={{ gridRow: row, gridColumn: `${headerCols[0]} / ${headerCols[1]}` }}>
        {region.title}
      </div>,
    );
    if (turn) items.push(<span key={`${region.id}-t`} className="pmap__turn" aria-hidden style={{ gridRow: row, gridColumn: startCol }} />);
    if (cols.length > 1) {
      const lo = Math.min(...cols);
      const hi = Math.max(...cols);
      const done = region.nodes.filter((n) => n.state === 'done').length;
      items.push(
        <span
          key={`${region.id}-l`}
          className={`pmap__line ${done === region.nodes.length ? 'is-done' : ''}`}
          aria-hidden
          style={{ gridRow: row + 1, gridColumn: `${lo} / ${hi + 1}` }}
        />,
      );
    }
    region.nodes.forEach((node, i) => {
      const isSel = node.id === selected?.id;
      items.push(
        <button
          key={node.id}
          type="button"
          className={['pmap__node', `is-${node.state}`, node.big ? 'is-big' : '', isSel ? 'is-selected' : ''].join(' ')}
          style={{ gridRow: row + 1, gridColumn: cols[i] }}
          aria-label={`${node.title}, ${STATE_TEXT[node.state]}`}
          aria-pressed={isSel}
          data-focusable
          data-autofocus={node.id === (initialId ?? all[0]?.id) || undefined}
          onFocus={() => setSelectedId(node.id)}
          onMouseEnter={() => setSelectedId(node.id)}
          onPointerDown={() => (tapOnSelected.current = isSel)}
          onClick={() => {
            const viaPointer = tapOnSelected.current;
            tapOnSelected.current = null;
            setSelectedId(node.id);
            // Keyboard / controller: the node is already selected by focus, so A plays.
            // Pointer: the first tap selects; a tap on the selected node plays.
            if (node.state !== 'locked' && viaPointer !== false) onPlay(node);
          }}
        >
          {node.state === 'next' && (
            <span className="pmap__you" aria-hidden>
              YOU
            </span>
          )}
          <span className="pmap__label">{node.state === 'locked' ? '🔒' : node.label}</span>
          {node.state === 'done' && (
            <span className="pmap__check" aria-hidden>
              ✓
            </span>
          )}
          {node.badge && node.state !== 'locked' && (
            <span className="pmap__badge" aria-hidden>
              {node.badge}
            </span>
          )}
        </button>,
      );
    });
    col = cols[cols.length - 1];
    row += 2;
  });

  return (
    <div className="pmap">
      <div className="pmap__grid" style={{ gridTemplateColumns: `repeat(${columns}, var(--pmap-col))` }}>
        {items}
      </div>
      {selected && (
        <aside className="pmap__info panel" aria-live="polite">
          {details(selected)}
          {selected.state !== 'locked' && (
            // For touch and mouse; controller and keyboard play with A / Enter on the node itself.
            <button type="button" className="btn btn--primary pmap__play" onClick={() => onPlay(selected)}>
              {playLabel}
            </button>
          )}
        </aside>
      )}
    </div>
  );
}
