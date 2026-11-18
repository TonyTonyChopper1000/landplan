import { useProject, setSection } from '@/state/project';
import { bearingsFromPolygon, polygonFromBearings, traverseMisclose, centre } from '@/engine/parcel';
import { Button, NumberInput } from '@/components/ui/controls';
import { Icon } from '@/components/ui/Icon';

export function BearingsEditor() {
  const site = useProject((s) => s.params.site);
  const rows = site.bearings.length ? site.bearings : site.polygon ? bearingsFromPolygon(site.polygon) : [];
  const commit = (next: { bearing: number; distance: number }[]) => {
    const poly = next.length >= 3 ? centre(polygonFromBearings(next)) : site.polygon;
    setSection('site', { bearings: next, polygon: poly, source: 'table' });
  };
  const err = traverseMisclose(rows);
  return (
    <div className="space-y-1">
      <div className="caps grid grid-cols-[24px_1fr_1fr_24px] gap-1 text-[10px] text-lane-dim">
        <span>#</span>
        <span>Bearing °</span>
        <span>Distance m</span>
        <span />
      </div>
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-[24px_1fr_1fr_24px] items-center gap-1">
          <span className="num text-[11px] text-lane-dim">{i + 1}</span>
          <NumberInput label={`Bearing ${i + 1}`} value={r.bearing} step={0.01} min={0} max={360} onChange={(v) => commit(rows.map((x, j) => (j === i ? { ...x, bearing: v } : x)))} />
          <NumberInput label={`Distance ${i + 1}`} value={r.distance} step={0.01} min={0} onChange={(v) => commit(rows.map((x, j) => (j === i ? { ...x, distance: v } : x)))} />
          <button type="button" aria-label={`Delete leg ${i + 1}`} className="text-lane-dim hover:text-brake-ink" onClick={() => commit(rows.filter((_, j) => j !== i))}>
            <Icon name="close" size={12} />
          </button>
        </div>
      ))}
      <div className="flex items-center justify-between pt-1">
        <Button size="sm" variant="outline" onClick={() => commit([...rows, { bearing: 0, distance: 50 }])}>
          <Icon name="plus" size={12} /> Add leg
        </Button>
        <span className={`num text-[11px] ${err > 0.5 ? 'text-brake-ink' : 'text-lane-dim'}`}>misclose {err.toFixed(2)} m</span>
      </div>
      <p className="text-[11px] text-lane-dim">Whole-circle bearings clockwise from north. The last leg closes the traverse.</p>
    </div>
  );
}
