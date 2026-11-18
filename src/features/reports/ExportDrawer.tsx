import { useMemo } from 'react';
import { useDerived } from '@/state/derived';
import { useUi } from '@/state/ui';
import { Button, Caps } from '@/components/ui/controls';
import { Icon } from '@/components/ui/Icon';
import { t } from '@/i18n';
import { runExport, type ExportKind } from './exports';
import { drawingSheet } from './planSvg';

const ITEMS: { kind: ExportKind; title: string; body: string }[] = [
  { kind: 'pdf', title: 'PDF report', body: 'A3 drawing sheet with title block, then area statement, checks, financials and schedule.' },
  { kind: 'svg', title: 'SVG plan', body: 'Vector plan in metres.' },
  { kind: 'dxf', title: 'DXF plan', body: 'Layered polylines in metres for CAD.' },
  { kind: 'xlsx', title: 'XLSX schedule', body: 'Plot schedule + area statement sheets.' },
  { kind: 'csv', title: 'CSV schedule', body: 'Plain plot schedule.' },
  { kind: 'geojson', title: 'GeoJSON', body: 'Parcel, plots, open space, buffers and roads in WGS84 around the site anchor.' },
];

export function ExportDrawer() {
  const layout = useDerived((s) => s.layout);
  const preview = useMemo(() => (layout ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(drawingSheet(layout))}` : null), [layout]);
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <Caps>{t('top.export')}</Caps>
        <Button size="sm" title="Close" onClick={() => useUi.setState({ drawer: 'none' })}>
          <Icon name="close" />
        </Button>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {preview && (
          <figure>
            <img src={preview} alt="Drawing sheet preview" className="w-full rounded-[3px] border border-line" />
            <figcaption className="mt-1 text-[10.5px] text-lane-dim">Drawing-sheet preview (A3). {t('app.disclaimer')}.</figcaption>
          </figure>
        )}
        {ITEMS.map((i) => (
          <button key={i.kind} type="button" onClick={() => void runExport(i.kind)} className="flex w-full items-start gap-3 rounded-[4px] border border-line p-2.5 text-left hover:border-blueprint">
            <span className="mono mt-0.5 w-12 shrink-0 text-[11px] font-semibold text-blueprint">{i.kind.toUpperCase()}</span>
            <span>
              <span className="block text-[12.5px] font-medium">{i.title}</span>
              <span className="block text-[11px] text-lane-dim">{i.body}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
