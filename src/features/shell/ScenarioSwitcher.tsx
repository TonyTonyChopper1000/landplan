import { useEffect, useRef, useState } from 'react';
import { useScenarios } from '@/state/scenarios';
import { Icon } from '@/components/ui/Icon';
import { cx } from '@/components/ui/controls';

export function ScenarioSwitcher() {
  const { scenarios, activeId, switchTo, duplicate, rename, remove } = useScenarios();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const active = scenarios.find((s) => s.id === activeId);
  useEffect(() => {
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-8 max-w-[180px] items-center gap-1.5 rounded-[4px] border border-line px-2 text-[12px] hover:border-lane-dim"
      >
        <Icon name="layers" size={14} className="text-blueprint" />
        <span className="truncate">{active?.name}</span>
        <Icon name="chevron" size={12} className="rotate-90 text-lane-dim" />
      </button>
      {open && (
        <div role="menu" className="absolute top-9 left-0 z-50 w-72 rounded-[4px] border border-line bg-asphalt-2 p-1 shadow-2xl">
          {scenarios.map((s) => (
            <div key={s.id} className={cx('group flex items-center gap-1 rounded-[3px] px-1', s.id === activeId && 'bg-asphalt-3')}>
              {editing === s.id ? (
                <input
                  autoFocus
                  defaultValue={s.name}
                  aria-label="Scenario name"
                  className="h-7 flex-1 rounded-[3px] border border-signal bg-asphalt px-2 text-[12px] outline-none"
                  onBlur={(e) => {
                    rename(s.id, e.target.value.trim() || s.name);
                    setEditing(null);
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                />
              ) : (
                <button
                  role="menuitem"
                  type="button"
                  className="h-7 flex-1 truncate text-left text-[12px]"
                  onClick={() => {
                    switchTo(s.id);
                    setOpen(false);
                  }}
                >
                  {s.name}
                </button>
              )}
              <button type="button" className="p-1 text-lane-dim hover:text-lane" title="Rename" aria-label={`Rename ${s.name}`} onClick={() => setEditing(s.id)}>
                <Icon name="edit" size={13} />
              </button>
              <button type="button" className="p-1 text-lane-dim hover:text-lane" title="Duplicate" aria-label={`Duplicate ${s.name}`} onClick={() => duplicate(s.id)}>
                <Icon name="copy" size={13} />
              </button>
              {scenarios.length > 1 && (
                <button type="button" className="p-1 text-lane-dim hover:text-brake-ink" title="Delete" aria-label={`Delete ${s.name}`} onClick={() => remove(s.id)}>
                  <Icon name="trash" size={13} />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            className="mt-1 flex h-7 w-full items-center gap-1.5 rounded-[3px] px-2 text-[12px] text-blueprint hover:bg-asphalt-3"
            onClick={() => {
              const id = duplicate();
              switchTo(id);
              setEditing(id);
            }}
          >
            <Icon name="plus" size={13} /> New scenario from current
          </button>
        </div>
      )}
    </div>
  );
}
