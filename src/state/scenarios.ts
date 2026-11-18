import { create } from 'zustand';
import { defaultParams } from '@/engine/defaults';
import type { Params } from '@/engine/types';
import { useProject } from './project';

export type Scenario = { id: string; name: string; params: Params; updatedAt: number };

type ScenarioState = {
  projectId: string;
  scenarios: Scenario[];
  activeId: string;
  compare: [string, string];
  saveActive: () => void;
  switchTo: (id: string) => void;
  duplicate: (id?: string) => string;
  rename: (id: string, name: string) => void;
  remove: (id: string) => void;
  setCompare: (a: string, b: string) => void;
  hydrate: (s: Pick<ScenarioState, 'projectId' | 'scenarios' | 'activeId' | 'compare'>) => void;
};

let n = 0;
export const newId = (prefix = 's') => `${prefix}${Date.now().toString(36)}${(n++).toString(36)}`;

const first: Scenario = { id: 'base', name: 'Base case', params: defaultParams(), updatedAt: Date.now() };

export const useScenarios = create<ScenarioState>()((set, get) => ({
  projectId: 'default',
  scenarios: [first],
  activeId: 'base',
  compare: ['base', 'base'],
  saveActive: () => {
    const params = useProject.getState().params;
    set((s) => ({
      scenarios: s.scenarios.map((x) => (x.id === s.activeId ? { ...x, params, updatedAt: Date.now() } : x)),
    }));
  },
  switchTo: (id) => {
    get().saveActive();
    const target = get().scenarios.find((x) => x.id === id);
    if (!target) return;
    set({ activeId: id });
    useProject.getState().replace(target.params);
    useProject.temporal.getState().clear();
  },
  duplicate: (id) => {
    get().saveActive();
    const src = get().scenarios.find((x) => x.id === (id ?? get().activeId));
    if (!src) return '';
    const copy: Scenario = { id: newId(), name: `${src.name} (copy)`, params: src.params, updatedAt: Date.now() };
    set((s) => ({ scenarios: [...s.scenarios, copy], compare: [s.activeId, copy.id] }));
    return copy.id;
  },
  rename: (id, name) => set((s) => ({ scenarios: s.scenarios.map((x) => (x.id === id ? { ...x, name } : x)) })),
  remove: (id) => {
    const s = get();
    if (s.scenarios.length <= 1) return;
    const rest = s.scenarios.filter((x) => x.id !== id);
    if (id === s.activeId) {
      set({ scenarios: rest, activeId: rest[0].id });
      useProject.getState().replace(rest[0].params);
    } else set({ scenarios: rest });
    set((st) => ({ compare: st.compare.map((c) => (c === id ? st.activeId : c)) as [string, string] }));
  },
  setCompare: (a, b) => set({ compare: [a, b] }),
  hydrate: (s) => set(s),
}));
