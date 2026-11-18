import type { ProjectType } from './types';

/** Small drafted illustration for each project type. */
export function TypeGlyph({ type, size = 64 }: { type: ProjectType; size?: number }) {
  const s = { fill: 'none', strokeWidth: 1.2, vectorEffect: 'non-scaling-stroke' as const };
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <rect x="2" y="2" width="60" height="60" rx="4" {...s} stroke="var(--line)" />
      {type === 'plots' &&
        [0, 1, 2].map((r) =>
          [0, 1, 2, 3, 4].map((c) => (
            <rect key={`${r}${c}`} x={8 + c * 10} y={9 + r * 16} width="9" height="7" fill="color-mix(in srgb, var(--blueprint) 25%, transparent)" stroke="var(--blueprint)" strokeWidth={0.8} />
          )),
        )}
      {type === 'villas' && (
        <>
          {[0, 1].map((r) =>
            [0, 1, 2].map((c) => (
              <g key={`${r}${c}`}>
                <rect x={9 + c * 16} y={12 + r * 24} width="13" height="13" fill="color-mix(in srgb, var(--band-3) 20%, transparent)" stroke="var(--band-3)" strokeWidth={0.8} />
                <rect x={12 + c * 16} y={15 + r * 24} width="7" height="7" fill="var(--band-3)" opacity={0.75} />
              </g>
            )),
          )}
          <circle cx="32" cy="32" r="2.5" fill="var(--signal)" />
        </>
      )}
      {type === 'farm' && (
        <>
          <path d="M8 22h48M8 42h48M32 8v48" stroke="var(--road-edge)" strokeWidth={1.4} fill="none" />
          {[
            [8, 8, 24, 14],
            [33, 8, 23, 14],
            [8, 23, 24, 19],
            [33, 23, 23, 19],
            [8, 43, 24, 13],
            [33, 43, 23, 13],
          ].map(([x, y, w, h], i) => (
            <rect key={i} x={x + 1} y={y + 1} width={w - 2} height={h - 2} fill="color-mix(in srgb, var(--sign-green) 22%, transparent)" stroke="var(--sign-green)" strokeWidth={0.8} />
          ))}
          {[14, 22, 42, 50].map((x) => (
            <circle key={x} cx={x} cy={30} r="2" fill="var(--sign-green)" />
          ))}
        </>
      )}
    </svg>
  );
}
