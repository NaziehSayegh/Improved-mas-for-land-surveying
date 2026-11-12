import React from 'react';

/**
 * The loading screen shown while a page (or the license check) is getting ready.
 * A survey parcel is traced corner to corner, fills, then is traced again.
 *
 * It fades in after a short delay, so a page that is ready almost immediately
 * never flashes a loader at the user.
 */
const CORNERS = [[22, 78], [34, 30], [70, 18], [98, 46], [84, 92]];
const OUTLINE = CORNERS.map(([x, y]) => `${x},${y}`).join(' ');

const PageLoader = ({ label = 'Loading' }) => (
  <div className="page-loader h-full w-full min-h-[240px] flex flex-col items-center justify-center gap-5 select-none" role="status" aria-live="polite">
    <style>{`
      .page-loader { animation: pl-appear 0.35s ease-out 0.12s both; }
      .page-loader .pl-outline { stroke-dasharray: 100; animation: pl-trace 2.4s cubic-bezier(.6,.05,.3,1) infinite; }
      .page-loader .pl-fill { animation: pl-fill 2.4s ease-in-out infinite; }
      .page-loader .pl-corner { transform-box: fill-box; transform-origin: center; animation: pl-corner 2.4s ease-out infinite; }
      .page-loader .pl-halo { animation: pl-halo 2.4s ease-in-out infinite; }
      .page-loader .pl-dot { animation: pl-dot 1.2s ease-in-out infinite; }
      @keyframes pl-appear { from { opacity: 0; transform: scale(.96); } to { opacity: 1; transform: scale(1); } }
      @keyframes pl-trace { 0% { stroke-dashoffset: 100; } 55%, 80% { stroke-dashoffset: 0; } 100% { stroke-dashoffset: -100; } }
      @keyframes pl-fill { 0%, 45% { opacity: 0; } 65%, 80% { opacity: 1; } 100% { opacity: 0; } }
      @keyframes pl-corner { 0% { transform: scale(0); opacity: 0; } 12% { transform: scale(1.5); opacity: 1; } 22%, 82% { transform: scale(1); opacity: 1; } 100% { transform: scale(0); opacity: 0; } }
      @keyframes pl-halo { 0%, 100% { opacity: .25; transform: scale(.92); } 60% { opacity: .6; transform: scale(1.06); } }
      @keyframes pl-dot { 0%, 100% { opacity: .25; transform: translateY(0); } 50% { opacity: 1; transform: translateY(-3px); } }
      @media (prefers-reduced-motion: reduce) {
        .page-loader, .page-loader * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; }
        .page-loader .pl-outline { stroke-dashoffset: 0; }
        .page-loader .pl-fill, .page-loader .pl-corner { opacity: 1; transform: none; }
      }
    `}</style>

    <div className="relative w-32 h-32">
      {/* soft glow behind the drawing */}
      <div className="pl-halo absolute inset-3 rounded-full bg-primary/25 blur-2xl" />

      <svg viewBox="0 0 120 120" className="relative w-full h-full" aria-hidden="true">
        <defs>
          <linearGradient id="pl-stroke" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#58a6ff" />
            <stop offset="100%" stopColor="#a78bfa" />
          </linearGradient>
          <linearGradient id="pl-area" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#58a6ff" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.10" />
          </linearGradient>
        </defs>

        {/* survey grid */}
        <g stroke="#58a6ff" strokeOpacity="0.10" strokeWidth="1">
          {[20, 40, 60, 80, 100].map(v => (
            <React.Fragment key={v}>
              <line x1={v} y1="8" x2={v} y2="112" />
              <line x1="8" y1={v} x2="112" y2={v} />
            </React.Fragment>
          ))}
        </g>

        {/* the parcel: area, then boundary */}
        <polygon className="pl-fill" points={OUTLINE} fill="url(#pl-area)" />
        <polygon
          className="pl-outline"
          points={OUTLINE}
          pathLength="100"
          fill="none"
          stroke="url(#pl-stroke)"
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* corner points appear in the order the boundary reaches them */}
        {CORNERS.map(([x, y], i) => (
          <g key={i} className="pl-corner" style={{ animationDelay: `${i * 0.22}s` }}>
            <circle cx={x} cy={y} r="5" fill="#0d1117" stroke="#58a6ff" strokeWidth="2" />
            <circle cx={x} cy={y} r="1.6" fill="#e6edf3" />
          </g>
        ))}
      </svg>
    </div>

    <div className="flex items-center gap-2 text-sm font-medium tracking-wide text-dark-300">
      <span>{label}</span>
      <span className="flex gap-1" aria-hidden="true">
        {[0, 1, 2].map(i => (
          <span key={i} className="pl-dot w-1 h-1 rounded-full bg-primary" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </span>
    </div>
  </div>
);

export default PageLoader;
