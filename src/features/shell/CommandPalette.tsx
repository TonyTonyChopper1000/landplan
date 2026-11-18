import { Command } from 'cmdk';
import { useUi, TABS } from '@/state/ui';
import { undo, redo, setParam } from '@/state/project';
import { copyShare, go105, optimize, regenerate, rotateGrid, toggleTheme } from '@/state/actions';
import { useScenarios } from '@/state/scenarios';
import { runExport, type ExportKind } from '@/features/reports/exports';
import { t } from '@/i18n';

type Cmd = { id: string; label: string; group: string; keys?: string; run: () => void };

function commands(): Cmd[] {
  const sc = useScenarios.getState();
  return [
    { id: 'gen', label: t('top.generate'), group: 'Layout', keys: 'G', run: regenerate },
    { id: 'opt', label: t('top.optimize'), group: 'Layout', keys: 'O', run: optimize },
    { id: 'go105', label: t('top.go105'), group: 'Layout', run: go105 },
    { id: 'parity', label: 'Switch to v1 parity engine', group: 'Layout', run: () => setParam('mode', 'parity') },
    { id: 'rules', label: 'Switch to rule-aware engine', group: 'Layout', run: () => setParam('mode', 'rules') },
    { id: 'rotl', label: 'Rotate grid −5°', group: 'Layout', keys: '[', run: () => rotateGrid(-5) },
    { id: 'rotr', label: 'Rotate grid +5°', group: 'Layout', keys: ']', run: () => rotateGrid(5) },
    ...TABS.map((id, i) => ({ id: `tab-${id}`, label: `Go to ${t(`tab.${id}`)}`, group: 'Navigate', keys: String(i + 1), run: () => useUi.setState({ tab: id }) })),
    ...(['pdf', 'svg', 'dxf', 'xlsx', 'csv', 'geojson'] as ExportKind[]).map((k) => ({ id: `ex-${k}`, label: `Export ${k.toUpperCase()}`, group: 'Export', run: () => void runExport(k) })),
    { id: 'share', label: t('top.share'), group: 'Project', run: () => void copyShare() },
    { id: 'dup', label: 'Duplicate scenario', group: 'Project', run: () => sc.duplicate() },
    ...sc.scenarios.map((s) => ({ id: `sc-${s.id}`, label: `Open scenario: ${s.name}`, group: 'Project', run: () => sc.switchTo(s.id) })),
    { id: 'undo', label: t('top.undo'), group: 'Edit', keys: '⌘Z', run: undo },
    { id: 'redo', label: t('top.redo'), group: 'Edit', keys: '⇧⌘Z', run: redo },
    { id: 'theme', label: t('top.theme'), group: 'View', run: toggleTheme },
    { id: 'units-m', label: 'Units: m²', group: 'View', run: () => useUi.setState({ units: 'm2' }) },
    { id: 'units-y', label: 'Units: sq yd', group: 'View', run: () => useUi.setState({ units: 'sqyd' }) },
    { id: 'units-a', label: 'Units: acres / guntas', group: 'View', run: () => useUi.setState({ units: 'acre' }) },
    { id: 'assist', label: 'Open assistant', group: 'View', run: () => useUi.setState({ drawer: 'assistant' }) },
    { id: 'lasso', label: 'Lasso select plots', group: 'Tools', keys: 'L', run: () => useUi.setState({ tool: 'lasso', tab: 'studio' }) },
    { id: 'lake', label: 'Draw lake FTL', group: 'Tools', run: () => useUi.setState({ tool: 'lake', tab: 'studio', panel: 'constraints' }) },
    { id: 'map', label: 'Trace parcel on satellite map', group: 'Tools', run: () => useUi.setState({ mapTrace: true, tab: 'studio' }) },
  ];
}

export function CommandPalette() {
  const open = useUi((s) => s.palette);
  if (!open) return null;
  const list = commands();
  const groups = Array.from(new Set(list.map((c) => c.group)));
  const close = () => useUi.setState({ palette: false });
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/50 pt-[12vh]" onMouseDown={close}>
      <Command
        label="Command palette"
        className="w-[min(560px,92vw)] overflow-hidden rounded-[6px] border border-line bg-asphalt-2 shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === 'Escape' && close()}
      >
        <Command.Input autoFocus placeholder="Type a command…" className="h-11 w-full border-b border-line bg-transparent px-4 text-[14px] text-lane outline-none placeholder:text-lane-dim" />
        <Command.List className="max-h-[50vh] overflow-y-auto p-1">
          <Command.Empty className="p-4 text-[12px] text-lane-dim">No matching command.</Command.Empty>
          {groups.map((g) => (
            <Command.Group key={g} heading={g} className="[&_[cmdk-group-heading]]:caps [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:text-lane-dim">
              {list
                .filter((c) => c.group === g)
                .map((c) => (
                  <Command.Item
                    key={c.id}
                    value={`${c.group} ${c.label}`}
                    onSelect={() => {
                      close();
                      c.run();
                    }}
                    className="flex h-8 cursor-pointer items-center justify-between rounded-[3px] px-3 text-[13px] data-[selected=true]:bg-asphalt-3 data-[selected=true]:text-lane"
                  >
                    {c.label}
                    {c.keys && <kbd className="mono rounded-[2px] border border-line px-1.5 text-[10px] text-lane-dim">{c.keys}</kbd>}
                  </Command.Item>
                ))}
            </Command.Group>
          ))}
        </Command.List>
      </Command>
    </div>
  );
}
