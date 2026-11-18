import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import * as Comlink from 'comlink';
import { link, navigate } from '@/router';
import { generate } from '@/engine/layout';
import { compute } from '@/state/derived';
import type { Candidate } from '@/engine/optimize';
import type { OptimizerApi } from '@/engine/worker';
import type { Layout, Params } from '@/engine/types';
import { bbox } from '@/engine/geometry';
import { Icon } from '@/components/ui/Icon';
import { cx } from '@/components/ui/controls';
import { StaticPlan } from '@/features/compare/StaticPlan';
import { fmtInt } from '@/lib/format';
import { PageChrome } from './PageChrome';
import { TypeGlyph } from './TypeGlyph';
import { PlanStep, SiteStep } from './WizardFields';
import { createProject, newId } from './repo';
import { TYPE_INFO, defaultDetails, paramsFor, type ProjectDetails, type ProjectType } from './types';

const STEPS = ['Type', 'Site', 'Plan', 'Generate'] as const;

function Stepper({ step }: { step: number }) {
  return (
    <ol className="flex items-center gap-2" aria-label="Progress">
      {STEPS.map((s, i) => (
        <li key={s} className="flex items-center gap-2">
          <span className={cx('flex h-6 w-6 items-center justify-center rounded-full border text-[11px] mono', i < step ? 'border-sign-green bg-sign-green/20 text-green-ink' : i === step ? 'border-signal text-signal-ink' : 'border-line text-lane-dim')}>{i < step ? '✓' : i + 1}</span>
          <span className={cx('hidden text-[12px] sm:inline', i === step ? 'text-lane' : 'text-lane-dim')}>{s}</span>
          {i < STEPS.length - 1 && <span className="h-px w-6 bg-line md:w-10" />}
        </li>
      ))}
    </ol>
  );
}

type Gen = { done: number; total: number; best: Candidate | null; preview: Layout | null; phase: 'idle' | 'running' | 'saving' | 'error'; error?: string };

export function NewProject() {
  const [step, setStep] = useState(0);
  const initialType = (new URLSearchParams(window.location.search).get('type') as ProjectType | null) ?? 'plots';
  const startType: ProjectType = initialType in TYPE_INFO ? initialType : 'plots';
  const [type, setType] = useState<ProjectType>(startType);
  const [name, setName] = useState('');
  const [details, setDetails] = useState<ProjectDetails>(defaultDetails(startType));
  const [gen, setGen] = useState<Gen>({ done: 0, total: 486, best: null, preview: null, phase: 'idle' });
  const worker = useRef<Worker | null>(null);
  const reduce = useReducedMotion();
  useEffect(() => () => worker.current?.terminate(), []);
  const set = (p: Partial<ProjectDetails>) => setDetails((d) => ({ ...d, ...p }));
  const pickType = (t: ProjectType) => {
    setType(t);
    setDetails(defaultDetails(t));
  };
  const params = useMemo(() => paramsFor(type, name.trim() || 'Untitled layout', details), [type, name, details]);
  const quick = useMemo(() => {
    try {
      const l = generate(params);
      return { plots: l.plots.length, saleable: (l.plotted / l.gross) * 100 };
    } catch {
      return null;
    }
  }, [params]);
  const canNext = step === 1 ? name.trim().length > 0 && details.acres > 0 : true;

  const run = async () => {
    setGen({ done: 0, total: 486, best: null, preview: null, phase: 'running' });
    worker.current?.terminate();
    const w = new Worker(new URL('../../engine/worker.ts', import.meta.url), { type: 'module' });
    worker.current = w;
    const api = Comlink.wrap<OptimizerApi>(w);
    const withGrid = (c: Candidate): Params => ({ ...params, grid: { theta: c.theta, blockLenFactor: c.blFactor, offX: c.offX, offY: c.offY } });
    try {
      let shownBest: Candidate | null = null;
      const best = await api.run(
        params,
        Comlink.proxy((batch: Candidate[], done: number, total: number) => {
          setGen((g) => {
            let b = g.best;
            for (const c of batch) if (!b || c.plotted > b.plotted + 1e-9) b = c;
            let preview = g.preview;
            if (b && b !== shownBest) {
              shownBest = b;
              preview = generate(withGrid(b));
            }
            return { ...g, done, total, best: b, preview };
          });
        }),
      );
      setGen((g) => ({ ...g, phase: 'saving', best, done: g.total }));
      const final = withGrid(best);
      const d = compute(final);
      const t = new Date().toISOString();
      const meta = await createProject(
        {
          id: newId('prj'),
          name: name.trim() || 'Untitled layout',
          type,
          details,
          summary: d.layout && d.fin ? { plots: d.layout.plots.length, saleablePct: (d.layout.plotted / d.layout.gross) * 100, revenue: d.fin.revenue, marginPct: d.fin.marginPct, failing: d.tally.failing, gross: d.layout.gross, generatedAt: t } : null,
          activeScenario: null,
          createdAt: t,
          updatedAt: t,
        },
        final,
      );
      navigate(`/projects/${meta.id}`);
    } catch (e) {
      setGen((g) => ({ ...g, phase: 'error', error: e instanceof Error ? e.message : String(e) }));
    } finally {
      w.terminate();
    }
  };

  const view = gen.preview ? bbox(gen.preview.parcel) : null;
  return (
    <PageChrome right={<a {...link('/projects')} className="text-[12.5px] text-lane-dim hover:text-lane">Cancel</a>}>
      <main className="mx-auto max-w-[980px] px-4 py-8 md:px-6 md:py-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="caps text-[11px] text-blueprint">New project</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">{['What are you planning?', 'Tell us about the land', 'Rates and rules', 'Ready to generate'][step]}</h1>
          </div>
          <Stepper step={step} />
        </div>

        <AnimatePresence mode="wait">
          <motion.section key={step} initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? undefined : { opacity: 0, y: -6 }} transition={{ duration: 0.2 }} className="mt-8">
            {step === 0 && (
              <div className="grid gap-4 md:grid-cols-3">
                {(Object.keys(TYPE_INFO) as ProjectType[]).map((t) => {
                  const info = TYPE_INFO[t];
                  const on = type === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={on}
                      onClick={() => pickType(t)}
                      onDoubleClick={() => {
                        pickType(t);
                        setStep(1);
                      }}
                      className={cx('group flex flex-col rounded-[6px] border p-5 text-left transition-all', on ? 'border-signal bg-signal/[0.06] shadow-[var(--glow-signal)]' : 'border-line bg-asphalt-2 hover:border-lane-dim')}
                    >
                      <div className="flex items-start justify-between">
                        <TypeGlyph type={t} size={64} />
                        <span className={cx('flex h-5 w-5 items-center justify-center rounded-full border', on ? 'border-signal bg-signal text-[#140800]' : 'border-line')}>{on && <Icon name="check" size={12} />}</span>
                      </div>
                      <span className="caps mt-4 text-[10.5px]" style={{ color: info.accent }}>
                        {info.tag}
                      </span>
                      <span className="mt-1 text-[17px] font-semibold">{info.title}</span>
                      <span className="mt-1.5 text-[12.5px] text-lane-dim">{info.blurb}</span>
                      <ul className="mt-4 space-y-1 text-[12px]">
                        {info.bullets.map((b) => (
                          <li key={b} className="flex items-center gap-2">
                            <i className="h-1 w-1 rounded-full" style={{ background: info.accent }} />
                            {b}
                          </li>
                        ))}
                      </ul>
                    </button>
                  );
                })}
              </div>
            )}
            {step === 1 && <SiteStep name={name} setName={setName} d={details} set={set} />}
            {step === 2 && <PlanStep type={type} d={details} set={set} />}
            {step === 3 && (
              <div className="grid gap-6 md:grid-cols-[1fr_1.2fr]">
                <div className="space-y-4">
                  <div className="rounded-[6px] border border-line bg-asphalt-2 p-4">
                    <div className="flex items-center gap-3">
                      <TypeGlyph type={type} size={44} />
                      <div>
                        <div className="text-[15px] font-semibold">{name.trim() || 'Untitled layout'}</div>
                        <div className="text-[12px] text-lane-dim">{TYPE_INFO[type].title}</div>
                      </div>
                    </div>
                    <dl className="num mt-4 grid grid-cols-2 gap-y-1.5 text-[12.5px]">
                      <dt className="text-lane-dim">Location</dt>
                      <dd>{details.location || '—'}</dd>
                      <dt className="text-lane-dim">Survey nos.</dt>
                      <dd>{details.surveyNos || '—'}</dd>
                      <dt className="text-lane-dim">Authority</dt>
                      <dd>{details.authority}</dd>
                      <dt className="text-lane-dim">Extent</dt>
                      <dd>
                        {details.acres} ac {details.guntas} gn
                      </dd>
                      <dt className="text-lane-dim">Rate</dt>
                      <dd>₹{fmtInt(details.baseRate)}/sq yd</dd>
                      <dt className="text-lane-dim">Engine</dt>
                      <dd>{details.ruleAware ? 'Rule-aware (GO 105)' : 'v1 parity'}</dd>
                    </dl>
                    {quick && (
                      <p className="mt-3 border-t border-line pt-3 text-[12px] text-lane-dim">
                        First pass: <span className="num text-lane">{quick.plots}</span> plots · <span className="num text-blueprint">{quick.saleable.toFixed(1)}%</span> saleable. Generate searches 486 grid layouts for the best yield.
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={gen.phase === 'running' || gen.phase === 'saving'}
                    onClick={() => void run()}
                    className="group relative flex h-14 w-full items-center justify-center gap-2 overflow-hidden rounded-[6px] bg-signal text-[16px] font-semibold text-[#140800] shadow-[var(--glow-signal)] transition-[filter] hover:brightness-110 disabled:cursor-wait"
                  >
                    {gen.phase === 'running' && <span className="absolute inset-y-0 left-0 bg-white/25 transition-[width]" style={{ width: `${(gen.done / gen.total) * 100}%` }} />}
                    <Icon name="bolt" size={18} />
                    <span className="relative">{gen.phase === 'running' ? `Generating… ${gen.done}/${gen.total}` : gen.phase === 'saving' ? 'Saving project…' : 'Generate layout'}</span>
                  </button>
                  {gen.phase === 'error' && <p className="text-[12.5px] text-brake-ink">Generation failed: {gen.error}</p>}
                </div>
                <div className="drafting-grid relative aspect-[4/3] overflow-hidden rounded-[6px] border border-line">
                  {gen.preview && view ? (
                    <StaticPlan layout={gen.preview} view={view} label="Best layout so far" />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-[12.5px] text-lane-dim">
                      <TypeGlyph type={type} size={72} />
                      <span className="mt-3">The best layout appears here as the search runs.</span>
                    </div>
                  )}
                  {gen.best && (
                    <div className="num absolute right-2 bottom-2 left-2 flex justify-between rounded-[4px] bg-asphalt/85 px-3 py-2 text-[12px] backdrop-blur">
                      <span>θ {gen.best.theta}°</span>
                      <span>{gen.best.plots} plots</span>
                      <span>{fmtInt(gen.best.plotted)} m²</span>
                      <span className="text-signal-ink">{gen.best.margin ? `${gen.best.margin.toFixed(1)}% margin` : ''}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.section>
        </AnimatePresence>

        {step < 3 && (
          <div className="mt-10 flex items-center justify-between border-t border-line pt-5">
            <button type="button" onClick={() => (step === 0 ? navigate('/projects') : setStep(step - 1))} className="inline-flex h-10 items-center gap-1.5 rounded-[4px] px-3 text-[13px] text-lane-dim hover:bg-asphalt-3 hover:text-lane">
              <Icon name="chevron" size={14} className="rotate-180" /> {step === 0 ? 'Projects' : 'Back'}
            </button>
            <button type="button" disabled={!canNext} onClick={() => setStep(step + 1)} className="inline-flex h-10 items-center gap-1.5 rounded-[4px] border border-blueprint/60 px-4 text-[13.5px] font-medium text-blueprint shadow-[var(--glow-blue)] hover:bg-blueprint/10 disabled:opacity-40">
              Continue <Icon name="chevron" size={14} />
            </button>
          </div>
        )}
        {step === 3 && gen.phase === 'idle' && (
          <div className="mt-6">
            <button type="button" onClick={() => setStep(2)} className="text-[12.5px] text-lane-dim hover:text-lane">
              ← Back to rates and rules
            </button>
          </div>
        )}
        <p className="mt-10 text-[11px] text-lane-dim">Revenue figures use your rate and are indicative. Yield study only — not a submission drawing.</p>
      </main>
    </PageChrome>
  );
}
