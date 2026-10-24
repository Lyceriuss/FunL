import { Hero } from '../modules/math-monster/Art';
import { CREATURES } from '../modules/math-monster/creatures';
import { CreatureArt } from '../modules/math-monster/Creature';

/**
 * Dev-only art gallery: every creature in every form. Open the app with
 * `?gallery` (dev server only). Useful when tweaking Creature.tsx.
 */
export function Gallery() {
  const forms = ['0 Corrupted', '1 Cracking', '2 Wavering', '3 Softened', '4 Boss (shard)', '4 Purified'];
  return (
    <div style={{ padding: 16, background: '#0b0820', minHeight: '100dvh', color: 'white', fontFamily: 'var(--font)' }}>
      <h1 style={{ margin: '0 0 12px' }}>Creature gallery</h1>
      <div style={{ display: 'flex', gap: 24, alignItems: 'end', marginBottom: 16 }}>
        <div style={{ width: 170 }}><Hero hurt={false} attacking={false} /><div>Hero · battle</div></div>
        <div style={{ width: 170 }}><Hero hurt={false} attacking={false} pose="class" /><div>Hero · class</div></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `140px repeat(${forms.length}, 1fr)`, gap: 8, alignItems: 'center' }}>
        <span />
        {forms.map((f) => (
          <strong key={f} style={{ fontSize: 13, textAlign: 'center' }}>
            {f}
          </strong>
        ))}
        {CREATURES.map((c) => (
          <Row key={c.id} id={c.id} />
        ))}
      </div>
    </div>
  );
}

function Row({ id }: { id: string }) {
  const c = CREATURES.find((x) => x.id === id)!;
  return (
    <>
      <div>
        <strong>{c.name}</strong>
        <div style={{ fontSize: 12, opacity: 0.7 }}>{c.forms[0].title}</div>
      </div>
      {[0, 1, 2, 3].map((f) => (
        <CreatureArt key={f} creature={c} form={f} />
      ))}
      <CreatureArt creature={c} form={4} shard />
      <CreatureArt creature={c} form={4} />
    </>
  );
}
