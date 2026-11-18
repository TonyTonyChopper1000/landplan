import { useEffect, useMemo, useState } from 'react';
import { link, navigate } from '@/router';
import { Wordmark } from '@/features/projects/PageChrome';
import { useUi } from '@/state/ui';
import { toggleTheme } from '@/state/actions';
import { Icon } from '@/components/ui/Icon';
import { SECTIONS_1 } from './content1';
import { SECTIONS_2 } from './content2';

const SECTIONS = [...SECTIONS_1, ...SECTIONS_2];
const GROUPS = Array.from(new Set(SECTIONS.map((s) => s.group)));

export function DocsPage({ section }: { section?: string }) {
  const theme = useUi((s) => s.theme);
  const [active, setActive] = useState(section ?? SECTIONS[0].id);
  const [q, setQ] = useState('');
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? SECTIONS.filter((x) => x.title.toLowerCase().includes(s) || x.group.toLowerCase().includes(s)) : SECTIONS;
  }, [q]);

  useEffect(() => {
    if (section) document.getElementById(section)?.scrollIntoView({ block: 'start' });
  }, [section]);
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActive(vis[0].target.id);
      },
      { rootMargin: '-80px 0px -65% 0px' },
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, []);
  const go = (id: string) => {
    history.replaceState(null, '', `/docs/${id}`);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActive(id);
  };
  const idx = SECTIONS.findIndex((s) => s.id === active);

  return (
    <div className="docs-font min-h-full bg-asphalt">
      <header className="sticky top-0 z-30 border-b border-line bg-asphalt/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1280px] items-center gap-4 px-4 md:px-6">
          <Wordmark />
          <span className="hidden text-lane-dim sm:inline">/</span>
          <span className="hidden font-semibold sm:inline">Docs</span>
          <div className="flex-1" />
          <a {...link('/projects')} className="hidden text-[14px] text-lane-dim hover:text-lane sm:inline">
            Projects
          </a>
          <a {...link('/projects/new')} className="inline-flex h-9 shrink-0 items-center rounded-full bg-signal px-4 text-[14px] font-semibold whitespace-nowrap text-[#140800]">
            New project
          </a>
          <button type="button" onClick={toggleTheme} aria-label="Toggle theme" className="rounded-full p-2 text-lane-dim hover:text-lane">
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
          </button>
        </div>
      </header>
      <div className="mx-auto grid max-w-[1280px] gap-10 px-4 md:grid-cols-[250px_minmax(0,1fr)] md:px-6">
        <aside className="hidden md:block">
          <nav aria-label="Docs sections" className="sticky top-14 max-h-[calc(100vh-3.5rem)] overflow-y-auto py-8 pr-2">
            <label className="mb-5 flex h-9 items-center gap-2 rounded-[6px] border border-line bg-asphalt-2 px-2.5 focus-within:border-signal">
              <Icon name="search" size={14} className="text-lane-dim" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search docs" aria-label="Search docs" className="w-full bg-transparent text-[14px] outline-none" />
            </label>
            {GROUPS.map((g) => {
              const items = shown.filter((s) => s.group === g);
              if (!items.length) return null;
              return (
                <div key={g} className="mb-6">
                  <div className="mb-2 text-[12px] font-bold tracking-wide text-lane-dim uppercase">{g}</div>
                  <ul className="space-y-0.5 border-l border-line">
                    {items.map((s) => (
                      <li key={s.id}>
                        <a
                          href={`/docs/${s.id}`}
                          onClick={(e) => {
                            e.preventDefault();
                            go(s.id);
                          }}
                          aria-current={active === s.id ? 'true' : undefined}
                          className={`-ml-px block border-l-2 py-1.5 pl-3 text-[14.5px] transition-colors ${active === s.id ? 'border-signal font-semibold text-lane' : 'border-transparent text-lane-dim hover:text-lane'}`}
                        >
                          {s.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </nav>
        </aside>
        <main className="min-w-0 py-8 md:py-10">
          <label className="mb-6 block md:hidden">
            <span className="sr-only">Jump to section</span>
            <select value={active} onChange={(e) => go(e.target.value)} className="h-10 w-full rounded-[6px] border border-line bg-asphalt-2 px-3 text-[15px]">
              {GROUPS.map((g) => (
                <optgroup key={g} label={g}>
                  {SECTIONS.filter((s) => s.group === g).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <div className="mb-10">
            <div className="text-[13px] font-bold tracking-wide text-signal uppercase">User guide</div>
            <h1 className="mt-1 text-[clamp(32px,4vw,48px)] leading-tight font-bold">How to use LandPlan Studio</h1>
            <p className="mt-2 max-w-[60ch] text-[17px] text-lane-dim">From an empty parcel to a checked, priced layout: every screen, panel and export, step by step.</p>
          </div>
          <article className="docs-prose max-w-[820px]">
            {SECTIONS.map((s) => (
              <section key={s.id} id={s.id} className="scroll-mt-20 border-b border-line pt-2 pb-10 mb-10 last:border-0">
                <div className="mb-1 text-[13px] text-lane-dim">{s.group}</div>
                <h2>{s.title}</h2>
                {s.body}
              </section>
            ))}
          </article>
          <div className="mt-4 flex max-w-[820px] justify-between gap-4 border-t border-line pt-6 text-[15px]">
            {idx > 0 ? (
              <button type="button" onClick={() => go(SECTIONS[idx - 1].id)} className="text-left text-lane-dim hover:text-lane">
                ← {SECTIONS[idx - 1].title}
              </button>
            ) : (
              <span />
            )}
            <button type="button" onClick={() => navigate('/projects/new')} className="font-semibold text-signal-ink hover:underline">
              Start a project →
            </button>
          </div>
          <p className="mt-10 max-w-[820px] text-[13px] text-lane-dim">Yield study only — not a submission drawing. Rules change by GO; verify each rule against the current text before relying on it.</p>
        </main>
      </div>
    </div>
  );
}
