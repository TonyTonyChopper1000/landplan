import { applyGo105, defaultParams } from '@/engine/defaults';
import type { Authority, Params, PlotSize, PresetId } from '@/engine/types';

export type ProjectType = 'plots' | 'villas' | 'farm';

export type ProjectDetails = {
  location: string;
  village: string;
  surveyNos: string;
  authority: Authority;
  acres: number;
  guntas: number;
  shape: PresetId;
  approachExisting: number;
  approachMP: number;
  baseRate: number;
  devCost: number;
  landCostPerAcre: number;
  ruleAware: boolean;
  // type-specific
  floors?: number;
  clubhouse?: boolean;
  plantation?: string;
};

export type ProjectSummary = {
  plots: number;
  saleablePct: number;
  revenue: number;
  marginPct: number;
  failing: number;
  gross: number;
  generatedAt: string;
};

export type ProjectMeta = {
  id: string;
  name: string;
  type: ProjectType;
  details: ProjectDetails;
  summary: ProjectSummary | null;
  activeScenario: string | null;
  createdAt: string;
  updatedAt: string;
};

export const TYPE_INFO: Record<ProjectType, { title: string; tag: string; blurb: string; accent: string; bullets: string[] }> = {
  plots: {
    title: 'Residential plots',
    tag: 'Open plotted layout',
    blurb: 'Classic HMDA / DTCP plotted venture: 150–400 sq yd plots, 12 m roads, 10% public space.',
    accent: 'var(--blueprint)',
    bullets: ['Plot mix and facing premiums', 'Mortgage plot ranges', 'Sellable-now inventory'],
  },
  villas: {
    title: 'Gated villa community',
    tag: 'Villas with built form',
    blurb: 'Larger 240–500 sq yd villa plots with setbacks, G+1/G+2 massing and a clubhouse parcel.',
    accent: 'var(--band-3)',
    bullets: ['Built-up area and coverage', '3D massing and sun path', 'Clubhouse / amenity parcel'],
  },
  farm: {
    title: 'Farm plots',
    tag: 'Managed farmland',
    blurb: '10–40 gunta farm plots on 9 m farm roads, priced per acre, with plantation space.',
    accent: 'var(--sign-green)',
    bullets: ['Plots in acres and guntas', 'Price per acre', 'Plantation / green cover'],
  },
};

export function defaultDetails(type: ProjectType): ProjectDetails {
  const base: ProjectDetails = {
    location: '',
    village: '',
    surveyNos: '',
    authority: type === 'farm' ? 'DTCP' : 'HMDA',
    acres: type === 'farm' ? 40 : type === 'villas' ? 15 : 17,
    guntas: 0,
    shape: type === 'farm' ? 'irr' : 'L',
    approachExisting: type === 'farm' ? 9 : 18,
    approachMP: type === 'farm' ? 12 : 18,
    baseRate: type === 'farm' ? 3500 : type === 'villas' ? 45000 : 32000,
    devCost: type === 'farm' ? 900 : type === 'villas' ? 9000 : 6500,
    landCostPerAcre: 0,
    ruleAware: type !== 'farm',
  };
  if (type === 'villas') return { ...base, floors: 1, clubhouse: true };
  if (type === 'farm') return { ...base, plantation: 'Mango / red sanders' };
  return base;
}

const VILLA_MIX: PlotSize[] = [
  { sqyd: 240, on: true, weight: 2 },
  { sqyd: 300, on: true, weight: 3 },
  { sqyd: 360, on: true, weight: 2 },
  { sqyd: 400, on: true, weight: 2 },
  { sqyd: 500, on: true, weight: 1 },
];
// Farm plots in guntas: 1 gunta = 121 sq yd
const FARM_MIX: PlotSize[] = [
  { sqyd: 1210, on: true, weight: 3 },
  { sqyd: 1815, on: true, weight: 2 },
  { sqyd: 2420, on: true, weight: 2 },
  { sqyd: 4840, on: true, weight: 1 },
];

/** Build engine parameters from the wizard. */
export function paramsFor(type: ProjectType, name: string, d: ProjectDetails): Params {
  let p = defaultParams();
  if (d.ruleAware) p = applyGo105(p);
  const acres = d.acres + d.guntas / 40;
  p = {
    ...p,
    site: {
      ...p.site,
      projectName: name,
      surveyNos: d.surveyNos,
      authority: d.authority,
      acres: Math.max(0.5, acres),
      preset: d.shape,
      approachExisting: d.approachExisting,
      approachMP: d.approachMP,
      recordAcres: d.acres,
      recordGuntas: d.guntas,
    },
    money: { ...p.money, baseRate: d.baseRate, devCost: d.devCost, landCost: d.landCostPerAcre },
  };
  if (type === 'villas') {
    p = {
      ...p,
      plots: { ...p.plots, depthFt: 70, blockLen: 160, sizes: VILLA_MIX.map((s) => ({ ...s })) },
      roads: { ...p.roads, frontage: 12.2, spine: 18 },
      built: { ...p.built, floors: d.floors ?? 1, setbacks: true },
      open: d.clubhouse ? { ...p.open, total: 11, park: 9, util: 1, social: 1 } : p.open,
      money: { ...p.money, corner: 0.15, premiums: { ...p.money.premiums, E: 0.1, NE: 0.12 } },
    };
  }
  if (type === 'farm') {
    p = {
      ...p,
      plots: { ...p.plots, depthFt: 220, blockLen: 260, sizes: FARM_MIX.map((s) => ({ ...s })), minPlotM2: 500 },
      roads: { ...p.roads, frontage: 9, spine: 12 },
      open: { ...p.open, placement: 'distributed' },
      built: { ...p.built, floors: 0 },
      money: { ...p.money, mortPct: d.ruleAware ? p.money.mortPct : 0, velocity: 4 },
    };
  }
  return p;
}
