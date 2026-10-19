import { useEffect, useRef } from 'react';
import { useControlScheme, useMenuNavigation } from '../../core/input/hooks';
import { baseScheme } from '../../core/input/types';
import { CreatureArt } from './Creature';
import type { Creature } from './creatures';

/**
 * Story moment after a boss round: the purified spirit offers to join.
 * Works with controller/keyboard (menu navigation) and touch.
 */
export function BefriendOverlay({
  creature,
  currentCompanion,
  onChoose,
}: {
  creature: Creature;
  currentCompanion: Creature | null;
  onChoose: (accept: boolean) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useControlScheme(baseScheme);
  useMenuNavigation(ref, { onBack: () => onChoose(false) });
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[data-focusable]')?.focus();
  }, []);

  const swapping = currentCompanion && currentCompanion.id !== creature.id;
  const already = currentCompanion?.id === creature.id;

  return (
    <div className="mm-befriend" ref={ref} role="dialog" aria-label={`${creature.name} wants to join you`}>
      <div className="mm-befriend__burst" aria-hidden />
      <div className="mm-befriend__card">
        <CreatureArt creature={creature} form={4} mood="cheer" className="mm-befriend__art" />
        <div className="mm-befriend__text">
          <span className="mm-befriend__kicker">Spirit purified</span>
          <h2>
            {creature.name} <small>the {creature.epithet}</small>
          </h2>
          <p className="mm-befriend__quote">{creature.befriendLine}</p>
          <ul className="mm-befriend__traits">
            {creature.personality.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <div className="mm-befriend__actions">
            {!already && (
              <button type="button" className="btn btn--primary btn--big" data-focusable onClick={() => onChoose(true)}>
                ♥ {swapping ? `Swap ${currentCompanion.name} for ${creature.name}` : `Befriend ${creature.name}`}
              </button>
            )}
            <button type="button" className="btn btn--big" data-focusable onClick={() => onChoose(false)}>
              {already ? 'Keep going' : 'Not now'}
            </button>
          </div>
          <p className="mm-befriend__note">
            {already
              ? `${creature.name} is already by your side.`
              : `${creature.name}'s story is now in your Spirit Journal. You can choose companions there any time.`}
          </p>
        </div>
      </div>
    </div>
  );
}
