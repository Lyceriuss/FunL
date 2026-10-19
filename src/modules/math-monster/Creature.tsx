import { useId, type ReactNode } from 'react';
import { hsl, lerpHsl, type Creature, type Hsl } from './creatures';

/**
 * Procedural creature art. One `form` (0–4) drives every feature from
 * menacing to cute: body shape, eyes, mouth, claws → paws, colours, aura
 * and species parts (ears, wings, frills…). `shard` adds the boss-round
 * Static crystal.
 *
 * View box is 240×260; the creature stands on y≈245.
 */

export type CreatureMood = 'idle' | 'hurt' | 'attack' | 'defeated' | 'laugh' | 'cheer' | 'sad' | 'think';

interface Props {
  creature: Creature;
  form: number;
  shard?: boolean;
  mood?: CreatureMood;
  /** Render as a dark silhouette (unknown spirit in the journal). */
  silhouette?: boolean;
  /**
   * Cheap static rendering for menus/collections: no blur filters or auras.
   * SVG filters are expensive to paint; several animated ones on one screen
   * can stall frames long enough to miss controller presses.
   */
  lite?: boolean;
  className?: string;
}

export function CreatureArt({ creature, form, shard = false, mood = 'idle', silhouette = false, lite = false, className = '' }: Props) {
  const id = useId();
  /** Glow filter reference, or nothing in lite mode. */
  const fx = lite ? undefined : `url(#${id}glow)`;
  const f = Math.max(0, Math.min(4, Math.round(form)));
  const t = f / 4;
  const pal = silhouette ? SILHOUETTE : palette(creature, t);
  const elder = creature.build === 'elder';
  const g = geometry(t, elder);

  return (
    <svg
      className={`mm-creature mm-creature--${mood} mm-creature--f${f} ${silhouette ? 'is-silhouette' : ''} ${lite ? 'is-lite' : ''} ${className}`}
      viewBox="0 0 240 260"
      aria-hidden
    >
      <defs>
        <radialGradient id={`${id}aura`} cx="50%" cy="58%" r="50%">
          <stop offset="0%" stopColor={pal.glow} stopOpacity={0.5 * (1 - t) + 0.25 * t} />
          <stop offset="100%" stopColor={pal.glow} stopOpacity="0" />
        </radialGradient>
        <filter id={`${id}glow`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* aura */}
      {!lite && <ellipse className="mm-creature__aura" cx="120" cy="150" rx="118" ry="112" fill={`url(#${id}aura)`} />}
      {!lite && t < 1 && <path d={spikyAura(g, 1 - t)} fill={pal.glow} opacity={0.22 * (1 - t)} className="mm-creature__static" />}
      {shard && !lite && <circle cx="120" cy="150" r="112" fill="none" stroke="#4c1d95" strokeWidth="10" strokeDasharray="6 10" opacity="0.6" className="mm-creature__static" />}

      {/* back layer: tails, wings, clouds */}
      {backParts(creature.shape, g, pal, t, f)}

      {/* arms (behind body when corrupted) */}
      {f <= 1 && claws(g, pal)}

      {/* body */}
      <clipPath id={`${id}clip`}>
        <path d={bodyPath(g)} />
      </clipPath>
      <path d={bodyPath(g)} fill={pal.body} />
      <g clipPath={`url(#${id}clip)`}>
        {/* cel shadow (right) + rim light (left) */}
        <ellipse cx={120 + g.rx * 1.05} cy={g.cy + 10} rx={g.rx * 0.75} ry={g.ry * 1.3} fill={pal.shade} opacity="0.6" />
        <ellipse cx={120 - g.rx * 0.55} cy={g.cy - g.ry * 0.55} rx={g.rx * 0.28} ry={g.ry * 0.16} fill="white" opacity={0.08 + 0.25 * t} transform={`rotate(-30 ${120 - g.rx * 0.55} ${g.cy - g.ry * 0.55})`} />
        <ellipse cx="120" cy={g.cy + g.ry * 0.38} rx={g.rx * 0.55} ry={g.ry * 0.45} fill={pal.belly} opacity={0.15 + 0.6 * t} />
      </g>
      <path d={bodyPath(g)} fill="none" stroke={pal.outline} strokeWidth={2.5 + (1 - t)} strokeLinejoin="round" />

      {/* Static veins fade out as the spirit is freed */}
      {f <= 2 && (
        <g stroke={pal.glow} strokeWidth="2" fill="none" opacity={0.9 - f * 0.35} filter={fx}>
          <path d={`M${120 - g.rx * 0.6} ${g.cy + 10} l12 -10 l-4 14 l14 -6`} />
          <path d={`M${120 + g.rx * 0.55} ${g.cy + 24} l-10 -12 l2 16 l-12 -4`} />
          <path d={`M110 ${g.cy + g.ry * 0.55} l8 -12 l4 10`} />
        </g>
      )}

      {/* head parts: ears, antlers, frills, antennae */}
      {headParts(creature.shape, g, pal, t, f, fx)}

      {/* feet + paws */}
      {f >= 2 && (
        <g fill={pal.body} stroke={pal.outline} strokeWidth="2.5">
          <ellipse cx={120 - g.rx * 0.45} cy={g.cy + g.ry - 2} rx="16" ry="10" />
          <ellipse cx={120 + g.rx * 0.45} cy={g.cy + g.ry - 2} rx="16" ry="10" />
        </g>
      )}
      {f >= 2 && (
        <g fill={pal.body} stroke={pal.outline} strokeWidth="2.2">
          <path d={paw(120 - g.rx * 0.42, g.cy + g.ry * 0.42, f === 2)} />
          <path d={paw(120 + g.rx * 0.42, g.cy + g.ry * 0.42, f === 2)} />
        </g>
      )}

      {/* face */}
      <g className="mm-creature__face">
        {eyes(g, pal, f, fx)}
        {f >= 3 && (
          <g fill="#ff7aa8" opacity={f === 4 ? 0.65 : 0.4}>
            <ellipse cx={120 - g.eyeDx - 6} cy={g.eyeY + 24} rx="10" ry="5" />
            <ellipse cx={120 + g.eyeDx + 6} cy={g.eyeY + 24} rx="10" ry="5" />
          </g>
        )}
        {mouth(g, pal, f, fx)}
      </g>

      {g.elder && f >= 2 && (
        <g>
          {/* scarf */}
          <path
            d={`M${120 - g.rx * 0.78} ${g.eyeY + 50} Q120 ${g.eyeY + 66} ${120 + g.rx * 0.8} ${g.eyeY + 50} L${120 + g.rx * 0.76} ${g.eyeY + 61} Q120 ${g.eyeY + 78} ${120 - g.rx * 0.76} ${g.eyeY + 61} Z`}
            fill={pal.accent}
            stroke={pal.outline}
            strokeWidth="2"
          />
          <path d={`M${120 + g.rx * 0.35} ${g.eyeY + 66} l14 28 l12 -6 l-10 -26 Z`} fill={pal.accent} stroke={pal.outline} strokeWidth="2" className="mm-creature__scarf" />
          {f >= 3 && (
            <path
              d={`M126 ${g.eyeY - 40} a11 11 0 1 0 0 20 a8 8 0 1 1 0 -20 Z`}
              fill="#fde68a"
              stroke="#b45309"
              strokeWidth="1"
              filter={fx}
            />
          )}
        </g>
      )}

      {/* Static shard: forehead crystal while corrupted, crown on the boss */}
      {(f < 4 || shard) && shardCrystal(g, f, shard, fx)}

      {/* sparkles for the freed forms */}
      {f >= 3 && (
        <g fill="white" className="mm-creature__sparkles" opacity={f === 4 && !shard ? 1 : 0.5}>
          {sparkle(34, 70, 7)}
          {sparkle(206, 96, 6)}
          {sparkle(196, 196, 5)}
          {sparkle(44, 186, 5)}
        </g>
      )}
    </svg>
  );
}

// ---------- palette & geometry ----------

/** Flat dark palette for unknown spirits: cheaper than a CSS filter. */
const SILHOUETTE: Palette = {
  glow: '#4c1d95',
  body: '#06040d',
  shade: '#06040d',
  belly: '#06040d',
  outline: '#3b2470',
  accent: '#06040d',
  accentDark: '#06040d',
  eye: '#06040d',
};

interface Palette {
  glow: string;
  body: string;
  shade: string;
  belly: string;
  outline: string;
  accent: string;
  accentDark: string;
  eye: string;
}

function palette(c: Creature, t: number): Palette {
  const [gh] = c.colors.corruptGlow;
  const darkBody: Hsl = [gh, 30, 12];
  const k = Math.pow(t, 0.85);
  const body = lerpHsl(darkBody, c.colors.body, k);
  const accent = lerpHsl([gh, 45, 20], c.colors.accent, k);
  const glow = lerpHsl(c.colors.corruptGlow, c.colors.accent, t);
  return {
    glow: hsl(glow),
    body: hsl(body),
    shade: hsl([body[0], body[1], Math.max(4, body[2] - 14)]),
    belly: hsl([body[0], Math.max(20, body[1] - 15), Math.min(96, body[2] + 12)]),
    outline: hsl(lerpHsl(c.colors.corruptGlow, [c.colors.body[0], 45, 32], k)),
    accent: hsl(accent),
    accentDark: hsl([accent[0], accent[1], Math.max(8, accent[2] - 18)]),
    eye: hsl(c.colors.eye),
  };
}

interface Geo {
  /** Older sibling build: taller, slimmer, calmer eyes. */
  elder: boolean;
  cy: number;
  rx: number;
  ry: number;
  top: number;
  eyeY: number;
  eyeDx: number;
  spike: number;
  t: number;
}

function geometry(t: number, elder = false): Geo {
  // Menacing = tall and spiky; cute = round, chubby and low to the ground.
  // An elder sibling stays taller and slimmer even when cute.
  const ry = 92 - 22 * t + (elder ? 12 : 0);
  const cy = 245 - ry - (t > 0.4 ? 6 : 0);
  const rx = 74 + 12 * t - (elder ? 8 : 0);
  return {
    elder,
    cy,
    rx,
    ry,
    top: cy - ry,
    eyeY: cy - ry * 0.32 + 4 * t,
    eyeDx: 26 + 6 * t,
    spike: 24 * Math.pow(1 - t, 1.2),
    t,
  };
}

type Pt = [number, number];

function bodyPoints(g: Geo): Pt[] {
  const n = 2 + 0.35 * g.t; // superellipse exponent: slightly chubbier when cute
  const pts: Pt[] = [];
  const N = 56;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    // Cute forms are pear/mochi shaped: wider at the bottom.
    let x = g.rx * Math.sign(c) * Math.pow(Math.abs(c), 2 / n) * (1 + 0.08 * g.t * s);
    let y = g.ry * Math.sign(s) * Math.pow(Math.abs(s), 2 / n);
    // Tattered, spiky hem while corrupted.
    if (s > 0.3 && i % 4 === 2) {
      x *= 1 + g.spike / g.rx;
      y += g.spike;
    }
    // A few spines on the back.
    if (s < -0.55 && i % 6 === 3) {
      y -= g.spike * 0.7;
    }
    pts.push([120 + x, g.cy + y]);
  }
  return pts;
}

function bodyPath(g: Geo): string {
  const pts = bodyPoints(g);
  return g.t < 0.3 ? polygon(pts) : smooth(pts);
}

function spikyAura(g: Geo, strength: number): string {
  const pts: Pt[] = [];
  const N = 28;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const r = i % 2 === 0 ? 1.18 + 0.25 * strength : 1.05;
    pts.push([120 + Math.cos(a) * g.rx * r, g.cy + Math.sin(a) * g.ry * r]);
  }
  return polygon(pts);
}

// ---------- parts ----------

function claws(g: Geo, p: Palette): ReactNode {
  const l = 120 - g.rx + 4;
  const r = 120 + g.rx - 4;
  const y = g.cy - 10;
  return (
    <g fill={p.body} stroke={p.glow} strokeWidth="1.8" strokeLinejoin="round">
      <path d={`M${l + 10} ${y} Q${l - 30} ${y + 30} ${l - 24} ${y + 70} L${l - 16} ${y + 60} L${l - 14} ${y + 76} L${l - 6} ${y + 62} L${l + 2} ${y + 72} Q${l + 2} ${y + 40} ${l + 20} ${y + 20} Z`} />
      <path d={`M${r - 10} ${y} Q${r + 30} ${y + 30} ${r + 24} ${y + 70} L${r + 16} ${y + 60} L${r + 14} ${y + 76} L${r + 6} ${y + 62} L${r - 2} ${y + 72} Q${r - 2} ${y + 40} ${r - 20} ${y + 20} Z`} />
    </g>
  );
}

function eyes(g: Geo, p: Palette, f: number, fx: string | undefined): ReactNode {
  const L = 120 - g.eyeDx;
  const R = 120 + g.eyeDx;
  const y = g.eyeY;
  if (f <= 1) {
    // Glowing, slanted slits + angry brows.
    const h = 7 + f * 4;
    const w = 20 + f * 2;
    return (
      <g>
        <path d={`M${L - w / 2} ${y - h} L${L + w / 2} ${y + h * 0.4} L${L - w / 2} ${y + h * 0.6} Z`} fill={p.glow} filter={fx} className="mm-creature__eyes" />
        <path d={`M${R + w / 2} ${y - h} L${R - w / 2} ${y + h * 0.4} L${R + w / 2} ${y + h * 0.6} Z`} fill={p.glow} filter={fx} className="mm-creature__eyes" />
        <path d={`M${L - 16} ${y - h - 12} L${L + 14} ${y - h + 2}`} stroke={p.outline} strokeWidth="5" strokeLinecap="round" />
        <path d={`M${R + 16} ${y - h - 12} L${R - 14} ${y - h + 2}`} stroke={p.outline} strokeWidth="5" strokeLinecap="round" />
      </g>
    );
  }
  if (f === 2) {
    // Almond eyes, still glowing, with a slit pupil: uncertain.
    return (
      <g className="mm-creature__eyes">
        {[L, R].map((x, i) => (
          <g key={i} transform={`rotate(${i === 0 ? 12 : -12} ${x} ${y})`}>
            <ellipse cx={x} cy={y} rx="13" ry="10" fill="white" stroke={p.outline} strokeWidth="2" />
            <ellipse cx={x} cy={y} rx="7" ry="9" fill={p.glow} />
            <ellipse cx={x} cy={y} rx="2.2" ry="7" fill="#120a1f" />
          </g>
        ))}
      </g>
    );
  }
  // Big sparkly anime eyes (a little smaller and half-lidded on an elder).
  const rx = (f === 3 ? 14 : 16) - (g.elder ? 2 : 0);
  const ry = (f === 3 ? 16 : 19) - (g.elder ? 4 : 0);
  return (
    <g className="mm-creature__eyes">
      {[L, R].map((x, i) => (
        <g key={i}>
          <ellipse cx={x} cy={y} rx={rx} ry={ry} fill="white" stroke={p.outline} strokeWidth="2.2" />
          <ellipse cx={x} cy={y + 2} rx={rx * 0.72} ry={ry * 0.78} fill={p.eye} />
          <ellipse cx={x} cy={y + 4} rx={rx * 0.38} ry={ry * 0.45} fill="#120a1f" />
          <circle cx={x - rx * 0.32} cy={y - ry * 0.32} r={rx * 0.3} fill="white" />
          <circle cx={x + rx * 0.3} cy={y + ry * 0.3} r={rx * 0.13} fill="white" />
          {g.elder && (
            <>
              {/* upper lid: calm, a bit knowing */}
              <path d={`M${x - rx - 1} ${y - ry * 0.25} Q${x} ${y - ry - 3} ${x + rx + 1} ${y - ry * 0.25} L${x + rx + 1} ${y - ry - 4} L${x - rx - 1} ${y - ry - 4} Z`} fill={p.body} />
              <path d={`M${x - rx - 1} ${y - ry * 0.25} Q${x} ${y - ry - 3} ${x + rx + 1} ${y - ry * 0.25}`} fill="none" stroke={p.outline} strokeWidth="2.6" strokeLinecap="round" />
              <path d={`M${x - rx * 0.8} ${y - ry - 9} L${x + rx * 0.7} ${y - ry - 11}`} stroke={p.outline} strokeWidth="2.4" strokeLinecap="round" />
            </>
          )}
        </g>
      ))}
    </g>
  );
}

function mouth(g: Geo, p: Palette, f: number, fx: string | undefined): ReactNode {
  const y = g.eyeY + (f <= 1 ? 34 : 30);
  if (f <= 1) {
    const w = f === 0 ? 34 : 24;
    const teeth = f === 0 ? 6 : 4;
    let d = `M${120 - w} ${y}`;
    for (let i = 1; i <= teeth * 2; i++) {
      const x = 120 - w + (i * 2 * w) / (teeth * 2);
      d += ` L${x} ${y + (i % 2 ? 10 : 0)}`;
    }
    d += ` Q120 ${y + 26} ${120 - w} ${y} Z`;
    return <path d={d} fill={p.glow} stroke={p.outline} strokeWidth="1.5" opacity="0.95" filter={fx} />;
  }
  if (f === 2) {
    return (
      <g stroke={p.outline} strokeWidth="3" fill="none" strokeLinecap="round">
        <path d={`M${108} ${y} q6 -4 12 0 q6 4 12 0`} />
        <path d={`M${126} ${y + 1} l2 7 l3 -6`} fill="white" strokeWidth="1.5" />
      </g>
    );
  }
  if (f === 3) {
    return (
      <g stroke={p.outline} strokeWidth="3" fill="none" strokeLinecap="round">
        <path d={`M${110} ${y} Q120 ${y + 9} ${130} ${y}`} />
        <path d={`M${124} ${y + 3.5} l2 5 l2.5 -5.5`} fill="white" strokeWidth="1.2" />
      </g>
    );
  }
  // ":3"-style "w" mouth with a tiny open smile.
  return (
    <g stroke={p.outline} strokeWidth="3" fill="none" strokeLinecap="round">
      <path d={`M${109} ${y} q5.5 7 11 0 q5.5 7 11 0`} />
      <path d={`M${116} ${y + 5} q4 6 8 0`} fill="#ff7aa8" strokeWidth="2" />
    </g>
  );
}

function shardCrystal(g: Geo, f: number, boss: boolean, fx: string | undefined): ReactNode {
  const size = boss ? 22 : 20 - f * 4;
  const x = 120;
  const y = boss ? g.top - 26 : g.top + 18;
  return (
    <g className={boss ? 'mm-creature__crown' : ''} filter={fx}>
      <path
        d={`M${x} ${y - size} L${x + size * 0.55} ${y} L${x} ${y + size * 0.7} L${x - size * 0.55} ${y} Z`}
        fill="#2e1065"
        stroke="#c084fc"
        strokeWidth="2"
      />
      <path d={`M${x} ${y - size * 0.7} L${x + size * 0.2} ${y} L${x} ${y + size * 0.3} Z`} fill="#a855f7" opacity="0.8" />
      {boss && (
        <>
          <path d={`M${x - 26} ${y + 6} L${x - 16} ${y - 12} L${x - 10} ${y + 6} Z`} fill="#2e1065" stroke="#c084fc" strokeWidth="1.5" />
          <path d={`M${x + 26} ${y + 6} L${x + 16} ${y - 12} L${x + 10} ${y + 6} Z`} fill="#2e1065" stroke="#c084fc" strokeWidth="1.5" />
        </>
      )}
    </g>
  );
}

function backParts(shape: Creature['shape'], g: Geo, p: Palette, t: number, f: number): ReactNode {
  const s = 1 - t;
  switch (shape) {
    case 'fox': {
      // Kitsune: grows more tails as it is freed.
      const tails = 1 + Math.round(t * 2) + (g.elder ? 1 : 0);
      return (
        <g fill={p.accent} stroke={p.outline} strokeWidth="2.5" strokeLinejoin="round">
          {Array.from({ length: tails }, (_, i) => {
            const a = -30 + i * 28 - (tails - 1) * 8;
            return (
              <g key={i} transform={`rotate(${a} ${120 + g.rx * 0.6} ${g.cy + g.ry * 0.6})`} className="mm-creature__tail">
                {f <= 1 ? (
                  <path d={`M${120 + g.rx * 0.5} ${g.cy + g.ry * 0.6} Q${200} ${g.cy} ${226} ${g.cy - 60} L${212} ${g.cy - 30} L${224} ${g.cy - 20} Q${200} ${g.cy + 30} ${120 + g.rx * 0.6} ${g.cy + g.ry * 0.75} Z`} />
                ) : (
                  <path d={`M${120 + g.rx * 0.5} ${g.cy + g.ry * 0.6} Q${190} ${g.cy + 10} ${214} ${g.cy - 46} Q${236} ${g.cy - 20} ${206} ${g.cy + 20} Q${180} ${g.cy + 50} ${120 + g.rx * 0.6} ${g.cy + g.ry * 0.75} Z`} />
                )}
              </g>
            );
          })}
        </g>
      );
    }
    case 'dragon': {
      const span = 70 * s + 34;
      const top = g.cy - 30 - 30 * s;
      const wing = (dir: 1 | -1) => {
        const bx = 120 + dir * (g.rx * 0.5);
        const tx = 120 + dir * (g.rx * 0.5 + span);
        return f <= 1
          ? `M${bx} ${g.cy - 10} L${tx} ${top} L${tx - dir * 12} ${top + 34} L${tx - dir * 2} ${top + 46} L${tx - dir * 26} ${top + 60} L${tx - dir * 22} ${top + 76} L${bx} ${g.cy + 14} Z`
          : `M${bx} ${g.cy - 6} Q${tx} ${top - 8} ${tx} ${top + 26} Q${tx - dir * 14} ${top + 46} ${bx} ${g.cy + 14} Z`;
      };
      return (
        <g fill={p.accentDark} stroke={p.outline} strokeWidth="2.5" strokeLinejoin="round" className="mm-creature__wings">
          <path d={wing(-1)} />
          <path d={wing(1)} />
          <path d={`M${120 + g.rx * 0.4} ${g.cy + g.ry * 0.7} Q${220} ${g.cy + g.ry} ${224} ${g.cy + 20}`} fill="none" strokeWidth="9" stroke={p.body} />
          <path d={`M${224} ${g.cy + 4} L${236} ${g.cy + 24} L${216} ${g.cy + 26} Z`} fill={p.accent} />
        </g>
      );
    }
    case 'axolotl':
      return (
        <path
          d={`M${120 + g.rx * 0.6} ${g.cy + 20} Q${232} ${g.cy - 10 - 20 * s} ${228} ${g.cy + 40} Q${200} ${g.cy + 60} ${120 + g.rx * 0.5} ${g.cy + 50} Z`}
          fill={p.accent}
          stroke={p.outline}
          strokeWidth="2.5"
          opacity="0.9"
          className="mm-creature__tail"
        />
      );
    case 'storm':
      return (
        <g fill={p.accentDark} opacity={0.85} stroke={p.outline} strokeWidth="2">
          {f <= 1 ? (
            <path d={`M20 ${g.cy + 40} L40 ${g.cy + 10} L56 ${g.cy + 28} L74 ${g.cy - 4} L90 ${g.cy + 30} L150 ${g.cy + 30} L166 ${g.cy - 4} L184 ${g.cy + 28} L200 ${g.cy + 10} L220 ${g.cy + 40} Z`} />
          ) : (
            <g>
              <circle cx="40" cy={g.cy + 50} r={20 + 6 * t} />
              <circle cx="200" cy={g.cy + 50} r={20 + 6 * t} />
              <circle cx="66" cy={g.cy + 66} r="18" />
              <circle cx="174" cy={g.cy + 66} r="18" />
            </g>
          )}
        </g>
      );
    case 'sprout':
      return f >= 3 ? (
        <path d={`M${120 + g.rx * 0.6} ${g.cy + 30} q40 -10 50 -40 q-30 0 -50 40`} fill={p.accent} stroke={p.outline} strokeWidth="2" />
      ) : null;
  }
}

function headParts(shape: Creature['shape'], g: Geo, p: Palette, t: number, f: number, fx: string | undefined): ReactNode {
  const s = 1 - t;
  const top = g.top + 8;
  switch (shape) {
    case 'fox': {
      const h = 48 + 26 * s + (g.elder ? 14 : 0);
      const ear = (dir: 1 | -1) => {
        const bx = 120 + dir * 22;
        const ox = 120 + dir * 62;
        const tipX = 120 + dir * (52 + 10 * s);
        return f <= 1
          ? `M${bx} ${top + 8} L${tipX} ${top - h} L${ox - dir * 4} ${top + 16} L${ox - dir * 14} ${top + 6} Z`
          : `M${bx} ${top + 10} Q${tipX - dir * 6} ${top - h} ${tipX} ${top - h + 6} Q${ox + dir * 4} ${top - h * 0.4} ${ox} ${top + 20} Z`;
      };
      const inner = (dir: 1 | -1) => {
        const tipX = 120 + dir * (50 + 10 * s);
        return `M${120 + dir * 32} ${top + 10} L${tipX - dir * 2} ${top - h + 18} L${120 + dir * 54} ${top + 16} Z`;
      };
      return (
        <g strokeLinejoin="round">
          <g fill={p.body} stroke={p.outline} strokeWidth="2.5">
            <path d={ear(-1)} />
            <path d={ear(1)} />
          </g>
          <g fill={f >= 3 ? '#ffb3d1' : p.glow} opacity={f >= 3 ? 0.9 : 0.6}>
            <path d={inner(-1)} />
            <path d={inner(1)} />
          </g>
        </g>
      );
    }
    case 'sprout': {
      if (f <= 2) {
        // Thorny branches, shrinking.
        const len = 70 * (1 - f * 0.25);
        const branch = (dir: 1 | -1) =>
          `M${120 + dir * 18} ${top + 10} L${120 + dir * (24 + len * 0.4)} ${top - len * 0.6} L${120 + dir * (16 + len * 0.3)} ${top - len * 0.5} L${120 + dir * (34 + len * 0.6)} ${top - len} L${120 + dir * (30 + len * 0.3)} ${top - len * 0.3} L${120 + dir * 30} ${top + 12} Z`;
        return (
          <g fill={p.accentDark} stroke={p.glow} strokeWidth="2" strokeLinejoin="round">
            <path d={branch(-1)} />
            <path d={branch(1)} />
          </g>
        );
      }
      return (
        <g stroke={p.outline} strokeWidth="2.5" strokeLinejoin="round">
          <path d={`M120 ${top + 12} Q118 ${top - 20} 124 ${top - 34}`} fill="none" stroke="#3f7d3a" strokeWidth="5" strokeLinecap="round" />
          <path d={`M122 ${top - 22} Q92 ${top - 50} 80 ${top - 26} Q100 ${top - 14} 122 ${top - 22} Z`} fill={p.accent} />
          <path d={`M124 ${top - 28} Q156 ${top - 58} 166 ${top - 30} Q146 ${top - 18} 124 ${top - 28} Z`} fill={p.accent} />
          {f === 4 && (
            <g transform={`translate(124 ${top - 40})`} className="mm-creature__flower">
              {[0, 72, 144, 216, 288].map((a) => (
                <ellipse key={a} cx="0" cy="-9" rx="6" ry="9" fill="#ffd1e8" transform={`rotate(${a})`} strokeWidth="1.5" />
              ))}
              <circle r="5" fill="#fde047" strokeWidth="1.5" />
            </g>
          )}
        </g>
      );
    }
    case 'dragon': {
      const k = 0.35 + 0.65 * s;
      const horn = (dir: 1 | -1) =>
        f <= 1
          ? `M${120 + dir * 24} ${top + 12} Q${120 + dir * 70 * k} ${top - 10} ${120 + dir * 60 * k} ${top - 60 * k} Q${120 + dir * 46} ${top - 12} ${120 + dir * 40} ${top + 16} Z`
          : `M${120 + dir * 26} ${top + 14} Q${120 + dir * 40} ${top - 24 * k} ${120 + dir * 44} ${top - 18 * k} Q${120 + dir * 48} ${top} ${120 + dir * 40} ${top + 18} Z`;
      return (
        <g fill={f <= 1 ? '#1a0d10' : '#fff1d6'} stroke={f <= 1 ? p.glow : p.outline} strokeWidth="2" strokeLinejoin="round">
          <path d={horn(-1)} />
          <path d={horn(1)} />
        </g>
      );
    }
    case 'axolotl': {
      const len = 34 + 10 * s;
      const stalks = [-28, 0, 28];
      return (
        <g>
          {([-1, 1] as const).map((dir) =>
            stalks.map((a, i) => {
              const bx = 120 + dir * (g.rx - 12);
              const by = g.eyeY - 6 + i * 14;
              const ang = (dir === 1 ? 0 : 180) + dir * a - dir * 18;
              const ex = bx + Math.cos((ang * Math.PI) / 180) * len;
              const ey = by + Math.sin((ang * Math.PI) / 180) * len - 6;
              return f <= 1 ? (
                <path key={`${dir}${i}`} d={`M${bx} ${by - 5} L${ex} ${ey} L${bx} ${by + 5} Z`} fill={p.accentDark} stroke={p.glow} strokeWidth="1.8" />
              ) : (
                <g key={`${dir}${i}`}>
                  <line x1={bx} y1={by} x2={ex} y2={ey} stroke={p.accent} strokeWidth="8" strokeLinecap="round" />
                  <circle cx={ex} cy={ey} r={f >= 3 ? 7 : 5} fill={p.accent} stroke={p.outline} strokeWidth="1.5" />
                </g>
              );
            }),
          )}
        </g>
      );
    }
    case 'storm': {
      const ant = (dir: 1 | -1) =>
        f <= 1
          ? `M${120 + dir * 16} ${top + 10} L${120 + dir * 30} ${top - 26} L${120 + dir * 20} ${top - 26} L${120 + dir * 40} ${top - 66} L${120 + dir * 36} ${top - 34} L${120 + dir * 46} ${top - 34} L${120 + dir * 24} ${top + 12} Z`
          : `M${120 + dir * 16} ${top + 10} Q${120 + dir * 20} ${top - 30} ${120 + dir * 44} ${top - 34} Q${120 + dir * 58} ${top - 46} ${120 + dir * 44} ${top - 52}`;
      return (
        <g>
          <path
            d={ant(-1)}
            fill={f <= 1 ? p.glow : 'none'}
            stroke={f <= 1 ? p.outline : p.outline}
            strokeWidth={f <= 1 ? 1.5 : 4}
            strokeLinecap="round"
            filter={f <= 1 ? fx : undefined}
          />
          <path
            d={ant(1)}
            fill={f <= 1 ? p.glow : 'none'}
            stroke={p.outline}
            strokeWidth={f <= 1 ? 1.5 : 4}
            strokeLinecap="round"
            filter={f <= 1 ? fx : undefined}
          />
          {f >= 2 && (
            <g fill={p.accent} stroke={p.outline} strokeWidth="1.5">
              <path d={star(120 - 44, top - 54, 9)} />
              <path d={star(120 + 44, top - 54, 9)} />
            </g>
          )}
        </g>
      );
    }
  }
}

// ---------- path helpers ----------

/** Small front paw; `clawed` adds two little claw tips (wavering form). */
function paw(x: number, y: number, clawed: boolean): string {
  const d = `M${x - 11} ${y} Q${x - 12} ${y - 14} ${x} ${y - 14} Q${x + 12} ${y - 14} ${x + 11} ${y} Q${x} ${y + 6} ${x - 11} ${y} Z`;
  return clawed ? `${d} M${x - 5} ${y + 2} l1 5 l2 -5 M${x + 3} ${y + 2} l1 5 l2 -5` : d;
}

function polygon(pts: Pt[]): string {
  return `M${pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L')} Z`;
}

/** Closed Catmull-Rom spline through the points, as cubic Béziers. */
function smooth(pts: Pt[]): string {
  const n = pts.length;
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return `${d} Z`;
}

function star(cx: number, cy: number, r: number): string {
  const pts: Pt[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return polygon(pts);
}

function sparkle(x: number, y: number, r: number): ReactNode {
  return <path key={`${x}-${y}`} d={`M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r} Z`} />;
}
