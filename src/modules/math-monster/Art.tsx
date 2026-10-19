import { useId } from 'react';

/**
 * The player's hero, in a cel-shaded anime style. Creatures are drawn
 * procedurally in Creature.tsx.
 */

export function Hero({
  hurt,
  attacking,
  pose = 'battle',
  className = '',
}: {
  hurt: boolean;
  attacking: boolean;
  /** 'class': seated at a desk in practice mode, no sword. */
  pose?: 'battle' | 'class';
  className?: string;
}) {
  const id = useId();
  return (
    <svg
      className={['mm-hero', hurt ? 'mm-hero--hurt' : '', attacking ? 'mm-hero--attack' : '', className].join(' ')}
      viewBox="0 0 170 220"
      aria-hidden
    >
      <defs>
        <radialGradient id={`${id}aura`} cx="50%" cy="55%" r="50%">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}blade`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#e0f2fe" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
        <filter id={`${id}glow`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <ellipse className="mm-hero__aura" cx="82" cy="120" rx="80" ry="100" fill={`url(#${id}aura)`} />

      {/* scarf tail, streaming behind */}
      <path
        className="mm-hero__scarf"
        d="M70 84 C50 80 28 72 4 84 C22 88 32 92 44 92 C32 100 20 106 6 118 C32 112 52 102 72 94 Z"
        fill="#e11d48"
      />

      {/* legs + boots */}
      <path d="M64 156 L56 204 L70 206 L78 160 Z" fill="#0f0d24" />
      <path d="M86 158 L98 202 L112 200 L96 156 Z" fill="#1a1838" />
      <path d="M52 202 L72 202 L74 212 L48 212 Z" fill="#0b0a1a" />
      <path d="M96 198 L116 196 L120 206 L96 208 Z" fill="#0b0a1a" />

      {/* coat */}
      <path d="M58 92 Q82 82 106 92 L114 166 Q98 178 82 170 Q66 178 50 168 Z" fill="#1e1b4b" />
      <path d="M82 88 Q96 86 106 92 L114 166 Q98 178 84 170 Z" fill="#13113a" />
      <path d="M82 92 L84 170" stroke="#22d3ee" strokeWidth="2" />
      <path d="M58 92 L50 168" stroke="#22d3ee" strokeWidth="1.2" opacity="0.6" />
      <rect x="56" y="128" width="54" height="6" rx="2" fill="#0b0a1a" />
      <rect x="78" y="127" width="9" height="8" rx="1.5" fill="#fbbf24" />

      {/* scarf wrap */}
      <path d="M64 82 Q84 94 104 82 L102 96 Q84 104 66 96 Z" fill="#f43f5e" />
      <path d="M84 92 Q94 92 103 86 L102 96 Q92 100 84 99 Z" fill="#be123c" />

      {pose === 'battle' && (
        <>
          {/* sword arm */}
          <g className="mm-hero__arm">
            <path d="M98 96 Q120 102 128 116 L120 122 Q110 112 96 108 Z" fill="#1e1b4b" />
            <circle cx="126" cy="119" r="5.5" fill="#fde2cf" />
            <path
              className="mm-hero__blade"
              d="M127 114 L164 36 L169 40 L132 120 Z"
              fill={`url(#${id}blade)`}
              filter={`url(#${id}glow)`}
            />
            <rect x="118" y="113" width="18" height="4" rx="1.5" fill="#fbbf24" transform="rotate(-64 127 115)" />
          </g>

        </>
      )}

      {/* head */}
      <path d="M68 46 Q68 30 85 28 Q102 30 104 48 Q104 64 92 74 Q85 79 79 74 Q68 66 68 46 Z" fill="#fde2cf" />
      <path d="M68 46 Q68 34 78 30 Q72 46 76 72 Q68 64 68 46 Z" fill="#f2c4a8" />
      {/* eyes */}
      <path d="M88 52 Q95 47 101 52 L100 61 Q94 63 89 59 Z" fill="white" />
      <ellipse cx="96" cy="56" rx="3.2" ry="4.8" fill="#0891b2" />
      <ellipse cx="96.5" cy="57" rx="1.6" ry="2.6" fill="#082f49" />
      <circle cx="97.5" cy="54" r="1.2" fill="white" />
      <path d="M74 53 Q78 50 82 53 L82 60 Q78 61 74 58 Z" fill="white" />
      <ellipse cx="79" cy="56.5" rx="2.4" ry="4" fill="#0891b2" />
      <path d="M86 46 L102 43" stroke="#1e1b4b" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M74 48.5 L81 48" stroke="#1e1b4b" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M88 68 L94 67" stroke="#9a4a3a" strokeWidth="1.6" strokeLinecap="round" />

      {/* spiky hair */}
      <path
        d="M62 54 L54 40 L64 41 L56 24 L72 31 L72 12 L85 26 L94 8 L98 27 L114 18 L106 34 L120 36 L106 44 L104 40 Q94 32 84 36 Q74 36 70 46 L66 60 Z"
        fill="#1e1b4b"
      />
      <path d="M72 14 L82 28 L77 21 Z M94 10 L96 26 L93 18 Z M108 22 L102 32 L106 26 Z" fill="#6366f1" />
    </svg>
  );
}
