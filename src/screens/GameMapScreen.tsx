import { useState } from 'react';
import architecture from '../../docs/ARCHITECTURE.md?raw';
import forge from '../../docs/FORGE.md?raw';
import mentalMath from '../../docs/MENTAL-MATH.md?raw';
import mathMonster from '../../docs/modules/math-monster.md?raw';
import mazeDuel from '../../docs/modules/maze-duel.md?raw';
import { Screen } from '../core/ui/Screen';
import { diagramsIn, kindLabel, type Diagram } from '../core/ui/uml/diagrams';
import { UmlGraph } from '../core/ui/uml/UmlGraph';

/** All diagrams in the docs, grouped by doc (the docs are the source of truth). */
const DIAGRAMS: Diagram[] = [
  ...diagramsIn(architecture, 'Architecture'),
  ...diagramsIn(mathMonster, 'Math Monster'),
  ...diagramsIn(forge, 'Forge'),
  ...diagramsIn(mazeDuel, 'Maze Duel'),
  ...diagramsIn(mentalMath, 'Mental maths'),
];
const DOCS = [...new Set(DIAGRAMS.map((d) => d.doc))];
const ZOOMS = [1, 1.5, 2, 3];

/**
 * Game map: the structure of the game as UML / flow diagrams, drawn live from
 * the Markdown docs. Controller: D-pad between the chips and buttons, A picks,
 * B goes back.
 */
export function GameMapScreen({ onBack }: { onBack: () => void }) {
  const [current, setCurrent] = useState(DIAGRAMS[0]?.id ?? '');
  const [zoom, setZoom] = useState(0);
  const d = DIAGRAMS.find((x) => x.id === current) ?? DIAGRAMS[0];

  return (
    <Screen title="🗺️ Game map" onBack={onBack}>
      <p className="muted map-intro">How the game is put together: what you can play, what unlocks what, and how the code is organised. These are the same diagrams as in the project docs.</p>
      <div className="map-picker">
        {DOCS.map((doc) => (
          <div key={doc} className="map-group" role="group" aria-label={doc}>
            <span className="map-group__name">{doc}</span>
            {DIAGRAMS.filter((x) => x.doc === doc).map((x) => (
              <button
                key={x.id}
                type="button"
                className={`chip ${x.id === d?.id ? 'is-current' : ''}`}
                data-focusable
                aria-pressed={x.id === d?.id}
                onClick={() => {
                  setCurrent(x.id);
                  setZoom(0);
                }}
              >
                {x.title}
              </button>
            ))}
          </div>
        ))}
      </div>
      {d && (
        <section className="map-view">
          <div className="map-view__bar">
            <h2>
              {d.title} <small>{kindLabel(d.kind)}</small>
            </h2>
            <div className="map-zoom" role="group" aria-label="Zoom">
              <button type="button" className="btn btn--ghost" data-focusable disabled={zoom === 0} onClick={() => setZoom((z) => Math.max(0, z - 1))} aria-label="Zoom out">
                −
              </button>
              <span>{Math.round(ZOOMS[zoom] * 100)}%</span>
              <button type="button" className="btn btn--ghost" data-focusable disabled={zoom === ZOOMS.length - 1} onClick={() => setZoom((z) => Math.min(ZOOMS.length - 1, z + 1))} aria-label="Zoom in">
                ＋
              </button>
            </div>
          </div>
          <UmlGraph key={d.id} source={d.source} title={d.title} zoom={ZOOMS[zoom]} />
        </section>
      )}
    </Screen>
  );
}
