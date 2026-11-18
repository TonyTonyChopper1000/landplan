import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { optimize, BL_FACTORS, THETAS, type Candidate } from '@/engine/optimize';
import { runChecks, tally } from '@/engine/checks';
import { finance } from '@/engine/finance';
import { DIRS, type Layout } from '@/engine/types';
import { Icon } from '@/components/ui/Icon';
import { crore } from '@/lib/format';

function Tile({ children, className = '', title, kicker, icon }: { children: ReactNode; className?: string; title: string; kicker: string; icon: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.55, ease: [0.2, 0.8, 0.2, 1] }}
      className={`group noise relative flex flex-col overflow-hidden rounded-[14px] border border-line bg-asphalt-2 p-5 transition-colors hover:border-lane-dim/60 ${className}`}
    >
      <div className="pointer-events-none absolute -top-24 -right-24 h-48 w-48 rounded-full bg-blueprint/10 blur-3xl transition-opacity group-hover:opacity-100 md:opacity-0" />
      <div className="relative min-h-0 flex-1">{children}</div>
      <div className="relative mt-4">
        <div className="caps flex items-center gap-1.5 text-[10px] text-blueprint">
          <Icon name={icon} size={12} /> {kicker}
        </div>
        <h3 className="mt-1 text-[17px] font-semibold tracking-tight">{title}</h3>
      </div>
    </motion.div>
  );
}

function Heatmap({ layout }: { layout: Layout }) {
  const [cells, setCells] = useState<Candidate[] | null>(null);
  useEffect(() => {
    const t = window.setTimeout(() => setCells(optimize(layout.params).all), 400);
    return () => window.clearTimeout(t);
  }, [layout]);
  const best = useMemo(() => {
    if (!cells) return null;
    const m = new Map<string, number>();
    for (const c of cells) m.set(`${c.theta}|${c.blFactor}`, Math.max(m.get(`${c.theta}|${c.blFactor}`) ?? 0, c.plotted));
    return m;
  }, [cells]);
  const vals = best ? [...best.values()] : [0];
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const rows = [...BL_FACTORS].sort((a, b) => a - b);
  return (
    <div className="grid h-full grid-rows-3 gap-1">
      {rows.map((f, j) => (
        <div key={f} className="grid gap-1" style={{ gridTemplateColumns: `repeat(${THETAS.length}, minmax(0,1fr))` }}>
          {THETAS.map((th, i) => {
            const v = best?.get(`${th}|${f}`);
            const k = v !== undefined && hi > lo ? (v - lo) / (hi - lo) : 0;
            const top = v !== undefined && v === hi;
            return (
              <motion.div
                key={th}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={best ? { opacity: 1, scale: 1 } : {}}
                transition={{ delay: (i + j * 6) * 0.012, duration: 0.25 }}
                className={`rounded-[3px] ${top ? 'pulse-outline outline-2 outline-lane' : ''}`}
                style={{ background: `color-mix(in srgb, var(--signal) ${Math.round(10 + k * 90)}%, var(--asphalt-3))`, minHeight: 18 }}
                title={v ? `θ ${th}°, ×${f}: ${Math.round(v)} m²` : ''}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

function Ring({ layout }: { layout: Layout }) {
  const t = useMemo(() => tally(runChecks(layout)), [layout]);
  const segs = [
    { v: t.verified, c: 'var(--sign-green)' },
    { v: t.failing, c: 'var(--brake)' },
    { v: t.conflict, c: 'var(--conflict)' },
    { v: t.notChecked, c: 'var(--unk)' },
  ];
  const r = 54;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="flex h-full items-center justify-center gap-5">
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={r} fill="none" stroke="var(--line)" strokeWidth="12" />
        {segs.map((s, i) => {
          const len = (s.v / Math.max(1, t.total)) * c;
          const off = acc;
          acc += len;
          return (
            <motion.circle key={i} cx="70" cy="70" r={r} fill="none" stroke={s.c} strokeWidth="12" transform="rotate(-90 70 70)" initial={{ strokeDasharray: `0 ${c}` }} whileInView={{ strokeDasharray: `${Math.max(0, len - 2)} ${c}` }} viewport={{ once: true }} transition={{ duration: 0.9, delay: 0.2 + i * 0.15 }} strokeDashoffset={-off} />
          );
        })}
        <text x="70" y="68" textAnchor="middle" fontSize="28" className="mono" fill="var(--lane)">
          {t.verified}
        </text>
        <text x="70" y="88" textAnchor="middle" fontSize="10" fill="var(--lane-dim)">
          verified
        </text>
      </svg>
      <ul className="mono space-y-1 text-[11px]">
        <li className="text-green-ink">{t.verified} pass</li>
        <li className="text-brake-ink">{t.failing} fail</li>
        <li className="text-blueprint">{t.conflict} conflict</li>
        <li className="text-lane-dim">{t.notChecked} n/a</li>
      </ul>
    </div>
  );
}

function CashFlow({ layout }: { layout: Layout }) {
  const f = useMemo(() => finance({ ...layout, params: { ...layout.params, money: { ...layout.params.money, landCost: 15000000 } } }), [layout]);
  const pts = f.months.map((m) => m.cumulative);
  const min = Math.min(0, ...pts);
  const max = Math.max(...pts);
  const W = 300;
  const H = 110;
  const x = (i: number) => (i / Math.max(1, pts.length - 1)) * W;
  const y = (v: number) => H - ((v - min) / (max - min || 1)) * H;
  const d = pts.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join('');
  return (
    <div className="flex h-full flex-col">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full flex-1" preserveAspectRatio="none">
        <defs>
          <linearGradient id="cf" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--signal)" stopOpacity=".45" />
            <stop offset="1" stopColor="var(--signal)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1="0" x2={W} y1={y(0)} y2={y(0)} stroke="var(--line)" strokeDasharray="3 4" />
        <path d={`${d}L${W} ${H}L0 ${H}Z`} fill="url(#cf)" />
        <motion.path d={d} fill="none" stroke="var(--signal)" strokeWidth="2" vectorEffect="non-scaling-stroke" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 1.4 }} />
      </svg>
      <div className="mono mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <span>
          <span className="text-lane-dim">Margin </span>
          {f.marginPct.toFixed(0)}%
        </span>
        <span>
          <span className="text-lane-dim">NPV </span>
          {crore(f.npv)}
        </span>
        <span>
          <span className="text-lane-dim">Peak </span>
          {crore(f.peakFunding)}
        </span>
      </div>
    </div>
  );
}

function Villas() {
  const reduce = useReducedMotion();
  const cubes = Array.from({ length: 12 }, (_, i) => 16 + ((i * 37) % 3) * 9);
  return (
    <div className="flex h-full items-center justify-center [perspective:800px]">
      <div className="grid grid-cols-4 gap-4 [transform:rotateX(60deg)_rotateZ(-40deg)] [transform-style:preserve-3d]">
        {cubes.map((h, i) => (
          <div key={i} className="relative h-11 w-11 [transform-style:preserve-3d]">
            <div className="absolute inset-0" style={{ background: 'color-mix(in srgb, var(--band-3) 18%, transparent)', outline: '1px solid color-mix(in srgb, var(--band-3) 55%, transparent)' }} />
            <motion.div
              className="absolute inset-[5px] [transform-style:preserve-3d]"
              style={{ transformOrigin: 'center center 0px' }}
              initial={reduce ? false : { scaleZ: 0.02 }}
              whileInView={{ scaleZ: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.9, delay: 0.15 + i * 0.06, ease: [0.2, 0.8, 0.2, 1] }}
            >
              {/* roof */}
              <div className="absolute inset-0 bg-[#f1ece2]" style={{ transform: `translateZ(${h}px)` }} />
              {/* front wall (stands on the bottom edge) */}
              <div className="absolute inset-x-0 bottom-0 bg-[#b9b2a3]" style={{ height: h, transformOrigin: 'bottom', transform: 'rotateX(-90deg)' }} />
              {/* right wall (stands on the right edge) */}
              <div className="absolute inset-y-0 right-0 bg-[#d6cfc0]" style={{ width: h, transformOrigin: 'right', transform: 'rotateY(90deg)' }} />
            </motion.div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Compass({ layout }: { layout: Layout }) {
  const counts = DIRS.map((d) => layout.plots.filter((p) => p.facing === d).length);
  const max = Math.max(1, ...counts);
  return (
    <div className="flex h-full items-center justify-center">
      <svg width="150" height="150" viewBox="-75 -75 150 150">
        <circle r="60" fill="none" stroke="var(--line)" />
        <circle r="30" fill="none" stroke="var(--line)" strokeDasharray="2 3" />
        {DIRS.map((d, i) => {
          const a = (i * 45 - 90) * (Math.PI / 180);
          const r = 14 + (counts[i] / max) * 46;
          return (
            <g key={d}>
              <motion.line x1="0" y1="0" initial={{ x2: 0, y2: 0 }} whileInView={{ x2: Math.cos(a) * r, y2: Math.sin(a) * r }} viewport={{ once: true }} transition={{ duration: 0.7, delay: i * 0.05 }} stroke={d === 'E' || d === 'NE' ? 'var(--signal)' : 'var(--blueprint)'} strokeWidth="5" strokeLinecap="round" />
              <text x={Math.cos(a) * 70} y={Math.sin(a) * 70 + 3} textAnchor="middle" fontSize="8" className="mono" fill="var(--lane-dim)">
                {d}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function Exports() {
  const files = [
    { e: 'PDF', c: 'var(--signal)' },
    { e: 'DXF', c: 'var(--blueprint)' },
    { e: 'XLSX', c: 'var(--sign-green)' },
    { e: 'SVG', c: 'var(--band-1)' },
    { e: 'CSV', c: 'var(--band-3)' },
    { e: 'GEOJSON', c: 'var(--lane-dim)' },
  ];
  return (
    <div className="relative flex h-full items-center justify-center">
      {files.map((f, i) => (
        <div
          key={f.e}
          className="absolute flex h-24 w-[72px] flex-col justify-end rounded-[6px] border border-line bg-asphalt p-2 shadow-xl transition-transform duration-500 group-hover:![transform:var(--t2)]"
          style={{ ['--t2' as string]: `translateX(${(i - 2.5) * 46}px) rotate(${(i - 2.5) * 6}deg)`, transform: `translateX(${(i - 2.5) * 14}px) rotate(${(i - 2.5) * 4}deg)` }}
        >
          <div className="mb-auto h-1.5 w-8 rounded-full" style={{ background: f.c }} />
          <span className="mono text-[10px] font-semibold" style={{ color: f.c }}>
            .{f.e.toLowerCase()}
          </span>
        </div>
      ))}
    </div>
  );
}

function Trace() {
  const pts: [number, number][] = [
    [30, 90],
    [120, 40],
    [230, 70],
    [260, 150],
    [150, 175],
    [60, 160],
  ];
  return (
    <div className="relative h-full overflow-hidden rounded-[8px] bg-[radial-gradient(circle_at_30%_30%,#2b3a2a,#1a2320_60%,#121614)]">
      <div className="absolute inset-0 opacity-40 [background:repeating-linear-gradient(115deg,transparent_0_14px,rgba(255,255,255,.04)_14px_15px)]" />
      <svg viewBox="0 0 300 210" className="absolute inset-0 h-full w-full">
        <motion.polygon points={pts.map((p) => p.join(',')).join(' ')} fill="rgba(63,193,217,.15)" stroke="var(--signal)" strokeWidth="2" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 2 }} />
        {pts.map(([x, y], i) => (
          <motion.circle key={i} cx={x} cy={y} r="4" fill="var(--signal)" initial={{ scale: 0 }} whileInView={{ scale: 1 }} viewport={{ once: true }} transition={{ delay: 0.3 * i }} />
        ))}
      </svg>
      <span className="mono absolute bottom-2 left-2 rounded-[3px] bg-black/50 px-1.5 py-0.5 text-[10px] text-white/80">17.385°N 78.487°E</span>
    </div>
  );
}

export function Bento({ layout, rotated }: { layout: Layout; rotated?: Layout }) {
  return (
    <div className="grid auto-rows-[260px] gap-3 md:grid-cols-6">
      <Tile className="md:col-span-4" kicker="Optimizer" icon="bolt" title="486 layouts searched, the winner pulses">
        <Heatmap layout={layout} />
      </Tile>
      <Tile className="md:col-span-2" kicker="Compliance" icon="shield" title="Every tick has a GO behind it">
        <Ring layout={layout} />
      </Tile>
      <Tile className="md:col-span-2" kicker="3D massing" icon="cube" title="Villas rise with their setbacks">
        <Villas />
      </Tile>
      <Tile className="md:col-span-2" kicker="Finance" icon="chart" title="Cash flow, NPV, peak funding">
        <CashFlow layout={layout} />
      </Tile>
      <Tile className="md:col-span-2" kicker="Pricing" icon="target" title="Facing premiums, plot by plot">
        <Compass layout={rotated ?? layout} />
      </Tile>
      <Tile className="md:col-span-3" kicker="Site" icon="map" title="Trace the land on satellite">
        <Trace />
      </Tile>
      <Tile className="md:col-span-3" kicker="Exports" icon="download" title="Drawing sheet to DXF in one click">
        <Exports />
      </Tile>
    </div>
  );
}
