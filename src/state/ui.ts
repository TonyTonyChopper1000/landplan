import { create } from 'zustand';
import type { Highlight } from '@/engine/checks';
import type { Units } from '@/lib/format';

export type Tab = 'overview' | 'studio' | '3d' | 'schedule' | 'feasibility' | 'financials' | 'regulations' | 'compare';
export const TABS: Tab[] = ['overview', 'studio', '3d', 'schedule', 'feasibility', 'financials', 'regulations', 'compare'];
export type PanelId = 'site' | 'constraints' | 'plots' | 'roads' | 'open' | 'built' | 'money';
export type Tool = 'select' | 'lasso' | 'parcel' | 'lake' | 'nala' | 'ht' | 'rail' | 'heritage';

type UiState = {
  tab: Tab;
  panel: PanelId | null;
  theme: 'dark' | 'light';
  units: Units;
  tool: Tool;
  hover: number | null;
  selected: number[];
  highlight: { checkId: string; h: Highlight } | null;
  genKey: number;
  drawer: 'none' | 'optimizer' | 'assistant' | 'export' | 'inspector' | 'params';
  palette: boolean;
  mapTrace: boolean;
  toast: string | null;
  set: (p: Partial<UiState>) => void;
};

export const useUi = create<UiState>()((set) => ({
  tab: 'studio',
  panel: 'site',
  theme: 'dark',
  units: 'sqyd',
  tool: 'select',
  hover: null,
  selected: [],
  highlight: null,
  genKey: 0,
  drawer: 'none',
  palette: false,
  mapTrace: false,
  toast: null,
  set: (p) => set(p),
}));

export const ui = () => useUi.getState();
export function toast(msg: string) {
  useUi.setState({ toast: msg });
  window.setTimeout(() => {
    if (useUi.getState().toast === msg) useUi.setState({ toast: null });
  }, 2200);
}
