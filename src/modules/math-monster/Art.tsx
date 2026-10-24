import { useId } from 'react';

/**
 * The player's hero: a cel-shaded anime swordswoman with a long ponytail and
 * a red ribbon. Creatures are drawn procedurally in Creature.tsx.
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
  const hair = '#2a1f5c';
  const hairShade = '#1b1442';
  const hairShine = '#7c6fe0';
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

      {/* long ponytail, streaming behind (animated like the scarf) */}
      <path
        className="mm-hero__scarf"
        d="M70 30 C46 30 30 46 22 70 C16 90 18 110 6 128 C24 122 34 108 38 92 C42 106 40 118 32 132 C50 118 54 96 56 78 C60 60 66 46 76 38 Z"
        fill={hair}
      />
      <path d="M66 34 C48 40 36 58 30 80 C36 66 46 52 62 44 Z" fill={hairShine} opacity="0.6" />

      {/* hair behind the shoulders */}
      <path d="M66 44 Q60 80 64 104 L74 100 Q70 76 74 50 Z" fill={hairShade} />
      <path d="M102 46 Q108 76 104 100 L96 98 Q100 74 96 52 Z" fill={hairShade} />

      {/* scarf tail */}
      <path
        className="mm-hero__scarf"
        d="M70 86 C54 84 38 80 20 92 C34 94 42 98 50 98 C40 106 30 112 20 122 C40 118 56 108 72 96 Z"
        fill="#e11d48"
      />

      {/* legs + knee boots */}
      <path d="M68 164 L62 200 L72 202 L78 166 Z" fill="#fde2cf" />
      <path d="M88 166 L96 200 L106 198 L96 164 Z" fill="#f2c4a8" />
      <path d="M60 184 L74 184 L74 204 L54 210 L56 202 Z" fill="#1a1838" />
      <path d="M93 182 L107 180 L110 198 L116 204 L94 206 Z" fill="#13113a" />

      {/* coat with a flared, pleated skirt */}
      <path d="M62 92 Q83 84 104 92 L106 134 L60 134 Z" fill="#1e1b4b" />
      <path d="M83 88 Q96 86 104 92 L106 134 L84 134 Z" fill="#13113a" />
      <path d="M60 132 L106 132 L118 170 Q100 176 83 172 Q66 176 48 170 Z" fill="#1e1b4b" />
      <path d="M83 132 L106 132 L118 170 Q100 176 84 172 Z" fill="#13113a" />
      <path d="M68 134 L60 170 M78 134 L74 172 M90 134 L94 172 M100 134 L108 171" stroke="#2e2a6e" strokeWidth="1.5" />
      <path d="M48 170 Q66 176 83 172 Q100 176 118 170" fill="none" stroke="#22d3ee" strokeWidth="2" />
      <path d="M83 90 L83 132" stroke="#22d3ee" strokeWidth="2" />
      <rect x="60" y="128" width="46" height="6" rx="2" fill="#0b0a1a" />
      <rect x="79" y="127" width="9" height="8" rx="1.5" fill="#fbbf24" />

      {/* scarf wrap */}
      <path d="M66 82 Q84 94 102 82 L100 96 Q84 104 68 96 Z" fill="#f43f5e" />
      <path d="M84 92 Q93 92 101 86 L100 96 Q92 100 84 99 Z" fill="#be123c" />

      {pose === 'battle' && (
        <g className="mm-hero__arm">
          {/* sword arm */}
          <path d="M98 96 Q118 102 126 116 L118 122 Q108 112 96 108 Z" fill="#1e1b4b" />
          <circle cx="124" cy="119" r="5" fill="#fde2cf" />
          <path className="mm-hero__blade" d="M125 114 L162 36 L167 40 L130 120 Z" fill={`url(#${id}blade)`} filter={`url(#${id}glow)`} />
          <rect x="116" y="113" width="18" height="4" rx="1.5" fill="#fbbf24" transform="rotate(-64 125 115)" />
        </g>
      )}

      {/* head: softer, rounder chin */}
      <path d="M68 48 Q68 30 85 29 Q102 30 103 48 Q103 64 93 73 Q85 79 78 73 Q68 64 68 48 Z" fill="#fde2cf" />
      <path d="M68 48 Q69 36 78 31 Q72 48 76 71 Q68 63 68 48 Z" fill="#f2c4a8" />

      {/* big eyes with lashes */}
      <path d="M87 50 Q95 45 102 51 L101 61 Q94 64 88 59 Z" fill="white" />
      <ellipse cx="95.5" cy="56" rx="3.6" ry="5.2" fill="#0891b2" />
      <ellipse cx="96" cy="57" rx="1.8" ry="2.8" fill="#082f49" />
      <circle cx="97.2" cy="53.8" r="1.4" fill="white" />
      <path d="M86 50 Q95 43 103 50" fill="none" stroke="#1b1442" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M102 50 L105 47 M100 48 L102 44.5" stroke="#1b1442" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M73 52 Q78 48 83 52 L83 60 Q78 62 73 58 Z" fill="white" />
      <ellipse cx="78.5" cy="56.5" rx="2.6" ry="4.4" fill="#0891b2" />
      <circle cx="79.4" cy="54.5" r="1" fill="white" />
      <path d="M72 51.5 Q78 46.5 84 51.5" fill="none" stroke="#1b1442" strokeWidth="2.2" strokeLinecap="round" />
      {/* blush + small smile */}
      <ellipse cx="97" cy="65" rx="4" ry="2" fill="#fb7185" opacity="0.45" />
      <ellipse cx="76" cy="65" rx="3" ry="1.8" fill="#fb7185" opacity="0.35" />
      <path d="M86 68 Q89 70.5 92 68" stroke="#b4534a" strokeWidth="1.5" fill="none" strokeLinecap="round" />

      {/* fringe + side locks */}
      <path
        d="M64 52 Q62 30 80 24 Q98 20 106 34 Q110 42 106 54 Q102 44 96 40 Q90 46 82 44 Q78 50 72 48 Q70 54 68 60 Z"
        fill={hair}
      />
      <path d="M66 46 Q62 62 68 80 L72 78 Q68 64 70 50 Z" fill={hair} />
      <path d="M104 46 Q108 62 102 80 L98 77 Q102 64 100 50 Z" fill={hair} />
      <path d="M78 26 Q90 22 100 30 Q90 27 80 30 Z" fill={hairShine} opacity="0.8" />

      {/* ribbon on the ponytail */}
      <g fill="#e11d48" stroke="#9f1239" strokeWidth="1">
        <path d="M70 30 L58 22 L60 36 Z" />
        <path d="M70 30 L74 16 L80 28 Z" />
        <circle cx="70" cy="30" r="3.5" />
      </g>
    </svg>
  );
}
