import { applyGo105 } from '@/engine/defaults';
import { applyPatch } from '@/lib/patch';
import { shareUrl } from '@/lib/share';
import type { ParamPatch } from '@/engine/checks';
import { useProject } from './project';
import { toast, useUi } from './ui';
import { startOptimizer } from './optimizer';

export function regenerate() {
  useUi.setState((s) => ({ genKey: s.genKey + 1 }));
}
export function optimize() {
  void startOptimizer();
}
export function go105() {
  useProject.getState().update(applyGo105);
  regenerate();
  toast('GO 105 standards applied: splays, 9 + 1 split, 50 m² / 6 m, 15% mortgage');
}
export function rotateGrid(delta: number) {
  useProject.getState().update((p) => ({ ...p, grid: { ...p.grid, theta: (((p.grid.theta + delta) % 90) + 90) % 90 } }));
}
export function applyFix(patch: ParamPatch, label: string) {
  useProject.getState().update((p) => applyPatch(p, patch));
  toast(`Applied: ${label}`);
}
export async function copyShare() {
  const url = shareUrl(useProject.getState().params);
  try {
    await navigator.clipboard.writeText(url);
    toast('Share link copied');
  } catch {
    toast('Copy failed — the URL bar already holds the share link');
  }
}
export function toggleTheme() {
  useUi.setState((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' }));
}
