import { create } from 'zustand';
import { temporal } from 'zundo';
import { defaultParams } from '@/engine/defaults';
import type { Params } from '@/engine/types';

type ProjectState = {
  params: Params;
  update: (fn: (p: Params) => Params) => void;
  replace: (p: Params) => void;
};

/** Leading-edge throttle so a slider drag records one undo step, not hundreds. */
function leading<A extends unknown[]>(fn: (...a: A) => void, ms: number) {
  let last = 0;
  return (...a: A) => {
    const now = Date.now();
    if (now - last > ms) fn(...a);
    last = now;
  };
}

export const useProject = create<ProjectState>()(
  temporal(
    (set) => ({
      params: defaultParams(),
      update: (fn) => set((s) => ({ params: fn(s.params) })),
      replace: (p) => set({ params: p }),
    }),
    {
      limit: 100,
      partialize: (s) => ({ params: s.params }),
      equality: (a, b) => a.params === b.params,
      handleSet: (handleSet) => leading(handleSet, 400),
    },
  ),
);

export const undo = () => useProject.temporal.getState().undo();
export const redo = () => useProject.temporal.getState().redo();

/** Typed helper to patch one params section. */
export function setSection<K extends keyof Params>(k: K, patch: Partial<Params[K]>): void {
  useProject.getState().update((p) => ({ ...p, [k]: { ...(p[k] as object), ...patch } }));
}
export function setParam<K extends keyof Params>(k: K, v: Params[K]): void {
  useProject.getState().update((p) => ({ ...p, [k]: v }));
}
