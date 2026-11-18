import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { link, navigate } from '@/router';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/controls';
import { crore } from '@/lib/format';
import { deleteProject, detectBackend, listProjects, type Backend } from './repo';
import { PageChrome } from './PageChrome';
import { TYPE_INFO, type ProjectMeta } from './types';
import { TypeGlyph } from './TypeGlyph';

function ago(iso: string) {
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function ProjectsPage() {
  const [items, setItems] = useState<ProjectMeta[] | null>(null);
  const [backend, setBackend] = useState<Backend | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reduce = useReducedMotion();
  const load = () =>
    listProjects()
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  useEffect(() => {
    void detectBackend().then(setBackend);
    void load();
  }, []);
  return (
    <PageChrome
      right={
        <span className="hidden items-center gap-1.5 text-[11.5px] text-lane-dim sm:flex">
          <i className="h-1.5 w-1.5 rounded-full" style={{ background: backend === "cloud" ? "var(--sign-green)" : "var(--band-1)" }} />
          {backend === 'cloud' ? 'Synced to Neon' : backend ? 'Saved in this browser' : 'Connecting…'}
        </span>
      }
    >
      <main className="mx-auto max-w-[1200px] px-4 py-8 md:px-6 md:py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="caps text-[11px] text-blueprint">Workspace</div>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight md:text-4xl">Projects</h1>
            <p className="mt-1 text-[13px] text-lane-dim">Every layout you generate, with its latest yield and compliance.</p>
          </div>
          <a {...link('/projects/new')} className="inline-flex h-10 items-center gap-2 rounded-[4px] bg-signal px-4 text-[14px] font-medium text-[#140800] shadow-[var(--glow-signal)] hover:brightness-110">
            <Icon name="plus" size={16} /> New project
          </a>
        </div>
        {error && <p className="mt-6 rounded-[4px] border border-brake/60 p-3 text-[12.5px] text-brake-ink">Could not load projects: {error}</p>}
        {items === null && !error && (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-56 rounded-[6px]" />
            ))}
          </div>
        )}
        {items && items.length === 0 && (
          <div className="drafting-grid mt-8 flex flex-col items-center justify-center rounded-[6px] border border-dashed border-line px-6 py-16 text-center">
            <div className="flex gap-3">
              {(['plots', 'villas', 'farm'] as const).map((t) => (
                <TypeGlyph key={t} type={t} size={56} />
              ))}
            </div>
            <h2 className="mt-5 text-xl font-semibold">Start your first layout</h2>
            <p className="mt-1 max-w-md text-[13px] text-lane-dim">Pick residential plots, a gated villa community or farm plots, describe the land, and generate a rule-checked layout in seconds.</p>
            <a {...link('/projects/new')} className="mt-5 inline-flex h-10 items-center gap-2 rounded-[4px] bg-signal px-4 text-[14px] font-medium text-[#140800]">
              <Icon name="plus" size={16} /> Create a project
            </a>
          </div>
        )}
        {items && items.length > 0 && (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((p, i) => {
              const info = TYPE_INFO[p.type] ?? TYPE_INFO.plots;
              return (
                <motion.article
                  key={p.id}
                  initial={reduce ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03, duration: 0.25 }}
                  className="group relative flex flex-col overflow-hidden rounded-[6px] border border-line bg-asphalt-2 transition-colors hover:border-lane-dim"
                >
                  <button type="button" onClick={() => navigate(`/projects/${p.id}`)} className="drafting-grid relative flex h-28 items-center justify-center border-b border-line" aria-label={`Open ${p.name}`}>
                    <TypeGlyph type={p.type} size={72} />
                    <span className="absolute top-2 left-2">
                      <Badge tone="dim" className="bg-asphalt/80">
                        <i className="h-1.5 w-1.5 rounded-full" style={{ background: info.accent }} />
                        {info.title}
                      </Badge>
                    </span>
                  </button>
                  <div className="flex flex-1 flex-col p-4">
                    <a {...link(`/projects/${p.id}`)} className="text-[15px] font-semibold hover:text-signal-ink">
                      {p.name}
                    </a>
                    <p className="mt-0.5 text-[12px] text-lane-dim">
                      {[p.details?.location, p.details?.authority, `${p.details?.acres ?? '—'} ac`].filter(Boolean).join(' · ')}
                    </p>
                    {p.summary ? (
                      <dl className="num mt-3 grid grid-cols-3 gap-2 text-[12px]">
                        <div>
                          <dt className="caps text-[9.5px] text-lane-dim">Plots</dt>
                          <dd className="text-[15px]">{p.summary.plots}</dd>
                        </div>
                        <div>
                          <dt className="caps text-[9.5px] text-lane-dim">Saleable</dt>
                          <dd className="text-[15px] text-blueprint">{p.summary.saleablePct.toFixed(1)}%</dd>
                        </div>
                        <div>
                          <dt className="caps text-[9.5px] text-lane-dim">Revenue</dt>
                          <dd className="text-[15px]">{crore(p.summary.revenue)}</dd>
                        </div>
                      </dl>
                    ) : (
                      <p className="mt-3 text-[12px] text-lane-dim">Not generated yet</p>
                    )}
                    <div className="mt-auto flex items-center justify-between pt-4 text-[11px] text-lane-dim">
                      <span>Updated {ago(p.updatedAt)}</span>
                      {p.summary && (p.summary.failing > 0 ? <Badge tone="red">{p.summary.failing} failing</Badge> : <Badge tone="green">Checks clear</Badge>)}
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label={`Delete ${p.name}`}
                    title="Delete project"
                    onClick={async () => {
                      if (!window.confirm(`Delete “${p.name}”? This cannot be undone.`)) return;
                      await deleteProject(p.id);
                      void load();
                    }}
                    className="absolute top-2 right-2 rounded-[3px] bg-asphalt/80 p-1.5 text-lane-dim opacity-0 transition-opacity group-hover:opacity-100 hover:text-brake-ink focus:opacity-100"
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </motion.article>
              );
            })}
          </div>
        )}
        <p className="mt-10 text-center text-[11px] text-lane-dim">Yield study only — not a submission drawing.</p>
      </main>
    </PageChrome>
  );
}
