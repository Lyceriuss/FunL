import { levelAt, DEFAULT_LEVELS } from '../../core/math/levels';
import { forgeTierFor } from './engine';
import type { PanelProps } from '../../core/modules/types';
import { PathMap, type PathNode, type PathRegion } from '../../core/ui/PathMap';
import { CreatureArt } from './Creature';
import type { MathOptions } from './options';
import { adventureCleared, isPurified, type SpiritProgress } from './spirits';
import { useSpiritProgress } from './useSpiritProgress';
import { ENDLESS_LEVEL, MAP_LEVELS, ROUNDS_PER_WORLD, WORLD_COUNT, currentLevel, levelState, mapLabel, roundOf, worldOf, worldSpirit } from './worldMap';
import { FORGE_TIERS, type ForgeTier } from '../../core/math/forge';

/**
 * Adventure mode's world map: one row per world (its spirit, 4 rounds and a
 * boss), then Endless. Shows where the player is; pick a node to play from there.
 */
export function AdventureMap({ profileId, onStart }: PanelProps<MathOptions>) {
  const { progress } = useSpiritProgress(profileId);
  if (!progress) return <div className="pmap-placeholder" />;

  const regions: PathRegion[] = Array.from({ length: WORLD_COUNT }, (_, w) => ({
    id: `world-${w + 1}`,
    title: <WorldTitle world={w} progress={progress} />,
    nodes: Array.from({ length: ROUNDS_PER_WORLD }, (_, r) => {
      const level = w * ROUNDS_PER_WORLD + r + 1;
      const boss = roundOf(level) === ROUNDS_PER_WORLD;
      return {
        id: String(level),
        label: boss ? '👑' : mapLabel(level),
        state: levelState(progress, level),
        big: boss || undefined,
        title: `World ${mapLabel(level)}, ${levelAt(DEFAULT_LEVELS, level).name}${boss ? ', boss' : ''}`,
      } satisfies PathNode;
    }),
  }));
  regions.push({
    id: 'endless',
    title: (
      <span>
        <strong>∞ Endless</strong> · it keeps getting faster
      </span>
    ),
    nodes: [{ id: String(ENDLESS_LEVEL), label: '∞', state: levelState(progress, ENDLESS_LEVEL), big: true, title: 'Endless' }],
  });

  return (
    <section>
      <h2 className="section-title">World map</h2>
      <PathMap
        regions={regions}
        columns={ROUNDS_PER_WORLD}
        initialId={String(currentLevel(progress))}
        details={(node) => <LevelDetails level={Number(node.id)} state={node.state} progress={progress} />}
        onPlay={(node) => onStart({ mode: 'adventure', startLevel: Number(node.id) })}
      />
    </section>
  );
}

function WorldTitle({ world, progress }: { world: number; progress: SpiritProgress }) {
  const spirit = worldSpirit(world);
  const rec = progress.spirits[spirit.id];
  const purified = isPurified(progress, spirit.id);
  return (
    <span className="mm-world">
      {rec?.encountered ? (
        <CreatureArt creature={spirit} form={purified ? 4 : rec.bestForm} lite className="mm-world__art" />
      ) : (
        <CreatureArt creature={spirit} form={0} silhouette lite className="mm-world__art" />
      )}
      <span>
        <strong>World {world + 1}</strong> · {rec?.encountered ? spirit.name : '???'}
        <br />
        <small>{purified ? '✨ Purified' : rec?.encountered ? 'Corrupted by the Static' : 'Not met yet'}</small>
      </span>
    </span>
  );
}

function LevelDetails({ level, state, progress }: { level: number; state: PathNode['state']; progress: SpiritProgress }) {
  const config = levelAt(DEFAULT_LEVELS, level);
  const lanes = config.lanes ?? 1;
  if (level >= ENDLESS_LEVEL) {
    const furthest = adventureCleared(progress);
    return (
      <>
        <h3>∞ Endless</h3>
        <p>Every topic mixed, faster and faster, with more equations at once. The spirits come back for rematches.</p>
        <p className="muted">
          {state === 'locked' ? `🔒 Clear World ${WORLD_COUNT} to open Endless.` : furthest > MAP_LEVELS ? `Furthest so far: ${mapLabel(furthest)}` : 'How far can you get?'}
        </p>
      </>
    );
  }
  const world = worldOf(level);
  const round = roundOf(level);
  const spirit = worldSpirit(world);
  const met = !!progress.spirits[spirit.id]?.encountered;
  const boss = round === ROUNDS_PER_WORLD;
  const tier = forgeTierFor(level) as ForgeTier;
  return (
    <>
      <h3>
        {mapLabel(level)} · {config.name}
      </h3>
      <p>
        {boss
          ? `Boss: break ${met ? spirit.name : 'the spirit'}'s last shard by forging seals (${FORGE_TIERS[tier].label.toLowerCase()}).`
          : `${met ? spirit.forms[round - 1].title : '???'} · round ${round} of ${ROUNDS_PER_WORLD}`}
      </p>
      <p className="muted">
        {lanes === 1 ? '1 equation at a time' : `Up to ${lanes} equations at once`} ·{' '}
        {state === 'done'
          ? '✓ Cleared. Play it again any time.'
          : state === 'next'
            ? 'You are here.'
            : state === 'open'
              ? 'A world gate: start here to skip ahead.'
              : `🔒 Clear ${mapLabel(level - 1)} first.`}
      </p>
    </>
  );
}
