import { SQYD } from './geometry';
import type { Dir8, Params, PlotSize } from './types';

export const V1_PREMIUMS: Record<Dir8, number> = {
  N: 0.06,
  NE: 0.1,
  E: 0.08,
  SE: 0.02,
  S: 0,
  SW: -0.02,
  W: 0,
  NW: 0.02,
};

/** The v1 plot mix (120–400 sq yd). */
export const V1_MIX: PlotSize[] = [
  { sqyd: 120, on: false, weight: 1 },
  { sqyd: 150, on: true, weight: 2 },
  { sqyd: 167, on: true, weight: 1 },
  { sqyd: 200, on: true, weight: 3 },
  { sqyd: 240, on: true, weight: 2 },
  { sqyd: 267, on: true, weight: 1 },
  { sqyd: 300, on: true, weight: 2 },
  { sqyd: 400, on: true, weight: 1 },
];

export const V1_MIN_PLOT_M2 = 70 * SQYD;

export function defaultParams(): Params {
  return {
    mode: 'parity',
    site: {
      source: 'preset',
      preset: 'L',
      acres: 17,
      northOffset: 0,
      authority: 'HMDA',
      approachExisting: 18,
      approachMP: 18,
      roadAffected: 0,
      polygon: null,
      bearings: [],
      anchor: { lat: 17.385, lon: 78.4867 },
      projectName: 'Untitled layout',
      surveyNos: '',
      revision: 'A',
    },
    constraints: [],
    countBufferAsOpen: false,
    plots: {
      depthFt: 60,
      sizes: V1_MIX.map((s) => ({ ...s })),
      blockLen: 150,
      minPlotM2: V1_MIN_PLOT_M2,
      minWidth: 0,
      mixedDepths: false,
    },
    roads: { frontage: 12.2, spine: 12.2, boundary: 0, splays: false, hierarchy: false },
    open: { total: 10, park: 10, util: 0, social: 0, placement: 'central', minPocket: 450 },
    built: { floors: 1, floorHeight: 3.6, setbacks: true },
    money: {
      baseRate: 32000,
      devCost: 6500,
      landCost: 0,
      approvalFee: 0,
      roadImpactFee: false,
      mortPct: 25,
      releaseMonths: 36,
      velocity: 10,
      escalation: 6,
      discount: 12,
      premiums: { ...V1_PREMIUMS },
      corner: 0.12,
      irregular: 0.05,
    },
    grid: { theta: 0, blockLenFactor: 1, offX: 0, offY: 0 },
    ruleChoices: {},
    overrides: {},
    documents: {},
    inventory: {},
  };
}

/** One-click "Apply GO 105 standards": switches rule-aware defaults on. */
export function applyGo105(p: Params): Params {
  const at = new Date().toISOString().slice(0, 10);
  return {
    ...p,
    mode: 'rules',
    plots: { ...p.plots, minPlotM2: 50, minWidth: 6 },
    roads: { ...p.roads, splays: true, hierarchy: true },
    open: { ...p.open, total: 10, park: 9, util: 1, social: 0 },
    money: { ...p.money, mortPct: 15 },
    ruleChoices: {
      ...p.ruleChoices,
      mortgage: { ruleId: 'MG-15', note: 'GO 105 standards preset', at },
      'os-split': { ruleId: 'OS-SPLIT-105', note: 'GO 105 standards preset', at },
    },
  };
}
