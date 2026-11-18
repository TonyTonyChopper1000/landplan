import type { Poly, Pt, Rect, Region } from './geometry';

export type PresetId = 'rect' | 'tri' | 'trap' | 'L' | 'irr';
export type Authority = 'HMDA' | 'DTCP' | 'MUNICIPAL' | 'CUSTOM';
export type Dir8 = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';
export const DIRS: Dir8[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
export type EngineMode = 'parity' | 'rules';
export type PlotStatus = 'Available' | 'Held' | 'Booked' | 'Sold' | 'Mortgaged';

export type ConstraintKind = 'lake' | 'nala' | 'ht' | 'rail' | 'heritage';
export type Constraint = {
  id: string;
  kind: ConstraintKind;
  /** World metres. Lake = polygon, nala/ht/rail = polyline, heritage = single point. */
  pts: Pt[];
  lakeHa?: number;
  widthM?: number;
  voltageKv?: number;
  towerBase?: number;
};

export type PlotSize = { sqyd: number; on: boolean; weight: number };

export type Params = {
  mode: EngineMode;
  site: {
    source: 'preset' | 'drawn' | 'table' | 'import';
    preset: PresetId;
    acres: number;
    northOffset: number;
    authority: Authority;
    approachExisting: number;
    approachMP: number;
    roadAffected: number;
    /** Used when source !== 'preset'. World metres, centred. */
    polygon: Pt[] | null;
    bearings: { bearing: number; distance: number }[];
    anchor: { lat: number; lon: number };
    projectName: string;
    surveyNos: string;
    revision: string;
  };
  constraints: Constraint[];
  countBufferAsOpen: boolean;
  plots: {
    depthFt: number;
    sizes: PlotSize[];
    blockLen: number;
    minPlotM2: number;
    minWidth: number;
    mixedDepths: boolean;
  };
  roads: { frontage: number; spine: number; boundary: number; splays: boolean; hierarchy: boolean };
  open: {
    total: number;
    park: number;
    util: number;
    social: number;
    placement: 'central' | 'distributed' | 'buffer';
    minPocket: number;
  };
  built: { floors: number; floorHeight: number; setbacks: boolean };
  money: {
    baseRate: number;
    devCost: number;
    landCost: number;
    approvalFee: number;
    roadImpactFee: boolean;
    mortPct: number;
    releaseMonths: number;
    velocity: number;
    escalation: number;
    discount: number;
    premiums: Record<Dir8, number>;
    corner: number;
    irregular: number;
  };
  grid: { theta: number; blockLenFactor: number; offX: number; offY: number };
  ruleChoices: Record<string, { ruleId: string; note: string; at: string }>;
  overrides: Record<string, { value: string; reason: string }>;
  documents: Record<string, { status: DocStatus; note: string }>;
  inventory: Record<number, { status?: PlotStatus; price?: number }>;
};

export type DocStatus = 'pending' | 'in-progress' | 'done' | 'na';

export type Block = {
  id: number;
  rect: Rect; // rotated frame
  region: Region; // rotated frame
  area: number;
  dist: number;
  use: 'plots' | 'park' | 'util' | 'social';
};

export type Plot = {
  no: number;
  blockId: number;
  row: -1 | 1;
  rect: Rect; // rotated frame, full rectangle
  region: Region; // world frame after clipping
  area: number;
  width: number;
  depth: number;
  sizeSqYd: number;
  irregular: boolean;
  corner: boolean;
  facing: Dir8;
  multiplier: number;
  mortgaged: boolean;
  centroid: Pt; // world
};

export type OpenParcel = { id: string; use: 'park' | 'util' | 'social'; region: Region; area: number };

export type RoadRun = {
  id: string;
  axis: 'frontage' | 'spine';
  a: Pt; // world
  b: Pt;
  length: number;
  width: number;
  requiredRow: number | null;
  splay: number | null;
  carriageway: string;
};

export type Buffer = { id: string; kind: ConstraintKind; rule: string; region: Region; area: number; label: string };

export type AreaLine = { key: string; label: string; m2: number };

export type Layout = {
  params: Params;
  parcel: Poly; // world
  inset: Region; // world
  developable: Region; // world
  theta: number;
  blockLen: number;
  blocks: Block[];
  plots: Plot[];
  open: OpenParcel[];
  roadRuns: RoadRun[];
  buffers: Buffer[];
  splays: Region; // world
  gross: number;
  netLayout: number;
  plotted: number;
  openArea: number;
  areaLines: AreaLine[];
  frontage: number;
  spine: number;
  /** Rotated frame -> world: rotate by +theta. */
  bounds: Rect;
};
