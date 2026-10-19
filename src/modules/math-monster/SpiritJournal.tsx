import { useState } from 'react';
import { CreatureArt } from './Creature';
import { CREATURES, type Creature } from './creatures';
import { MASTERY_MAX } from './companion';
import { isPurified, masteryOf, setCompanion, type SpiritProgress } from './spirits';

/**
 * Spirit Journal: every spirit, how far it has been purified, its story once
 * freed, its maths mastery, and companion choice. Presentational: MathHub
 * owns loading/saving.
 */
export function SpiritJournal({
  progress,
  onChange,
}: {
  progress: SpiritProgress;
  onChange: (next: SpiritProgress) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const freed = CREATURES.filter((c) => isPurified(progress, c.id)).length;
  const selected = CREATURES.find((c) => c.id === open);

  return (
    <section>
      <h2 className="section-title">
        Spirit Journal · {freed}/{CREATURES.length} freed
      </h2>
      <div className="journal-grid">
        {CREATURES.map((c) => (
          <JournalCard
            key={c.id}
            creature={c}
            progress={progress}
            selected={open === c.id}
            onOpen={() => setOpen(open === c.id ? null : c.id)}
          />
        ))}
      </div>
      {selected && isPurified(progress, selected.id) && (
        <div className="panel journal-story">
          <h3>
            {selected.name} <small className="muted">the {selected.epithet} · {selected.element}</small>
          </h3>
          {selected.story.map((para, i) => (
            <p key={i}>{para}</p>
          ))}
          <p className="muted">
            {selected.personality.join(' · ')} · Maths {masteryOf(progress, selected.id)}/{MASTERY_MAX}
          </p>
          <div className="row">
            {progress.companion === selected.id ? (
              <button type="button" className="btn" data-focusable onClick={() => onChange(setCompanion(progress, null))}>
                Travel alone
              </button>
            ) : (
              <button
                type="button"
                className="btn btn--primary"
                data-focusable
                onClick={() => onChange(setCompanion(progress, selected.id))}
              >
                ♥ Make {selected.name} my companion
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function JournalCard({
  creature,
  progress,
  selected,
  onOpen,
}: {
  creature: Creature;
  progress: SpiritProgress;
  selected: boolean;
  onOpen: () => void;
}) {
  const rec = progress.spirits[creature.id];
  const purified = isPurified(progress, creature.id);
  const companion = progress.companion === creature.id;
  const title = purified ? creature.name : rec?.encountered ? creature.forms[0].title : '???';
  const sub = purified
    ? `${creature.epithet}${companion ? ' · companion ♥' : ''}`
    : rec?.encountered
      ? `Reached form ${rec.bestForm + 1} of 5`
      : 'Not yet met';

  return (
    <button
      type="button"
      className={`card journal-card ${selected ? 'is-open' : ''} ${companion ? 'is-companion' : ''}`}
      data-focusable
      onClick={onOpen}
      disabled={!purified}
      aria-expanded={selected}
    >
      <CreatureArt
        creature={creature}
        form={purified ? 4 : (rec?.bestForm ?? 0)}
        silhouette={!rec?.encountered}
        lite
        className="journal-card__art"
      />
      <span className="card__title">{title}</span>
      <span className="card__desc">{sub}</span>
    </button>
  );
}
