/**
 * Glitch: a cheeky Static imp who loves mazes and hates losing. Small and
 * light SVG (no blur filters), so it can animate next to a busy board.
 * View box 160×170.
 */
export type GlitchMood = 'idle' | 'think' | 'smug' | 'oops' | 'win' | 'lose';

export function GlitchArt({ mood = 'idle', className = '' }: { mood?: GlitchMood; className?: string }) {
  const eyesClosed = mood === 'win' || mood === 'lose';
  return (
    <svg className={`dd-glitch dd-glitch--${mood} ${className}`} viewBox="0 0 160 170" aria-hidden>
      <defs>
        <linearGradient id="dd-glitch-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#3b0764" />
        </linearGradient>
      </defs>
      <ellipse cx="80" cy="160" rx="38" ry="6" fill="rgb(0 0 0 / 0.35)" className="dd-glitch__shadow" />
      <g className="dd-glitch__float">
        {/* horns */}
        <path d="M46 52 L34 14 L62 40 Z" fill="#a78bfa" />
        <path d="M114 52 L126 14 L98 40 Z" fill="#a78bfa" />
        {/* body: a jagged droplet */}
        <path
          d="M80 30 C118 30 132 64 130 96 C128 126 108 146 80 146 C52 146 32 126 30 96 C28 64 42 30 80 30 Z"
          fill="url(#dd-glitch-body)"
          stroke="#c4b5fd"
          strokeWidth="2"
        />
        {/* static pixels */}
        <g className="dd-glitch__pixels" fill="#22d3ee">
          <rect x="36" y="78" width="8" height="5" />
          <rect x="118" y="100" width="10" height="5" />
          <rect x="60" y="134" width="6" height="4" />
          <rect x="104" y="44" width="7" height="4" fill="#f472b6" />
        </g>
        {/* tail */}
        <path d="M122 128 C146 132 150 112 140 104 L148 98 L136 96" fill="none" stroke="#a78bfa" strokeWidth="5" strokeLinecap="round" />
        {/* eyes: one big, one small (it's a glitch) */}
        {eyesClosed ? (
          <g stroke="#e0f2fe" strokeWidth="5" strokeLinecap="round" fill="none">
            <path d={mood === 'win' ? 'M48 84 Q60 72 72 84' : 'M48 78 Q60 90 72 78'} />
            <path d={mood === 'win' ? 'M92 84 Q102 74 112 84' : 'M92 80 Q102 90 112 80'} />
          </g>
        ) : (
          <g>
            <ellipse cx="60" cy="82" rx="16" ry={mood === 'think' ? 13 : 17} fill="#e0f2fe" />
            <ellipse cx="102" cy="84" rx="11" ry={mood === 'think' ? 9 : 12} fill="#e0f2fe" />
            <g className="dd-glitch__pupils">
              <circle cx={mood === 'think' ? 66 : 62} cy={mood === 'think' ? 76 : 84} r="7" fill="#1e1b4b" />
              <circle cx={mood === 'think' ? 106 : 103} cy={mood === 'think' ? 80 : 86} r="5" fill="#1e1b4b" />
              <circle cx={mood === 'think' ? 68 : 64} cy={mood === 'think' ? 73 : 81} r="2.4" fill="white" />
            </g>
            {mood === 'oops' && <path d="M44 62 L74 68 M90 70 L116 64" stroke="#e0f2fe" strokeWidth="4" strokeLinecap="round" />}
            {mood === 'smug' && <path d="M44 66 L74 62 M90 64 L116 70" stroke="#e0f2fe" strokeWidth="4" strokeLinecap="round" />}
          </g>
        )}
        {/* mouth */}
        {mood === 'oops' || mood === 'lose' ? (
          <path d="M64 120 Q80 108 96 120" fill="none" stroke="#f9a8d4" strokeWidth="4" strokeLinecap="round" />
        ) : mood === 'think' ? (
          <path d="M70 116 L90 114" stroke="#f9a8d4" strokeWidth="4" strokeLinecap="round" />
        ) : (
          <path d="M58 110 Q80 132 104 108 L96 112 L90 106 L84 114 L78 106 L72 114 L66 106 Z" fill="#1e1b4b" stroke="#f9a8d4" strokeWidth="3" strokeLinejoin="round" />
        )}
      </g>
    </svg>
  );
}
