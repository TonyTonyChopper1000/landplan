import { get, set } from 'idb-keyval';
import { useProject } from './project';
import { useScenarios, type Scenario } from './scenarios';
import { useUi } from './ui';
import { readHash, writeHash } from '@/lib/share';
import { decodeParams, encodeParams } from '@/lib/share';

type Saved = { scenarios: { id: string; name: string; p: string; updatedAt: number }[]; activeId: string; compare: [string, string] };
const KEY = 'landplan:project:default';
const PREFS = 'landplan:prefs';

export async function hydrate(): Promise<void> {
  try {
    const saved = (await get(KEY)) as Saved | undefined;
    if (saved?.scenarios?.length) {
      const scenarios: Scenario[] = saved.scenarios
        .map((s) => ({ id: s.id, name: s.name, params: decodeParams(s.p), updatedAt: s.updatedAt }))
        .filter((s): s is Scenario => !!s.params);
      if (scenarios.length) {
        const activeId = scenarios.some((s) => s.id === saved.activeId) ? saved.activeId : scenarios[0].id;
        useScenarios.getState().hydrate({ projectId: 'default', scenarios, activeId, compare: saved.compare });
        useProject.getState().replace(scenarios.find((s) => s.id === activeId)!.params);
      }
    }
    const prefs = (await get(PREFS)) as { theme?: 'dark' | 'light'; units?: 'm2' | 'sqyd' | 'acre' } | undefined;
    if (prefs) useUi.setState({ ...(prefs.theme ? { theme: prefs.theme } : {}), ...(prefs.units ? { units: prefs.units } : {}) });
  } catch {
    /* IndexedDB unavailable: run in memory */
  }
  const fromHash = readHash();
  if (fromHash) useProject.getState().replace(fromHash);
  useProject.temporal.getState().clear();
}

/** Autosave to IndexedDB and mirror the scenario to the URL hash. */
export function startAutosave(onSaved: (at: number) => void): () => void {
  let timer = 0;
  const save = () => {
    useScenarios.getState().saveActive();
    const s = useScenarios.getState();
    const data: Saved = {
      scenarios: s.scenarios.map((x) => ({ id: x.id, name: x.name, p: encodeParams(x.params), updatedAt: x.updatedAt })),
      activeId: s.activeId,
      compare: s.compare,
    };
    writeHash(useProject.getState().params);
    set(KEY, data).then(() => onSaved(Date.now()), () => undefined);
  };
  const u1 = useProject.subscribe((s, p) => {
    if (s.params === p.params) return;
    window.clearTimeout(timer);
    timer = window.setTimeout(save, 600);
  });
  const u2 = useScenarios.subscribe((s, p) => {
    const names = (x: typeof s) => x.scenarios.map((y) => y.id + y.name).join('|');
    if (names(s) !== names(p) || s.activeId !== p.activeId || s.compare !== p.compare) save();
  });
  const u3 = useUi.subscribe((s, p) => {
    if (s.theme !== p.theme || s.units !== p.units) set(PREFS, { theme: s.theme, units: s.units }).catch(() => undefined);
  });
  return () => {
    u1();
    u2();
    u3();
  };
}
