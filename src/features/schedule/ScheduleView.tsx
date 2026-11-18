import { useMemo, useRef, useState } from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getGroupedRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnFiltersState,
  type GroupingState,
  type SortingState,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useDerived } from '@/state/derived';
import { useProject, setParam } from '@/state/project';
import { useUi } from '@/state/ui';
import { plotPrice } from '@/engine/finance';
import { SQYD } from '@/engine/geometry';
import type { PlotStatus } from '@/engine/types';
import { runExport } from '@/features/reports/exports';
import { statusOf } from '@/features/studio/Inspector';
import { Button, Segmented } from '@/components/ui/controls';
import { Icon } from '@/components/ui/Icon';
import { fmtInt, rupees } from '@/lib/format';

export type Row = {
  no: number;
  size: number;
  m2: number;
  sqyd: number;
  width: number;
  depth: number;
  facing: string;
  corner: boolean;
  irregular: boolean;
  status: PlotStatus;
  mult: number;
  price: number;
  override: boolean;
};

const h = createColumnHelper<Row>();

function PriceCell({ row }: { row: Row }) {
  const [edit, setEdit] = useState(false);
  if (!edit)
    return (
      <button type="button" onClick={() => setEdit(true)} className={`w-full text-right hover:text-signal-ink ${row.override ? 'text-signal-ink' : ''}`} title="Click to override">
        {rupees(row.price)}
      </button>
    );
  return (
    <input
      autoFocus
      type="number"
      defaultValue={Math.round(row.price)}
      aria-label={`Price for plot ${row.no}`}
      className="num h-6 w-full rounded-[3px] border border-signal bg-asphalt px-1 text-right text-[12px] outline-none"
      onBlur={(e) => {
        const v = Number(e.target.value);
        const inv = useProject.getState().params.inventory;
        setParam('inventory', { ...inv, [row.no]: { ...inv[row.no], price: v > 0 ? v : undefined } });
        setEdit(false);
      }}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    />
  );
}

const columns = [
  h.accessor('no', { header: 'No.', size: 56, aggregatedCell: () => null }),
  h.accessor('size', { header: 'Size', size: 72, filterFn: (r, id, v: string) => !v || String(r.getValue(id)) === v, cell: (c) => `${c.getValue()}` }),
  h.accessor('sqyd', { header: 'sq yd', size: 76, cell: (c) => fmtInt(c.getValue()), aggregationFn: 'sum', aggregatedCell: (c) => fmtInt(c.getValue() as number) }),
  h.accessor('m2', { header: 'm²', size: 76, cell: (c) => c.getValue().toFixed(1), aggregationFn: 'sum', aggregatedCell: (c) => fmtInt(c.getValue() as number) }),
  h.accessor('width', { header: 'W m', size: 64, cell: (c) => c.getValue().toFixed(2), aggregatedCell: () => null }),
  h.accessor('depth', { header: 'D m', size: 64, cell: (c) => c.getValue().toFixed(2), aggregatedCell: () => null }),
  h.accessor('facing', { header: 'Facing', size: 64, filterFn: (r, id, v: string) => !v || r.getValue(id) === v }),
  h.accessor((r) => (r.corner ? 'Corner' : '') + (r.irregular ? (r.corner ? ' · Irr' : 'Irregular') : ''), { id: 'flags', header: 'Flags', size: 100, aggregatedCell: () => null }),
  h.accessor('status', { header: 'Status', size: 96, filterFn: (r, id, v: string) => !v || r.getValue(id) === v, aggregatedCell: () => null }),
  h.accessor('mult', { header: '×', size: 60, cell: (c) => c.getValue().toFixed(3), aggregatedCell: () => null }),
  h.accessor('price', { header: 'Price ₹', size: 130, cell: (c) => <PriceCell row={c.row.original} />, aggregationFn: 'sum', aggregatedCell: (c) => rupees(c.getValue() as number) }),
];

export function ScheduleView() {
  const layout = useDerived((s) => s.layout);
  const params = useProject((s) => s.params);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [filters, setFilters] = useState<ColumnFiltersState>([]);
  const [group, setGroup] = useState<'none' | 'size' | 'facing'>('none');
  const grouping = useMemo<GroupingState>(() => (group === 'none' ? [] : [group]), [group]);
  const data = useMemo<Row[]>(
    () =>
      (layout?.plots ?? []).map((p) => ({
        no: p.no,
        size: p.sizeSqYd,
        m2: p.area,
        sqyd: p.area / SQYD,
        width: p.width,
        depth: p.depth,
        facing: p.facing,
        corner: p.corner,
        irregular: p.irregular,
        status: statusOf(p, params.inventory),
        mult: p.multiplier,
        price: plotPrice(p, params),
        override: !!params.inventory[p.no]?.price,
      })),
    [layout, params],
  );
  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters: filters, grouping, expanded: true },
    autoResetExpanded: false,
    autoResetPageIndex: false,
    onSortingChange: setSorting,
    onColumnFiltersChange: setFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  });
  const rows = table.getRowModel().rows;
  const parent = useRef<HTMLDivElement>(null);
  const v = useVirtualizer({ count: rows.length, getScrollElement: () => parent.current, estimateSize: () => 30, overscan: 12 });
  const uniq = (k: keyof Row) => Array.from(new Set(data.map((d) => String(d[k])))).sort((a, b) => (Number(a) - Number(b)) || a.localeCompare(b));
  const filterSel = (id: string, opts: string[]) => (
    <select
      aria-label={`Filter ${id}`}
      value={(table.getColumn(id)?.getFilterValue() as string) ?? ''}
      onChange={(e) => table.getColumn(id)?.setFilterValue(e.target.value || undefined)}
      className="mt-1 h-6 w-full rounded-[3px] border border-line bg-asphalt px-1 text-[11px] font-normal text-lane outline-none"
    >
      <option value="">All</option>
      {opts.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
  const filtered = table.getFilteredRowModel().rows;
  const total = filtered.reduce((s, r) => s + r.original.price, 0);
  const cols = table.getVisibleLeafColumns();
  const template = cols.map((c) => `minmax(${c.getSize()}px, 1fr)`).join(' ');
  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
        <h1 className="mr-2 text-[15px] font-semibold">Plot schedule</h1>
        <span className="num text-[12px] text-lane-dim">
          {filtered.length} plots · {rupees(total)}
        </span>
        <div className="flex-1" />
        <span className="text-[11px] text-lane-dim">Group by</span>
        <div className="w-56">
          <Segmented label="Group by" value={group} onChange={setGroup} options={[{ value: 'none', label: 'None' }, { value: 'size', label: 'Size' }, { value: 'facing', label: 'Facing' }]} />
        </div>
        <Button size="sm" variant="outline" onClick={() => void runExport('xlsx')}>
          <Icon name="download" size={13} /> XLSX
        </Button>
        <Button size="sm" variant="outline" onClick={() => void runExport('csv')}>
          CSV
        </Button>
      </div>
      <div ref={parent} className="min-h-0 flex-1 overflow-auto" role="table" aria-label="Plot schedule" aria-rowcount={rows.length}>
        <div className="min-w-[960px]">
          <div role="row" className="sticky top-0 z-10 grid border-b border-line bg-asphalt-2 px-3 py-1.5 text-[11px] text-lane-dim" style={{ gridTemplateColumns: template }}>
            {table.getHeaderGroups()[0].headers.map((hd) => (
              <div key={hd.id} role="columnheader" className="px-1">
                <button type="button" onClick={hd.column.getToggleSortingHandler()} className="caps flex items-center gap-1 hover:text-lane">
                  {flexRender(hd.column.columnDef.header, hd.getContext())}
                  {{ asc: '↑', desc: '↓' }[hd.column.getIsSorted() as string] ?? ''}
                </button>
                {hd.id === 'size' && filterSel('size', uniq('size'))}
                {hd.id === 'facing' && filterSel('facing', uniq('facing'))}
                {hd.id === 'status' && filterSel('status', uniq('status'))}
              </div>
            ))}
          </div>
          <div style={{ height: v.getTotalSize(), position: 'relative' }}>
            {v.getVirtualItems().map((vi) => {
              const r = rows[vi.index];
              const sel = useUi.getState().selected.includes(r.original?.no);
              return (
                <div
                  key={r.id}
                  role="row"
                  className={`num absolute inset-x-0 grid items-center border-b border-line/50 px-3 text-[12px] ${r.getIsGrouped() ? 'bg-asphalt-3 font-semibold' : sel ? 'bg-signal/10' : 'hover:bg-asphalt-2'}`}
                  style={{ height: vi.size, transform: `translateY(${vi.start}px)`, gridTemplateColumns: template }}
                  onClick={() => !r.getIsGrouped() && useUi.setState({ selected: [r.original.no] })}
                >
                  {r.getVisibleCells().map((c) => (
                    <div key={c.id} role="cell" className="truncate px-1">
                      {c.getIsGrouped() ? (
                        <span>
                          {String(c.getValue())} <span className="font-normal text-lane-dim">({r.subRows.length})</span>
                        </span>
                      ) : c.getIsAggregated() ? (
                        flexRender(c.column.columnDef.aggregatedCell ?? c.column.columnDef.cell, c.getContext())
                      ) : c.getIsPlaceholder() ? null : (
                        flexRender(c.column.columnDef.cell, c.getContext())
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
