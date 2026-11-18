import { get, set } from 'idb-keyval';
import { useProject } from './project';
import { useScenarios, type Scenario } from './scenarios';
import { useUi } from './ui';
import { useDerived } from './derived';
import { useWorkspace } from './workspace';
import { readHash, writeHash, decodeParams, encodeParams } from '@/lib/share';
import { detectBackend, loadProject, saveProject } from '@/features/projects/repo';
import type { ProjectSummary } from '@/features/projects/types';

type Saved = { scenarios: { id: string; name: string; p: string; updatedAt: number }[]; activeId: string; compare: [string, string] };
const SCRATCH = 'landplan:project:default';
const PREFS = 'landplan:prefs';

async function hydratePrefs() {
  try {
    const prefs = (await get(PREFS)) as { theme?: 'dark' | 'light'; units?: 'm2' | 'sqyd' | 'acre' } | undefined;
    if (prefs) useUi.setState({ ...(prefs.theme ? { theme: prefs.theme } : {}), ...(prefs.units ? { units: prefs.units } : {}) });
  } catch {
    /* ignore */
  }
}

/** Open a saved project (Neon or browser). Returns false when it doesn't exist. */
export async function hydrateProject(id: string): Promise<boolean> {
  await hydratePrefs();
  const backend = await detectBackend();
  const b = await loadProject(id);
  if (!b || !b.scenarios.length) return false;
  const scenarios: Scenario[] = b.scenarios;
  useScenarios.getState().hydrate({ projectId: id, scenarios, activeId: b.activeId || scenarios[0].id, compare: [b.activeId || scenarios[0].id, scenarios[1]?.id ?? scenarios[0].id] });
  useProject.getState().replace(scenarios.find((s) => s.id === (b.activeId || scenarios[0].id))!.params);
  useProject.temporal.getState().clear();
  useWorkspace.setState({ meta: b.meta, backend, saving: 'idle', error: null });
  return true;
}

/** Scratch studio ('/studio' or a share link): the single-browser workspace from v1. */
export async function hydrateScratch(): Promise<void> {
  await hydratePrefs();
  useWorkspace.setState({ meta: null, backend: 'browser' });
  try {
    const saved = (await get(SCRATCH)) as Saved | undefined;
    if (saved?.scenarios?.length) {
      const scenarios = saved.scenarios.map((s) => ({ id: s.id, name: s.name, params: decodeParams(s.p), updatedAt: s.updatedAt })).filter((s): s is Scenario => !!s.params);
      if (scenarios.length) {
        const activeId = scenarios.some((s) => s.id === saved.activeId) ? saved.activeId : scenarios[0].id;
        useScenarios.getState().hydrate({ projectId: 'default', scenarios, activeId, compare: saved.compare });
        useProject.getState().replace(scenarios.find((s) => s.id === activeId)!.params);
      }
    }
  } catch {
    /* IndexedDB unavailable */
  }
  const fromHash = readHash();
  if (fromHash) useProject.getState().replace(fromHash);
  useProject.temporal.getState().clear();
}

function summary(): ProjectSummary | null {
  const { layout, fin, tally } = useDerived.getState();
  if (!layout || !fin) return null;
  return { plots: layout.plots.length, saleablePct: (layout.plotted / layout.gross) * 100, revenue: fin.revenue, marginPct: fin.marginPct, failing: tally.failing, gross: layout.gross, generatedAt: new Date().toISOString() };
}

/** Debounced autosave of the open project (or scratch), plus the URL hash and preferences. */
export function startAutosave(): () => void {
  let timer = 0;
  let known = new Set(useScenarios.getState().scenarios.map((s) => s.id));
  const save = async () => {
    useScenarios.getState().saveActive();
    const s = useScenarios.getState();
    writeHash(useProject.getState().params);
    const ws = useWorkspace.getState();
    useWorkspace.setState({ saving: 'saving' });
    try {
      if (ws.meta) {
        const ids = new Set(s.scenarios.map((x) => x.id));
        const removed = [...known].filter((x) => !ids.has(x));
        known = ids;
        const p = useProject.getState().params;
        const meta = { ...ws.meta, name: p.site.projectName || ws.meta.name, summary: summary() ?? ws.meta.summary, updatedAt: new Date().toISOString() };
        await saveProject(meta, s.scenarios, s.activeId, removed);
        useWorkspace.setState({ meta });
      } else {
        const data: Saved = { scenarios: s.scenarios.map((x) => ({ id: x.id, name: x.name, p: encodeParams(x.params), updatedAt: x.updatedAt })), activeId: s.activeId, compare: s.compare };
        await set(SCRATCH, data);
      }
      useWorkspace.setState({ saving: 'saved', savedAt: Date.now(), error: null });
    } catch (e) {
      useWorkspace.setState({ saving: 'error', error: e instanceof Error ? e.message : String(e) });
    }
  };
  const schedule = (ms = 1200) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => void save(), ms);
  };
  const u1 = useProject.subscribe((s, p) => s.params !== p.params && schedule());
  const u2 = useScenarios.subscribe((s, p) => {
    const names = (x: typeof s) => x.scenarios.map((y) => y.id + y.name).join('|');
    if (names(s) !== names(p) || s.activeId !== p.activeId || s.compare !== p.compare) schedule(300);
  });
  const u3 = useUi.subscribe((s, p) => {
    if (s.theme !== p.theme || s.units !== p.units) set(PREFS, { theme: s.theme, units: s.units }).catch(() => undefined);
  });
  const u4 = useWorkspace.subscribe((s, p) => {
    if (s.meta && p.meta && s.meta.details !== p.meta.details) schedule(400);
  });
  const onHide = () => document.visibilityState === 'hidden' && void save();
  document.addEventListener('visibilitychange', onHide);
  return () => {
    window.clearTimeout(timer);
    u1();
    u4();
    u2();
    u3();
    document.removeEventListener('visibilitychange', onHide);
  };
}
