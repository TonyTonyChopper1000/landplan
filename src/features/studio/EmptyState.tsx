import { useMemo } from 'react';
import { generate } from '@/engine/layout';
import type { ParamPatch } from '@/engine/checks';
import type { Params } from '@/engine/types';
import { applyPatch } from '@/lib/patch';
import { applyFix } from '@/state/actions';
import { Button } from '@/components/ui/controls';
import { t } from '@/i18n';

/** Try likely parameter changes and offer the three that yield the most plots. */
export function NoPlots({ params }: { params: Params }) {
  const fixes = useMemo(() => {
    const tries: { label: string; patch: ParamPatch }[] = [
      { label: 'Shorten blocks to 90 m', patch: { plots: { blockLen: 90 } } },
      { label: 'Plot depth 45 ft', patch: { plots: { depthFt: 45 } } },
      { label: 'Turn on all plot sizes', patch: { plots: { sizes: params.plots.sizes.map((s) => ({ ...s, on: true, weight: Math.max(1, s.weight) })) } } },
      { label: 'Remove boundary road', patch: { roads: { boundary: 0 } } },
      { label: 'Roads 9 m', patch: { roads: { frontage: 9, spine: 9 } } },
      { label: 'Lower min plot to 50 m²', patch: { plots: { minPlotM2: 50, minWidth: 0 } } },
      { label: 'Open space 10%', patch: { open: { total: 10, park: 10, util: 0, social: 0 } } },
    ];
    return tries
      .map((f) => ({ ...f, plots: generate(applyPatch(params, f.patch)).plots.length }))
      .filter((f) => f.plots > 0)
      .sort((a, b) => b.plots - a.plots)
      .slice(0, 3);
  }, [params]);
  return (
    <div className="absolute inset-0 flex items-center justify-center p-6">
      <div className="max-w-sm rounded-[4px] border border-line bg-asphalt-2/95 p-4 backdrop-blur">
        <h3 className="text-[15px] font-semibold">{t('empty.noPlots.title')}</h3>
        <p className="mt-1 text-[12px] text-lane-dim">{t('empty.noPlots.body')}</p>
        <div className="mt-3 flex flex-col gap-1.5">
          {fixes.map((f) => (
            <Button key={f.label} variant="outline" className="justify-between" onClick={() => applyFix(f.patch, f.label)}>
              <span>{f.label}</span>
              <span className="num text-blueprint">{f.plots} plots</span>
            </Button>
          ))}
          {!fixes.length && <p className="text-[12px] text-lane-dim">Try a larger extent in the Site panel.</p>}
        </div>
      </div>
    </div>
  );
}
