import type { ReactNode } from 'react';

export function Fig({ src, alt, caption }: { src: string; alt: string; caption?: string }) {
  return (
    <figure className="my-6">
      <img src={`/docs/${src}.webp`} alt={alt} loading="lazy" width={1440} height={900} className="w-full rounded-[8px] border border-line shadow-xl" />
      {caption && <figcaption className="mt-2 text-[0.85em] text-lane-dim">{caption}</figcaption>}
    </figure>
  );
}

export function Steps({ children }: { children: ReactNode }) {
  return <ol className="docs-steps my-4 space-y-2.5">{children}</ol>;
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded-[3px] border border-line bg-asphalt-3 px-1.5 py-0.5 text-[0.85em] [font-family:monospace]">{children}</kbd>;
}

export function Note({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warn' }) {
  return (
    <div className={`my-5 rounded-[6px] border-l-4 px-4 py-3 ${tone === 'warn' ? 'border-signal bg-signal/[0.06]' : 'border-blueprint bg-blueprint/[0.06]'}`}>
      {children}
    </div>
  );
}

export function T({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="my-5 overflow-x-auto rounded-[6px] border border-line">
      <table className="w-full border-collapse text-[0.92em]">
        <thead className="bg-asphalt-2">
          <tr>
            {head.map((h) => (
              <th key={h} className="border-b border-line px-3 py-2 text-left font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-line/60 last:border-0 align-top">
              {r.map((c, j) => (
                <td key={j} className="px-3 py-2">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export type DocSection = { id: string; title: string; group: string; body: ReactNode };
