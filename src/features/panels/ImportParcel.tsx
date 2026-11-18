import { useState } from 'react';
import { setSection, useProject } from '@/state/project';
import { centre } from '@/engine/parcel';
import { ensureCCW, type Pt } from '@/engine/geometry';
import { parseParcelFile } from '@/features/reports/importers';

export function ImportParcel() {
  const anchor = useProject((s) => s.params.site.anchor);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="space-y-1.5 text-[12px]">
      <label className="flex h-16 cursor-pointer flex-col items-center justify-center rounded-[4px] border border-dashed border-line text-lane-dim hover:border-blueprint hover:text-blueprint">
        <span>Drop or choose GeoJSON, KML or DXF</span>
        <span className="text-[11px]">The first closed polygon is used</span>
        <input
          type="file"
          accept=".geojson,.json,.kml,.dxf"
          className="sr-only"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              const r = parseParcelFile(f.name, await f.text(), anchor);
              const poly: Pt[] = centre(ensureCCW(r.points));
              setSection('site', { polygon: poly, source: 'import', ...(r.anchor ? { anchor: r.anchor } : {}) });
              setMsg(`Imported ${poly.length} vertices from ${f.name}`);
            } catch (err) {
              setMsg(err instanceof Error ? err.message : 'Could not read that file');
            }
          }}
        />
      </label>
      {msg && <p className="text-[11px] text-lane-dim">{msg}</p>}
    </div>
  );
}
