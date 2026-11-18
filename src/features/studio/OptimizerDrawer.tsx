import { useMemo } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis, Cell } from 'recharts';
import { applyCandidate, cancelOptimizer, startOptimizer, useOptimizer } from '@/state/optimizer';
import { useUi } from '@/state/ui';
import { BL_FACTORS, THETAS, type Candidate } from '@/engine/optimize';
import { Button, Caps } from '@/components/ui/controls';
import { Icon } from '@/components/ui/Icon';
import { fmtInt } from '@/lib/format';
import { t } from '@/i18n';

function Heatmap({ results, best }: { results: Candidate[]; best: Candidate | null }) {
  const reduce = useReducedMotion();
  const cells = useMemo(() => {
    const m = new Map<string, Candidate>();
    for (const r of results) {
      const k = `${r.theta}|${r.blFactor}`;
      const cur = m.get(k);
      if (!cur || r.plotted > cur.plotted) m.set(k, r);
    }
    return m;
  }, [results]);
  const vals = [...cells.values()].map((c) => c.plotted);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const cw = 20;
  const ch = 26;
  return (
    <div className="overflow-x-auto">
      <svg width={THETAS.length * cw + 52} height={BL_FACTORS.length * ch + 24} role="img" aria-label={t('optimizer.heatmap')}>
        {[...BL_FACTORS].sort((a, b) => a - b).map((f, j) => (
          <text key={f} x={46} y={j * ch + ch / 2 + 4} textAnchor="end" fontSize={10} className="mono" fill="var(--lane-dim)">
            ×{f}
          </text>
        ))}
        {THETAS.map((th, i) =>
          i % 3 === 0 ? (
            <text key={th} x={52 + i * cw + cw / 2} y={BL_FACTORS.length * ch + 14} textAnchor="middle" fontSize={10} className="mono" fill="var(--lane-dim)">
              {th}°
            </text>
          ) : null,
        )}
        {[...BL_FACTORS].sort((a, b) => a - b).map((f, j) =>
          THETAS.map((th, i) => {
            const c = cells.get(`${th}|${f}`);
            const k = c && hi > lo ? (c.plotted - lo) / (hi - lo) : 0;
            const isBest = best && c && best.theta === th && best.blFactor === f;
            return (
              <motion.rect
                key={`${th}-${f}`}
                x={52 + i * cw + 1}
                y={j * ch + 1}
                width={cw - 2}
                height={ch - 2}
                rx={2}
                initial={false}
                animate={{ opacity: c ? 1 : 0.25 }}
                transition={{ duration: reduce ? 0 : 0.25 }}
                fill={c ? `color-mix(in srgb, var(--signal) ${Math.round(12 + k * 88)}%, var(--asphalt-3))` : 'var(--asphalt-3)'}
                stroke={isBest ? 'var(--lane)' : 'none'}
                strokeWidth={isBest ? 1.5 : 0}
                className={isBest && !reduce ? 'pulse-outline' : undefined}
                style={{ cursor: c ? 'pointer' : 'default' }}
                onClick={() => c && applyCandidate(c)}
              >
                <title>{c ? `θ ${th}°, block ×${f}: ${fmtInt(c.plotted)} m² plotted, ${c.plots} plots` : 'pending'}</title>
              </motion.rect>
            );
          }),
        )}
      </svg>
    </div>
  );
}

function Pareto({ results }: { results: Candidate[] }) {
  const data = results.map((r) => ({ ...r, yieldPct: r.plotted }));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <ScatterChart margin={{ top: 8, right: 8, bottom: 16, left: 4 }}>
        <CartesianGrid stroke="var(--line)" strokeDasharray="2 4" />
        <XAxis type="number" dataKey="plotted" name="Plotted" tick={{ fill: 'var(--lane-dim)', fontSize: 10 }} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} domain={['auto', 'auto']} label={{ value: 'plotted m²', position: 'insideBottom', offset: -8, fill: 'var(--lane-dim)', fontSize: 10 }} />
        <YAxis type="number" dataKey="margin" name="Margin" tick={{ fill: 'var(--lane-dim)', fontSize: 10 }} tickFormatter={(v: number) => `${v.toFixed(0)}%`} domain={['auto', 'auto']} width={36} />
        <ZAxis range={[18, 18]} />
        <Tooltip
          cursor={{ stroke: 'var(--line)' }}
          contentStyle={{ background: 'var(--asphalt-2)', border: '1px solid var(--line)', borderRadius: 4, fontSize: 11 }}
          formatter={(v, n) => (n === 'Margin' ? `${Number(v).toFixed(1)}%` : fmtInt(Number(v)))}
        />
        <Scatter data={data} onClick={(d: unknown) => applyCandidate(d as Candidate)} cursor="pointer" isAnimationActive={false}>
          {data.map((d) => (
            <Cell key={d.idx} fill={d.failing === 0 ? 'var(--sign-green)' : d.failing <= 2 ? 'var(--band-1)' : 'var(--brake)'} fillOpacity={0.75} />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}

export function OptimizerDrawer() {
  const { running, done, total, results, best, ms, error, where } = useOptimizer();
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <div>
          <Caps>{t('optimizer.title')}</Caps>
          <div className="num text-[11px] text-lane-dim">
            {done}/{total} layouts · {(ms / 1000).toFixed(2)} s {running ? (where === 'server' ? '· running on the server (large site)' : '· running in worker') : where === 'server' ? '· solved on the server' : ''}
          </div>
        </div>
        <div className="flex gap-1">
          {running ? (
            <Button size="sm" variant="outline" onClick={cancelOptimizer}>
              {t('optimizer.cancel')}
            </Button>
          ) : (
            <Button size="sm" variant="signal" onClick={() => void startOptimizer()}>
              <Icon name="bolt" size={13} /> Run
            </Button>
          )}
          <Button size="sm" title="Close" onClick={() => useUi.setState({ drawer: 'none' })}>
            <Icon name="close" />
          </Button>
        </div>
      </div>
      <div className="h-[2px] bg-asphalt-3">
        <div className="h-full bg-signal transition-[width] duration-150" style={{ width: `${(done / total) * 100}%` }} />
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-3">
        {error && <p className="text-[12px] text-brake-ink">{error}</p>}
        <section>
          <Caps className="pb-1">{t('optimizer.heatmap')}</Caps>
          <Heatmap results={results} best={best} />
          <p className="mt-1 text-[10.5px] text-lane-dim">Best of 9 offsets per cell. Click a cell to load it.</p>
        </section>
        {best && (
          <section className="rounded-[4px] border border-signal/50 p-2 shadow-[var(--glow-signal)]">
            <Caps>Best so far</Caps>
            <div className="num mt-1 grid grid-cols-2 gap-1 text-[12px]">
              <span>θ {best.theta}°</span>
              <span>block ×{best.blFactor}</span>
              <span>{best.plots} plots</span>
              <span>{fmtInt(best.plotted)} m²</span>
            </div>
          </section>
        )}
        <section>
          <Caps className="pb-1">{t('optimizer.pareto')}</Caps>
          {results.length ? <Pareto results={results} /> : <div className="skeleton h-[200px] rounded-[4px]" />}
          <div className="mt-1 flex gap-3 text-[10.5px] text-lane-dim">
            <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-sign-green" />0 failing</span>
            <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full" style={{ background: 'var(--band-1)' }} />1–2</span>
            <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-brake" />3+</span>
          </div>
        </section>
      </div>
    </div>
  );
}
