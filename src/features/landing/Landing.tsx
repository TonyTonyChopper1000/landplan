import { useEffect, useState, type ReactNode } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { link } from '@/router';
import { RULES, CONFLICT_GROUPS } from '@/rules/regulations';
import { ACRE } from '@/engine/geometry';
import { finance } from '@/engine/finance';
import { Icon } from '@/components/ui/Icon';
import { Ticker } from '@/components/ui/Ticker';
import { useUi } from '@/state/ui';
import { toggleTheme } from '@/state/actions';
import { TypeGlyph } from '@/features/projects/TypeGlyph';
import { TYPE_INFO, type ProjectType } from '@/features/projects/types';
import { Wordmark } from '@/features/projects/PageChrome';
import { crore } from '@/lib/format';
import { useHeroLayouts } from './HeroPlan';
import { IsoTable } from './IsoTable';
import { BuildStory } from './BuildStory';
import { Bento } from './Bento';

function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div className={className} initial={reduce ? false : { opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.6, delay, ease: [0.2, 0.8, 0.2, 1] }}>
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
          ? 'inline-flex h-13 items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-6 text-[15px] backdrop-blur-md transition-colors hover:bg-white/[0.08]'
          : 'group relative inline-flex h-13 items-center gap-2 overflow-hidden rounded-full bg-signal px-7 text-[15px] font-semibold text-[#140800] shadow-[0_0_0_1px_rgba(255,107,26,.6),0_18px_60px_-12px_rgba(255,107,26,.85)] transition-transform hover:-translate-y-0.5'
      }
    >
      {!ghost && <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 group-hover:translate-x-full" />}
      <span className="relative flex items-center gap-2">{children}</span>
    </a>
  );
}

function Chip({ className, label, children, delay }: { className: string; label: string; children: ReactNode; delay: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.5 }}
      className={`float-y absolute hidden rounded-[14px] border border-white/10 bg-asphalt/60 px-4 py-3 shadow-2xl backdrop-blur-xl lg:block ${className}`}
      style={{ animationDelay: `${delay}s` }}
    >
      <div className="caps text-[9.5px] text-lane-dim">{label}</div>
      <div className="mt-0.5 text-[22px] leading-tight font-semibold">{children}</div>
    </motion.div>
  );
}

function SectionHead({ kicker, title, sub }: { kicker: string; title: ReactNode; sub?: string }) {
  return (
    <Reveal className="max-w-[760px]">
      <div className="caps text-[11px] text-signal">{kicker}</div>
      <h2 className="mt-3 text-[clamp(34px,5vw,68px)] leading-[0.98] font-semibold tracking-[-0.035em]">{title}</h2>
      {sub && <p className="mt-4 text-[16px] leading-relaxed text-lane-dim">{sub}</p>}
    </Reveal>
  );
}

export function Landing() {
  const layouts = useHeroLayouts();
  const [i, setI] = useState(0);
  const reduce = useReducedMotion();
  const theme = useUi((s) => s.theme);
  const { scrollY } = useScroll();
  const tableY = useTransform(scrollY, [0, 800], [0, reduce ? 0 : 220]);
  const tableO = useTransform(scrollY, [0, 700], [1, 0.15]);
  useEffect(() => {
    if (reduce) return;
    const t = window.setInterval(() => setI((x) => (x + 1) % layouts.length), 6500);
    return () => window.clearInterval(t);
  }, [layouts.length, reduce]);
  const scene = layouts[i];
  const fin = finance(scene);
  const refs = [...new Set(RULES.map((r) => r.reference).filter((r) => r !== '—'))];
  return (
    <div className="min-h-full overflow-x-clip bg-asphalt">
      <header className="fixed inset-x-0 top-0 z-50">
        <div className="mx-auto mt-3 flex h-12 max-w-[1180px] items-center gap-4 rounded-full border border-white/10 bg-asphalt/55 px-4 shadow-2xl backdrop-blur-xl md:mx-auto max-[1220px]:mx-3">
          <Wordmark />
          <nav className="ml-4 hidden gap-5 text-[13px] text-lane-dim md:flex">
            <a href="#build" className="hover:text-lane">How it works</a>
            <a href="#product" className="hover:text-lane">Product</a>
            <a href="#types" className="hover:text-lane">Project types</a>
            <a href="#rules" className="hover:text-lane">Rules</a>
            <a {...link('/docs')} className="hover:text-lane">Docs</a>
          </nav>
          <div className="flex-1" />
          <button type="button" onClick={toggleTheme} aria-label="Toggle theme" className="rounded-full p-2 text-lane-dim hover:text-lane">
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
          </button>
          <a {...link('/projects')} className="hidden text-[13px] text-lane-dim hover:text-lane sm:inline">
            Projects
          </a>
          <a {...link('/projects/new')} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-lane px-3.5 text-[12.5px] font-semibold text-asphalt">
            Start free <Icon name="chevron" size={12} />
          </a>
        </div>
      </header>

      {/* HERO */}
      <section className="noise relative isolate flex min-h-[100svh] flex-col items-center overflow-hidden pt-28 text-center">
        <div className="absolute inset-0 -z-20 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(63,193,217,.16),transparent_60%),radial-gradient(ellipse_60%_50%_at_50%_100%,rgba(255,107,26,.18),transparent_70%)]" />
        <div className="drafting-grid absolute inset-0 -z-20 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_45%,black,transparent)]" />
        <motion.div style={{ y: tableY, opacity: tableO }} className="absolute inset-x-0 top-[43%] bottom-[-38%] -z-10 max-md:top-[56%]">
          <IsoTable layout={scene} sceneKey={i} />
        </motion.div>
        <div className="absolute inset-x-0 bottom-0 -z-10 h-56 bg-gradient-to-b from-transparent to-[var(--asphalt)]" />

        <motion.a
          {...link('/projects/new?type=villas')}
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] py-1 pr-3 pl-1 text-[12.5px] text-lane-dim backdrop-blur-md hover:text-lane"
        >
          <span className="rounded-full bg-signal/15 px-2 py-0.5 text-[11px] font-semibold text-signal-ink">New</span>
          Gated villas & farm plots, with live 3D massing
          <Icon name="chevron" size={12} className="transition-transform group-hover:translate-x-0.5" />
        </motion.a>
        <h1 className="mt-7 px-4 text-[clamp(48px,10vw,148px)] leading-[0.86] font-semibold tracking-[-0.055em]">
          <motion.span className="block" initial={reduce ? false : { opacity: 0, y: 40, filter: 'blur(12px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ duration: 0.8, delay: 0.05 }}>
            Plot the whole site
          </motion.span>
          <motion.span className="sheen block pb-2" initial={reduce ? false : { opacity: 0, y: 40, filter: 'blur(12px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ duration: 0.8, delay: 0.2 }}>
            in one click.
          </motion.span>
        </h1>
        <motion.p initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mt-6 max-w-[56ch] px-4 text-[clamp(15px,1.6vw,19px)] leading-relaxed text-lane-dim">
          The layout studio for Telangana ventures. Roads, plots, parks and buffers generated, checked against cited GOs and priced — before your surveyor has finished the boundary.
        </motion.p>
        <motion.div initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }} className="mt-9 flex flex-wrap justify-center gap-3 px-4">
          <Cta to="/projects/new">
            <Icon name="bolt" size={17} /> Generate my layout
          </Cta>
          <Cta to="/studio" ghost>
            <Icon name="grid" size={16} /> Try the studio
          </Cta>
        </motion.div>
        <motion.p initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }} className="mono mt-5 px-4 text-[11px] text-lane-dim">
          HMDA · DTCP · GO Ms 105<span className="hidden sm:inline"> &nbsp;·&nbsp; no sign-up &nbsp;·&nbsp; runs in your browser</span>
        </motion.p>

        <Chip className="top-[40%] left-[6%]" label="Plots on this parcel" delay={1.1}>
          <Ticker value={scene.plots.length} format={(n) => String(Math.round(n))} />
        </Chip>
        <Chip className="top-[58%] left-[12%]" label="Saleable" delay={1.3}>
          <span className="text-blueprint">
            <Ticker value={(scene.plotted / scene.gross) * 100} format={(n) => `${n.toFixed(1)}%`} />
          </span>
        </Chip>
        <Chip className="top-[42%] right-[6%]" label="Revenue at ₹32k/yd²" delay={1.2}>
          <span className="text-signal-ink">
            <Ticker value={fin.revenue} format={crore} />
          </span>
        </Chip>
        <Chip className="top-[60%] right-[11%]" label="Extent" delay={1.4}>
          <Ticker value={scene.gross / ACRE} format={(n) => `${n.toFixed(1)} ac`} />
        </Chip>
        <div className="flex-1" />
        <div className="mono mb-6 flex items-center gap-2 text-[10.5px] text-lane-dim">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sign-green opacity-70" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-sign-green" />
          </span>
          live layout engine · scene {i + 1}/{layouts.length}
        </div>
      </section>

      {/* MARQUEE */}
      <div className="relative overflow-hidden border-y border-line bg-asphalt-2 py-4" aria-hidden>
        <div className={`flex w-max gap-12 whitespace-nowrap ${reduce ? '' : 'marquee'}`}>
          {[...refs, ...refs].map((r, k) => (
            <span key={k} className="mono text-[12.5px] text-lane-dim">
              <span className="text-signal">§</span> {r}
            </span>
          ))}
        </div>
      </div>

      {/* BUILD STORY */}
      <div id="build" className="scroll-mt-20">
        <BuildStory layout={layouts[0]} />
      </div>

      {/* BENTO */}
      <section id="product" className="mx-auto max-w-[1240px] scroll-mt-20 px-4 py-28 md:px-6">
        <SectionHead kicker="Product" title={<>An instrument,<br />not a dashboard template.</>} sub="Everything after the layout is computed from the same geometry — so the 3D, the money and the compliance never disagree with the plan." />
        <div className="mt-14">
          <Bento layout={layouts[0]} rotated={layouts[3]} />
        </div>
      </section>

      {/* TYPES */}
      <section id="types" className="relative scroll-mt-20 overflow-hidden border-y border-line bg-asphalt-2">
        <div className="mx-auto max-w-[1240px] px-4 py-28 md:px-6">
          <SectionHead kicker="Project types" title="One engine. Three kinds of venture." />
          <div className="mt-14 grid gap-4 md:grid-cols-3">
            {(Object.keys(TYPE_INFO) as ProjectType[]).map((t, k) => {
              const info = TYPE_INFO[t];
              return (
                <Reveal key={t} delay={k * 0.08}>
                  <a {...link(`/projects/new?type=${t}`)} className="group noise relative flex h-full flex-col overflow-hidden rounded-[18px] border border-line bg-asphalt p-7 transition-all duration-300 hover:-translate-y-1.5" style={{ ['--c' as string]: info.accent }}>
                    <div className="pointer-events-none absolute -top-20 -right-20 h-56 w-56 rounded-full opacity-25 blur-3xl transition-opacity duration-500 group-hover:opacity-60" style={{ background: info.accent }} />
                    <div className="absolute inset-0 rounded-[18px] border border-transparent transition-colors group-hover:border-[color:var(--c)]" />
                    <TypeGlyph type={t} size={96} />
                    <span className="caps mt-7 text-[10.5px]" style={{ color: info.accent }}>
                      {info.tag}
                    </span>
                    <span className="mt-1.5 text-[26px] leading-tight font-semibold tracking-tight">{info.title}</span>
                    <span className="mt-3 text-[14px] leading-relaxed text-lane-dim">{info.blurb}</span>
                    <ul className="mt-6 space-y-2 text-[13.5px]">
                      {info.bullets.map((b) => (
                        <li key={b} className="flex items-center gap-2.5">
                          <span className="flex h-4 w-4 items-center justify-center rounded-full" style={{ background: `color-mix(in srgb, ${info.accent} 22%, transparent)` }}>
                            <Icon name="check" size={10} />
                          </span>
                          {b}
                        </li>
                      ))}
                    </ul>
                    <span className="mt-auto flex items-center gap-2 pt-8 text-[14px] font-semibold">
                      Start this project
                      <span className="flex h-7 w-7 items-center justify-center rounded-full border border-line transition-all group-hover:border-[color:var(--c)] group-hover:bg-[color:var(--c)] group-hover:text-asphalt">
                        <Icon name="chevron" size={13} />
                      </span>
                    </span>
                  </a>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* RULES */}
      <section id="rules" className="mx-auto grid max-w-[1240px] scroll-mt-20 gap-14 px-4 py-28 md:grid-cols-[1fr_1.1fr] md:px-6">
        <Reveal>
          <div className="caps text-[11px] text-signal">Compliance you can cite</div>
          <h2 className="mt-2 text-[clamp(34px,5vw,68px)] leading-[0.98] font-semibold tracking-[-0.035em]">No green tick without a source.</h2>
          <p className="mt-4 max-w-[46ch] text-[15px] leading-relaxed text-lane-dim">
            {RULES.length} rules from GO 105, GO 168, HMDA guidance and the AMASR Act, each with its reference, source link and last-verified date. Where sources disagree — {Object.values(CONFLICT_GROUPS).map((g) => g.title.replace(/^(Mortgage|Open)/, (w) => w.toLowerCase())).join(", ")} — you pick, and the choice is kept with a note.
          </p>
          <div className="mt-8">
            <Cta to="/projects/new">Run the checks on your land</Cta>
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="noise relative overflow-hidden rounded-[14px] border border-line bg-asphalt-2 shadow-[0_40px_120px_-40px_rgba(63,193,217,.35)]">
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

      {/* FINAL CTA */}
      <section className="noise relative isolate overflow-hidden border-t border-line">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_70%_at_50%_100%,rgba(255,107,26,.25),transparent_70%)]" />
        <div className="pointer-events-none absolute top-1/2 left-1/2 -z-10 -translate-x-1/2 -translate-y-1/2" aria-hidden>
          {[520, 760, 1000].map((d, k) => (
            <div key={d} className={reduce ? 'absolute rounded-full border border-white/[0.06]' : 'spin-slow absolute rounded-full border border-dashed border-white/[0.07]'} style={{ width: d, height: d, left: -d / 2, top: -d / 2, animationDuration: `${60 + k * 30}s` }}>
              <span className="absolute top-0 left-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: k === 1 ? 'var(--signal)' : 'var(--blueprint)' }} />
            </div>
          ))}
        </div>
        <div className="mx-auto flex max-w-[1240px] flex-col items-center px-4 py-36 text-center md:px-6">
          <Reveal>
            <h2 className="text-[clamp(44px,8vw,120px)] leading-[0.9] font-semibold tracking-[-0.05em]">
              Your next venture,
              <br />
              <span className="sheen">drafted in seconds.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.15} className="mt-10 flex flex-wrap justify-center gap-3">
            <Cta to="/projects/new">
              <Icon name="bolt" size={17} /> Generate my layout
            </Cta>
            <Cta to="/projects" ghost>
              My projects
            </Cta>
          </Reveal>
        </div>
        <div className="text-outline pointer-events-none -mb-[2.2vw] text-center text-[19vw] leading-none font-semibold tracking-[-0.06em] select-none" aria-hidden>
          LandPlan
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-3 px-4 py-6 text-[11.5px] text-lane-dim md:px-6">
          <Wordmark />
          <span>Yield study only — not a submission drawing. Rules change by GO; verify against the current text.</span>
          <span className="flex gap-4">
            <a {...link('/docs')} className="hover:text-lane">
              User guide
            </a>
            <a href="/v1/docs" className="hover:text-lane">
              API docs
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}
