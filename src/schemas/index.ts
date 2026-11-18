// Shared zod schemas for API inputs and outputs (also exported as JSON Schema / OpenAPI).
import { z } from 'zod';

const num = z.number().finite();
const pt = z.object({ x: num, y: num });
const dir = z.enum(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']);

export const ParamsSchema = z.object({
  mode: z.enum(['parity', 'rules']),
  site: z.object({
    source: z.enum(['preset', 'drawn', 'table', 'import']),
    preset: z.enum(['rect', 'tri', 'trap', 'L', 'irr']),
    acres: num.positive().max(2000),
    northOffset: num.min(-360).max(360),
    authority: z.enum(['HMDA', 'DTCP', 'MUNICIPAL', 'CUSTOM']),
    approachExisting: num.min(0),
    approachMP: num.min(0),
    roadAffected: num.min(0),
    polygon: z.array(pt).min(3).nullable(),
    bearings: z.array(z.object({ bearing: num.min(0).max(360), distance: num.positive() })),
    anchor: z.object({ lat: num.min(-90).max(90), lon: num.min(-180).max(180) }),
    approachEdge: z.number().int().min(0).nullable(),
    recordAcres: num.min(0),
    recordGuntas: num.min(0),
    projectName: z.string().max(200),
    surveyNos: z.string().max(500),
    revision: z.string().max(20),
  }),
  constraints: z.array(
    z.object({
      id: z.string(),
      kind: z.enum(['lake', 'nala', 'ht', 'rail', 'heritage']),
      pts: z.array(pt).min(1),
      lakeHa: num.min(0).optional(),
      widthM: num.min(0).optional(),
      voltageKv: num.min(0).optional(),
      towerBase: num.min(0).optional(),
    }),
  ),
  countBufferAsOpen: z.boolean(),
  plots: z.object({
    depthFt: num.min(20).max(200),
    sizes: z.array(z.object({ sqyd: num.positive(), on: z.boolean(), weight: num.min(0).max(50) })).min(1),
    blockLen: num.min(20).max(1000),
    minPlotM2: num.min(1),
    minWidth: num.min(0),
    mixedDepths: z.boolean(),
    packing: z.enum(['cycle', 'dp']),
    numbering: z.enum(['v1', 'serpentine']),
  }),
  roads: z.object({ frontage: num.min(3).max(60), spine: num.min(3).max(60), boundary: num.min(0).max(60), splays: z.boolean(), hierarchy: z.boolean() }),
  open: z.object({
    total: num.min(0).max(60),
    park: num.min(0).max(60),
    util: num.min(0).max(20),
    social: num.min(0).max(20),
    placement: z.enum(['central', 'distributed', 'buffer']),
    minPocket: num.min(0),
  }),
  built: z.object({ floors: z.number().int().min(0).max(10), floorHeight: num.min(2).max(6), setbacks: z.boolean() }),
  money: z.object({
    baseRate: num.min(0),
    devCost: num.min(0),
    landCost: num.min(0),
    approvalFee: num.min(0),
    roadImpactFee: z.boolean(),
    mortPct: num.min(0).max(100),
    releaseMonths: num.min(0).max(240),
    velocity: num.min(0.1),
    escalation: num.min(-50).max(100),
    discount: num.min(0).max(100),
    premiums: z.record(dir, num),
    corner: num,
    irregular: num,
    mortPolicy: z.enum(['highest', 'contiguous', 'lowest-value']),
    roadCostPerM: num.min(0),
    openCostPerM2: num.min(0),
  }),
  grid: z.object({ theta: num, blockLenFactor: num.min(0.3).max(3), offX: num.min(0).max(1), offY: num.min(0).max(1) }),
  ruleChoices: z.record(z.string(), z.object({ ruleId: z.string(), note: z.string(), at: z.string() })),
  overrides: z.record(z.string(), z.object({ value: z.string(), reason: z.string().min(1) })),
  documents: z.record(z.string(), z.object({ status: z.enum(['pending', 'in-progress', 'done', 'na']), note: z.string() })),
  inventory: z.record(z.string(), z.object({ status: z.enum(['Available', 'Held', 'Booked', 'Sold', 'Mortgaged']).optional(), price: num.min(0).optional() })),
});

/** Request bodies may send any subset of params; the server deep-merges them onto the defaults. */
export const ParamsInputSchema = z.record(z.string(), z.unknown()).describe('Any subset of Params, deep-merged onto engine defaults');

export const GenerateRequestSchema = z.object({
  params: ParamsInputSchema.default({}),
  engine: z.enum(['v1', 'v2']).default('v2'),
  optimizeGrid: z.boolean().default(false),
  seed: z.number().int().min(0).default(1),
});

export const OptimizeRequestSchema = z.object({
  params: ParamsInputSchema.default({}),
  engine: z.enum(['v1', 'v2']).default('v2'),
  seed: z.number().int().min(0).default(1),
  budgetMs: z.number().int().min(200).max(55000).default(8000),
  maxCandidates: z.number().int().min(10).max(5000).default(1500),
  weights: z.object({ alpha: num, beta: num, gamma: num }).partial().default({}),
});

export const ImportRequestSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('geojson'), data: z.unknown() }),
  z.object({ kind: z.literal('kml'), text: z.string().max(5_000_000) }),
  z.object({ kind: z.literal('dxf'), text: z.string().max(10_000_000) }),
  z.object({ kind: z.literal('bearings'), rows: z.array(z.object({ bearing: num.min(0).max(360), distance: num.positive() })).min(3) }),
  z.object({ kind: z.literal('bearings-csv'), csv: z.string().max(1_000_000) }),
]).and(z.object({ recordAcres: num.min(0).optional(), recordGuntas: num.min(0).optional(), tolerancePct: num.min(0).max(100).optional() }));

export const ExportRequestSchema = z.object({
  format: z.enum(['svg', 'dxf', 'geojson', 'csv']),
  params: ParamsInputSchema.optional(),
  scenarioId: z.string().optional(),
});

const checkOut = z.object({
  id: z.string(),
  ruleId: z.string(),
  ruleIds: z.array(z.string()),
  status: z.enum(['pass', 'fail', 'conflict', 'unknown', 'overridden', 'warn', 'na']),
  measured: z.string(),
  required: z.string(),
  featureIds: z.array(z.string()),
  message: z.string(),
});

export const LayoutResultSchema = z.object({
  engineVersion: z.string(),
  mode: z.enum(['v1', 'v2']),
  seed: z.number(),
  inputHash: z.string(),
  units: z.literal('m'),
  crs: z.object({ local: z.string(), origin: z.tuple([num, num]), output: z.enum(['local', 'wgs84']) }),
  features: z.object({ type: z.literal('FeatureCollection'), features: z.array(z.unknown()) }),
  areaStatement: z.array(z.object({ kind: z.string(), label: z.string(), areaM2: num, pct: num })),
  roadRuns: z.array(z.object({ id: z.string(), axis: z.string(), lengthM: num, widthM: num, requiredM: num.nullable(), splayM: num.nullable(), ok: z.boolean() })),
  checks: z.array(checkOut),
  kpis: z.object({
    plots: num, saleablePct: num, avgPlotSqyd: num, revenue: num, sellableNow: num, mortgagedValue: num,
    devCost: num, marginPct: num, irr: num.nullable(), npv: num, mortgagedRanges: z.string(),
  }),
  finance: z.object({ cashflow: z.array(z.unknown()), tornado: z.array(z.unknown()) }),
  diagnostics: z.object({ stageTimingsMs: z.record(z.string(), num), widthIterations: num, solverGap: num.nullable(), warnings: z.array(z.string()) }),
});

export type LayoutResult = z.infer<typeof LayoutResultSchema>;
export type GenerateRequest = z.infer<typeof GenerateRequestSchema>;
export type OptimizeRequest = z.infer<typeof OptimizeRequestSchema>;
