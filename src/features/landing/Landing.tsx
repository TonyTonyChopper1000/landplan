import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { link } from '@/router';
import { RULES, CONFLICT_GROUPS } from '@/rules/regulations';
import { ACRE } from '@/engine/geometry';
import type { Layout } from '@/engine/types';
import { Icon } from '@/components/ui/Icon';
import { Ticker } from '@/components/ui/Ticker';
import { useUi } from '@/state/ui';
import { toggleTheme } from '@/state/actions';
import { TypeGlyph } from '@/features/projects/TypeGlyph';
import { TYPE_INFO, type ProjectType } from '@/features/projects/types';
import { Wordmark } from '@/features/projects/PageChrome';
import { HeroPlan, useHeroLayouts } from './HeroPlan';

function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div className={className} initial={reduce ? false : { opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.5, delay, ease: [0.2, 0.8, 0.2, 1] }}>
      {children}
    </motion.div>
  );
}

function Cta({ to, children, ghost }: { to: string; children: ReactNode; ghost?: boolean }) {
  return (
    <a
      {...link(to)}
      className={
        ghost
          ? 'inline-flex h-12 items-center gap-2 rounded-[6px] border border-line bg-asphalt/60 px-5 text-[15px] backdrop-blur hover:border-lane-dim'
          : 'group inline-flex h-12 items-center gap-2 rounded-[6px] bg-signal px-6 text-[15px] font-semibold text-[#140800] shadow-[0_0_0_1px_rgba(255,107,26,.6),0_10px_40px_-8px_rgba(255,107,26,.7)] transition-transform hover:-translate-y-0.5'
      }
    >
      {children}
    </a>
  );
}

function Crosshair() {
  const ref = useRef<HTMLDivElement>(null);
  const [p, setP] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const el = ref.current?.parentElement;
    if (!el) return;
    const m = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      setP({ x: e.clientX - r.left, y: e.clientY - r.top });
    };
    const l = () => setP(null);
    el.addEventListener('pointermove', m);
    el.addEventListener('pointerleave', l);
    return () => {
      el.removeEventListener('pointermove', m);
      el.removeEventListener('pointerleave', l);
    };
  }, []);
  return (
    <div ref={ref} className="pointer-events-none absolute inset-0 hidden md:block" aria-hidden>
      {p && (
        <>
          <div className="absolute top-0 bottom-0 w-px bg-blueprint/25" style={{ left: p.x }} />
          <div className="absolute right-0 left-0 h-px bg-blueprint/25" style={{ top: p.y }} />
          <div className="mono absolute rounded-[3px] bg-asphalt/80 px-1.5 py-0.5 text-[10px] text-blueprint" style={{ left: p.x + 10, top: p.y + 10 }}>
            E {(232957 + p.x * 0.42).toFixed(1)} · N {(1923897 - p.y * 0.42).toFixed(1)}
          </div>
        </>
      )}
    </div>
  );
}

const STEPS = [
  { n: '01', t: 'Describe the land', d: 'Pick plots, villas or farm land. Enter survey numbers, extent in acres and guntas, the authority and your rates — or trace the boundary on satellite.', icon: 'site' },
  { n: '02', t: 'Generate', d: 'The engine searches 486 grid layouts in your browser, cuts splays, carves parks and utilities, applies buffers and packs whole-foot plots.', icon: 'bolt' },
  { n: '03', t: 'Decide', d: 'Every check cites its GO. See revenue, IRR and peak funding, compare scenarios with a swipe, and export the A3 sheet, DXF or schedule.', icon: 'shield' },
];

const FEATURES = [
  { icon: 'cube', t: '3D massing with real sun', d: 'Villas extruded with setbacks, shadows for Hyderabad at any date and hour, and a one-click fly-through.' },
  { icon: 'chart', t: 'Cash flow, IRR, tornado', d: 'Monthly sales against development spend and mortgage release, with sensitivity on rate, cost, velocity and mortgage.' },
  { icon: 'map', t: 'Trace on satellite', d: 'Click the corners on imagery, import GeoJSON, KML or DXF, or type a bearings traverse — Bowditch-adjusted.' },
  { icon: 'compare', t: 'Scenarios with a swipe', d: 'Duplicate, tweak and drag a divider across two plans while every KPI shows its delta.' },
  { icon: 'download', t: 'Six exports', d: 'A3 drawing sheet PDF with title block, SVG, layered DXF, XLSX and CSV schedules, and GeoJSON.' },
  { icon: 'table', t: 'Live inventory', d: 'Lasso plots on the plan, mark them held, booked or sold, override prices and watch sellable stock update.' },
];

export function Landing() {
  const layouts = useHeroLayouts();
  const [scene, setScene] = useState<Layout>(layouts[0]);
  const onScene = useCallback((l: Layout) => setScene(l), []);
  const theme = useUi((s) => s.theme);
  const reduce = useReducedMotion();
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 600], [0, reduce ? 0 : 120]);
  const heroO = useTransform(scrollY, [0, 500], [1, 0.25]);
  const refs = [...new Set(RULES.map((r) => r.reference).filter((r) => r !== '—'))];
  return (
    <div className="min-h-full overflow-x-hidden bg-asphalt">
      <header className="fixed inset-x-0 top-0 z-40 border-b border-line/60 bg-asphalt/70 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1240px] items-center gap-4 px-4 md:px-6">
          <Wordmark />
          <nav className="ml-6 hidden gap-5 text-[13px] text-lane-dim md:flex">
            <a href="#how" className="hover:text-lane">How it works</a>
            <a href="#types" className="hover:text-lane">Project types</a>
            <a href="#rules" className="hover:text-lane">Rules</a>
            <a href="#features" className="hover:text-lane">Features</a>
          </nav>
          <div className="flex-1" />
          <button type="button" onClick={toggleTheme} aria-label="Toggle theme" className="rounded-[4px] p-2 text-lane-dim hover:text-lane">
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
          </button>
          <a {...link('/projects')} className="hidden text-[13px] text-lane-dim hover:text-lane sm:inline">
            Projects
          </a>
          <a {...link('/projects/new')} className="inline-flex h-9 items-center gap-1.5 rounded-[4px] bg-signal px-3.5 text-[13px] font-semibold text-[#140800]">
            Start <Icon name="chevron" size={13} />
          </a>
        </div>
      </header>

      {/* HERO */}
      <section className="drafting-grid relative isolate flex min-h-[100svh] flex-col overflow-hidden pt-14">
        <motion.div style={{ y: heroY, opacity: heroO }} className="absolute inset-0 -z-10">
          <div className={reduce ? 'absolute inset-[-6%]' : 'drift absolute inset-[-6%]'}>
            <div className="absolute inset-y-[8%] right-[-8%] left-[30%] max-md:inset-x-[-20%] max-md:top-[38%] max-md:bottom-[-10%]">
              <HeroPlan layouts={layouts} onScene={onScene} />
            </div>
          </div>
          {!reduce && <div className="scanline absolute inset-y-0 left-0 w-[30%] bg-[linear-gradient(90deg,transparent,rgba(63,193,217,.10)_70%,rgba(255,107,26,.55)_99%,transparent)] mix-blend-screen" />}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_45%,var(--asphalt)_25%,transparent_70%)]" />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-[var(--asphalt)]" />
        </motion.div>
        <Crosshair />
        <div className="mx-auto flex w-full max-w-[1240px] flex-1 flex-col justify-center px-4 py-16 md:px-6">
          <motion.div initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="inline-flex w-fit items-center gap-2 rounded-full border border-blueprint/40 bg-asphalt/70 px-3 py-1 text-[12px] text-blueprint backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-signal" />
            </span>
            HMDA · DTCP · GO Ms 105 — Telangana
          </motion.div>
          <h1 className="mt-6 max-w-[14ch] text-[clamp(44px,8.4vw,112px)] leading-[0.92] font-semibold tracking-[-0.04em]">
            <motion.span className="block" initial={reduce ? false : { opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.05 }}>
              Plot the
            </motion.span>
            <motion.span className="block" initial={reduce ? false : { opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.15 }}>
              whole site
            </motion.span>
            <motion.span className="sheen block" initial={reduce ? false : { opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.25 }}>
              in one click.
            </motion.span>
          </h1>
          <motion.p initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }} className="mt-6 max-w-[52ch] text-[clamp(15px,1.5vw,18px)] text-lane-dim">
            Roads, blocks, plots, parks, utilities and buffers — generated, checked against cited GOs and priced, before your surveyor has finished the boundary.
          </motion.p>
          <motion.div initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }} className="mt-8 flex flex-wrap gap-3">
            <Cta to="/projects/new">
              <Icon name="bolt" size={17} /> Start a project
              <Icon name="chevron" size={14} className="transition-transform group-hover:translate-x-0.5" />
            </Cta>
            <Cta to="/studio" ghost>
              <Icon name="grid" size={16} /> Open the studio
            </Cta>
          </motion.div>
          <div className="mt-14 grid max-w-[720px] grid-cols-2 gap-px overflow-hidden rounded-[6px] border border-line bg-line md:grid-cols-4">
            {[
              { l: 'This parcel', v: scene.gross / ACRE, f: (n: number) => `${n.toFixed(1)} ac` },
              { l: 'Plots placed', v: scene.plots.length, f: (n: number) => String(Math.round(n)) },
              { l: 'Saleable', v: (scene.plotted / scene.gross) * 100, f: (n: number) => `${n.toFixed(1)}%` },
              { l: 'Cited rules', v: RULES.length, f: (n: number) => String(Math.round(n)) },
            ].map((k) => (
              <div key={k.l} className="bg-asphalt/85 px-4 py-3 backdrop-blur">
                <div className="caps text-[10px] text-lane-dim">{k.l}</div>
                <div className="mt-0.5 text-[24px] font-semibold">
                  <Ticker value={k.v} format={k.f} />
                </div>
              </div>
            ))}
          </div>
          <p className="mono mt-3 text-[10.5px] text-lane-dim">↑ live from the layout engine running in your browser right now</p>
        </div>
      </section>

      {/* MARQUEE */}
      <div className="relative overflow-hidden border-y border-line bg-asphalt-2 py-3" aria-hidden>
        <div className={`flex w-max gap-10 whitespace-nowrap ${reduce ? '' : 'marquee'}`}>
          {[...refs, ...refs].map((r, i) => (
            <span key={i} className="mono text-[12px] text-lane-dim">
              <span className="text-signal">§</span> {r}
            </span>
          ))}
        </div>
      </div>

      {/* HOW */}
      <section id="how" className="mx-auto max-w-[1240px] scroll-mt-20 px-4 py-24 md:px-6">
        <Reveal>
          <div className="caps text-[11px] text-blueprint">How it works</div>
          <h2 className="mt-2 max-w-[20ch] text-[clamp(30px,4.2vw,52px)] leading-[1.02] font-semibold tracking-tight">From survey sketch to saleable inventory in three moves.</h2>
        </Reveal>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.08}>
              <div className="group relative h-full overflow-hidden rounded-[8px] border border-line bg-asphalt-2 p-6 transition-colors hover:border-blueprint/60">
                <div className="mono text-[56px] leading-none font-semibold text-line transition-colors group-hover:text-blueprint/40">{s.n}</div>
                <Icon name={s.icon} size={22} className="mt-4 text-signal" />
                <h3 className="mt-3 text-[19px] font-semibold">{s.t}</h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-lane-dim">{s.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* TYPES */}
      <section id="types" className="scroll-mt-20 border-y border-line bg-asphalt-2">
        <div className="mx-auto max-w-[1240px] px-4 py-24 md:px-6">
          <Reveal>
            <div className="caps text-[11px] text-blueprint">Project types</div>
            <h2 className="mt-2 max-w-[22ch] text-[clamp(30px,4.2vw,52px)] leading-[1.02] font-semibold tracking-tight">One engine. Three kinds of venture.</h2>
          </Reveal>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {(Object.keys(TYPE_INFO) as ProjectType[]).map((t, i) => {
              const info = TYPE_INFO[t];
              return (
                <Reveal key={t} delay={i * 0.08}>
                  <a {...link(`/projects/new?type=${t}`)} className="group flex h-full flex-col rounded-[8px] border border-line bg-asphalt p-6 transition-all hover:-translate-y-1 hover:border-[color:var(--c)]" style={{ ['--c' as string]: info.accent }}>
                    <TypeGlyph type={t} size={84} />
                    <span className="caps mt-5 text-[10.5px]" style={{ color: info.accent }}>
                      {info.tag}
                    </span>
                    <span className="mt-1 text-[22px] font-semibold">{info.title}</span>
                    <span className="mt-2 text-[13.5px] text-lane-dim">{info.blurb}</span>
                    <ul className="mt-5 space-y-1.5 text-[13px]">
                      {info.bullets.map((b) => (
                        <li key={b} className="flex items-center gap-2">
                          <Icon name="check" size={13} className="text-signal" />
                          {b}
                        </li>
                      ))}
                    </ul>
                    <span className="mt-auto pt-6 text-[13px] font-medium text-signal-ink">
                      Start a {info.title.toLowerCase()} project <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
                    </span>
                  </a>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* RULES */}
      <section id="rules" className="mx-auto grid max-w-[1240px] scroll-mt-20 gap-12 px-4 py-24 md:grid-cols-[1fr_1.1fr] md:px-6">
        <Reveal>
          <div className="caps text-[11px] text-blueprint">Compliance you can cite</div>
          <h2 className="mt-2 text-[clamp(30px,4.2vw,52px)] leading-[1.02] font-semibold tracking-tight">No green tick without a source.</h2>
          <p className="mt-4 max-w-[46ch] text-[15px] leading-relaxed text-lane-dim">
            {RULES.length} rules from GO 105, GO 168, HMDA guidance and the AMASR Act, each with its reference, source link and last-verified date. Where sources disagree — {Object.values(CONFLICT_GROUPS).map((g) => g.title.replace(/^(Mortgage|Open)/, (w) => w.toLowerCase())).join(", ")} — you pick, and the choice is kept with a note.
          </p>
          <div className="mt-8">
            <Cta to="/projects/new">Run the checks on your land</Cta>
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="overflow-hidden rounded-[8px] border border-line bg-asphalt-2 shadow-2xl">
            {[
              { s: 'Pass', tone: 'var(--sign-green-ink)', t: 'Public-purpose reservation ≥ 10% of net', r: 'OS-10 · GO Ms 105 (2021)', a: '10.62% of 68,797 m²' },
              { s: 'Pass', tone: 'var(--sign-green-ink)', t: 'Junction splays cut per table', r: 'RD-TABLE · Rule 5(3) Table I', a: '3 m legs at 22 junctions' },
              { s: 'Conflict', tone: 'var(--blueprint)', t: 'Mortgage share of plotted area', r: 'MG-15 ⇄ MG-25', a: 'GO 105 FAQ says 15%; HMDA FAQs say 25%' },
              { s: 'Fail', tone: 'var(--brake-ink)', t: 'Lake FTL buffer', r: 'BF-LAKE-L · GO 168 (2012)', a: '30 m from FTL — 3 plots inside' },
              { s: 'Verify', tone: 'var(--signal-ink)', t: 'Minimum open-space pocket', r: 'OS-450 · HMDA guidance', a: 'smallest pocket 612 m²' },
            ].map((c, i) => (
              <motion.div key={c.t} initial={reduce ? false : { opacity: 0, x: 16 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.15 + i * 0.08 }} className="grid grid-cols-[86px_1fr] gap-3 border-b border-line px-4 py-3.5 last:border-0">
                <span className="mono h-fit rounded-[3px] border px-1.5 py-0.5 text-center text-[10.5px]" style={{ color: c.tone, borderColor: c.tone }}>
                  {c.s}
                </span>
                <div>
                  <div className="text-[13.5px] font-medium">{c.t}</div>
                  <div className="mono mt-0.5 text-[11px] text-blueprint">{c.r}</div>
                  <div className="mono mt-1 text-[11.5px] text-lane-dim">{c.a}</div>
                </div>
              </motion.div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-lane-dim">Example rows. Your project shows its own measured values.</p>
        </Reveal>
      </section>

      {/* FEATURES */}
      <section id="features" className="scroll-mt-20 border-t border-line bg-asphalt-2">
        <div className="mx-auto max-w-[1240px] px-4 py-24 md:px-6">
          <Reveal>
            <div className="caps text-[11px] text-blueprint">Everything after the layout</div>
            <h2 className="mt-2 max-w-[22ch] text-[clamp(30px,4.2vw,52px)] leading-[1.02] font-semibold tracking-tight">An instrument, not a dashboard template.</h2>
          </Reveal>
          <div className="mt-12 grid gap-px overflow-hidden rounded-[8px] border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <Reveal key={f.t} delay={(i % 3) * 0.06} className="bg-asphalt">
                <div className="h-full p-6">
                  <Icon name={f.icon} size={22} className="text-blueprint" />
                  <h3 className="mt-4 text-[16.5px] font-semibold">{f.t}</h3>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-lane-dim">{f.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="drafting-grid relative overflow-hidden">
        <div className="mx-auto flex max-w-[1240px] flex-col items-start gap-6 px-4 py-28 md:flex-row md:items-end md:justify-between md:px-6">
          <h2 className="max-w-[16ch] text-[clamp(36px,6vw,80px)] leading-[0.95] font-semibold tracking-[-0.03em]">
            Your next venture, <span className="sheen">drafted in seconds.</span>
          </h2>
          <Cta to="/projects/new">
            <Icon name="bolt" size={17} /> Start a project
          </Cta>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-3 px-4 py-6 text-[11.5px] text-lane-dim md:px-6">
          <Wordmark />
          <span>Yield study only — not a submission drawing. Rules change by GO; verify against the current text.</span>
          <a href="/v1/docs" className="hover:text-lane">
            API docs
          </a>
        </div>
      </footer>
    </div>
  );
}
