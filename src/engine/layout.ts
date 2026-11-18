import { difference, intersect, offsetRegion, union } from './clip';
import { buildBuffers, bufferUnion } from './constraints';
import {
  FT,
  SQYD,
  area,
  bbox,
  centroid,
  clipRect,
  naiveInset,
  pointInRegion,
  rectArea,
  rectPoly,
  regionArea,
  regionCentroid,
  rotateRegion,
  type Poly,
  type Pt,
  type Rect,
  type Region,
} from './geometry';
import { parcelFor } from './parcel';
import { roadRuns, splayForWidth, type GridGeom } from './roads';
import { annotate } from './annotate';
import { assignOpen } from './openspace';
import { areaStatement } from './areas';
import type { Block, Buffer, Layout, Params, Plot, PlotSize } from './types';

export type GridConfig = { theta: number; blockLen: number; offX: number; offY: number };

export type Prepared = {
  params: Params;
  parcel: Poly;
  origin: Pt;
  inset: Region;
  buffers: Buffer[];
  developable: Region;
  robust: boolean;
  widths: { sqyd: number; width: number }[];
  depth: number;
  minPlot: number;
  gross: number;
};

/** Ascending sequence repeated by weight, interleaved lo, hi, lo+1, hi−1… */
export function sizeSequence(sizes: PlotSize[]): number[] {
  const seq: number[] = [];
  for (const s of sizes) if (s.on) for (let i = 0; i < Math.max(0, Math.round(s.weight)); i++) seq.push(s.sqyd);
  seq.sort((a, b) => a - b);
  const out: number[] = [];
  let i = 0;
  let j = seq.length - 1;
  while (i <= j) {
    out.push(seq[i++]);
    if (i <= j) out.push(seq[j--]);
  }
  return out;
}

export function prepare(params: Params): Prepared {
  const parcel = parcelFor(params);
  const origin = centroid(parcel);
  const robust = params.mode === 'rules' || params.constraints.length > 0;
  const periph = params.roads.boundary;
  const inset: Region = robust
    ? periph > 0
      ? offsetRegion([parcel], -periph)
      : [parcel]
    : [naiveInset(parcel, periph)];
  const buffers = robust ? buildBuffers(params.constraints, inset) : [];
  const developable = buffers.length ? difference(inset, bufferUnion(buffers)) : inset;
  const depth = params.plots.depthFt * FT;
  const widths = sizeSequence(params.plots.sizes).map((sqyd) => ({ sqyd, width: (sqyd * SQYD) / depth }));
  return {
    params,
    parcel,
    origin,
    inset,
    buffers,
    developable,
    robust,
    widths,
    depth,
    minPlot: params.plots.minPlotM2,
    gross: area(parcel),
  };
}

type WorkBlock = Block & { fill: [number, number]; fillRegion: Region; endRoad: [boolean, boolean] };

/** Clip a region to a rectangle. Single-ring regions use v1 Sutherland–Hodgman; multi-ring use clipper. */
function clipRegion(r: Region, rect: Rect, robust: boolean): Region {
  if (!robust || r.length === 1) {
    const p = clipRect(r[0] ?? [], rect);
    return p.length >= 3 ? [p] : [];
  }
  return intersect(r, [rectPoly(rect)]);
}

const regArea = (r: Region): number => (r.length === 1 ? area(r[0]) : regionArea(r));

export function layoutWith(prep: Prepared, g: GridConfig, roadOverride?: { frontage: number; spine: number }): Layout {
  const { params, origin, depth, robust } = prep;
  const rules = params.mode === 'rules';
  const theta = (g.theta * Math.PI) / 180;
  const roadY = roadOverride?.frontage ?? params.roads.frontage;
  const roadX = roadOverride?.spine ?? params.roads.spine;
  const devRot = rotateRegion(prep.developable, -theta, origin);
  const insetRot = rotateRegion(prep.inset, -theta, origin);
  const bb = bbox(devRot.flat());
  const dTop = rules && params.plots.mixedDepths ? depth * 1.25 : depth;
  const bh = depth + dTop;
  const pitchY = bh + roadY;
  const pitchX = g.blockLen + roadX;
  const x0 = bb.x0 - g.offX * pitchX;
  const y0 = bb.y0 - g.offY * pitchY;
  const cols = Math.max(0, Math.ceil((bb.x1 - x0) / pitchX));
  const rows = Math.max(0, Math.ceil((bb.y1 - y0) / pitchY));
  const keepMin = 2.5 * prep.minPlot;
  const splayOn = rules && params.roads.splays;
  const splayLeg = splayForWidth(Math.max(roadX, roadY));
  const hasRoad = (p: Pt) => pointInRegion(p, insetRot);

  const blocks: WorkBlock[] = [];
  let fragments = 0;
  let splayArea = 0;
  const splayPolys: Poly[] = [];
  for (let j = 0; j < rows; j++) {
    const y = y0 + j * pitchY;
    for (let i = 0; i < cols; i++) {
      const x = x0 + i * pitchX;
      const rect: Rect = { x0: x, y0: y, x1: x + g.blockLen, y1: y + bh };
      let region = clipRegion(devRot, rect, robust);
      const a0 = region.length ? regArea(region) : 0;
      fragments += a0;
      if (a0 <= keepMin) continue;
      const midY = (rect.y0 + rect.y1) / 2;
      const endRoad: [boolean, boolean] = [
        hasRoad({ x: rect.x0 - roadX / 2, y: midY }),
        hasRoad({ x: rect.x1 + roadX / 2, y: midY }),
      ];
      if (splayOn) {
        const tris: Poly[] = [];
        const s = splayLeg;
        const corners: [Pt, number, number][] = [
          [{ x: rect.x0, y: rect.y0 }, 1, 1],
          [{ x: rect.x1, y: rect.y0 }, -1, 1],
          [{ x: rect.x1, y: rect.y1 }, -1, -1],
          [{ x: rect.x0, y: rect.y1 }, 1, -1],
        ];
        for (const [c, sx, sy] of corners) {
          if (!hasRoad({ x: c.x - (sx * roadX) / 2, y: c.y - (sy * roadY) / 2 })) continue;
          tris.push([c, { x: c.x + sx * s, y: c.y }, { x: c.x, y: c.y + sy * s }]);
        }
        const full = region.length === 1 && Math.abs(regArea(region) - rectArea(rect)) < 1e-6;
        if (tris.length && full) {
          // Fast path: an uncut rectangular block. Chamfer the junction corners directly.
          const cutAt = new Set(tris.map((t) => `${t[0].x},${t[0].y}`));
          const ring: Pt[] = [];
          for (const [c, sx, sy] of corners) {
            if (cutAt.has(`${c.x},${c.y}`)) {
              const a = sx === sy ? { x: c.x, y: c.y + sy * s } : { x: c.x + sx * s, y: c.y };
              const b = sx === sy ? { x: c.x + sx * s, y: c.y } : { x: c.x, y: c.y + sy * s };
              ring.push(a, b);
            } else ring.push(c);
          }
          splayArea += tris.length * (s * s) / 2;
          splayPolys.push(...tris);
          region = [ring];
        } else if (tris.length) {
          const cut = intersect(region, union(tris));
          const ca = regionArea(cut);
          if (ca > 0) {
            splayArea += ca;
            splayPolys.push(...cut);
            region = difference(region, cut);
          }
        }
      }
      const a = regArea(region);
      const c = regionCentroid(region);
      blocks.push({
        id: blocks.length,
        rect,
        region,
        area: a,
        dist: Math.hypot(c.x - origin.x, c.y - origin.y),
        use: 'plots',
        fill: [rect.x0, rect.x1],
        fillRegion: region,
        endRoad,
      });
    }
  }

  const open = assignOpen(prep, blocks, depth, theta);

  // Plots
  const plots: Plot[] = [];
  const seq = prep.widths;
  let k = 0;
  if (seq.length) {
    for (const b of blocks) {
      if (b.use !== 'plots') continue;
      const [xa, xb] = b.fill;
      for (const fs of [-1, 1] as const) {
        const rd = fs === -1 ? depth : dTop;
        const ry0 = fs === -1 ? b.rect.y0 : b.rect.y0 + depth;
        const ry1 = ry0 + rd;
        const row: Plot[] = [];
        let x = xa;
        while (x < xb - 1e-9) {
          const s0 = seq[k % seq.length];
          k++;
          const w = rd === depth ? s0 : { sqyd: s0.sqyd, width: (s0.sqyd * SQYD) / rd };
          const prect: Rect = { x0: x, y0: ry0, x1: x + w.width, y1: ry1 };
          x += w.width;
          const reg = clipRegion(b.fillRegion, prect, robust);
          if (!reg.length) continue;
          const pa = regArea(reg);
          const full = w.width * rd;
          if (pa < 0.6 * full || pa < prep.minPlot) continue;
          if (rules && params.plots.minWidth > 0 && w.width < params.plots.minWidth) continue;
          const p: Plot = {
            no: 0,
            blockId: b.id,
            row: fs,
            rect: prect,
            region: reg,
            area: pa,
            width: w.width,
            depth: rd,
            sizeSqYd: w.sqyd,
            irregular: pa < 0.965 * full,
            corner: false,
            facing: 'N',
            multiplier: 1,
            mortgaged: false,
            centroid: { x: 0, y: 0 },
          };
          row.push(p);
        }
        if (row.length) {
          if (rules) {
            for (const p of row) {
              const atStart = p.rect.x0 <= xa + 1e-6 && xa === b.rect.x0 && b.endRoad[0];
              const atEnd = p.rect.x1 >= xb - 1e-6 && xb === b.rect.x1 && b.endRoad[1];
              p.corner = atStart || atEnd;
            }
          } else {
            row[0].corner = true;
            row[row.length - 1].corner = true;
          }
          plots.push(...row);
        }
      }
    }
  }

  const geom: GridGeom = { x0, y0, pitchX, pitchY, blockLen: g.blockLen, depth2: bh, roadX, roadY, cols, rows };
  const runs = roadRuns(
    insetRot,
    geom,
    blocks.map((b) => b.rect),
    theta,
    origin,
  );

  annotate(plots, params, theta, origin);

  const toWorld = (r: Region) => rotateRegion(r, theta, origin);
  const worldBlocks: Block[] = blocks.map((b) => ({
    id: b.id,
    rect: b.rect,
    region: toWorld(b.region),
    area: b.area,
    dist: b.dist,
    use: b.use,
  }));
  const worldOpen = open.map((o) => ({ ...o, region: toWorld(o.region) }));

  const layout: Layout = {
    params,
    parcel: prep.parcel,
    inset: prep.inset,
    developable: prep.developable,
    theta: g.theta,
    blockLen: g.blockLen,
    blocks: worldBlocks,
    plots,
    open: worldOpen,
    roadRuns: runs,
    buffers: prep.buffers,
    splays: toWorld(splayPolys),
    gross: prep.gross,
    netLayout: prep.gross,
    plotted: plots.reduce((s, p) => s + p.area, 0),
    openArea: worldOpen.reduce((s, o) => s + o.area, 0),
    areaLines: [],
    frontage: roadY,
    spine: roadX,
    bounds: bbox(prep.parcel),
  };
  areaStatement(layout, prep, { fragments, splayArea });
  return layout;
}

/** Generate with road-hierarchy upgrade: runs longer than 600 m are upgraded to 18 m and regenerated once. */
export function generate(params: Params, g?: GridConfig, prep?: Prepared): Layout {
  const p = prep ?? prepare(params);
  const grid = g ?? gridFromParams(params);
  const first = layoutWith(p, grid);
  if (params.mode !== 'rules' || !params.roads.hierarchy) return first;
  const longF = first.roadRuns.some((r) => r.axis === 'frontage' && r.length > 600);
  const longS = first.roadRuns.some((r) => r.axis === 'spine' && r.length > 600);
  if (!longF && !longS) return first;
  return layoutWith(p, grid, {
    frontage: longF ? Math.max(18, params.roads.frontage) : params.roads.frontage,
    spine: longS ? Math.max(18, params.roads.spine) : params.roads.spine,
  });
}

export function gridFromParams(params: Params): GridConfig {
  return {
    theta: params.grid.theta,
    blockLen: params.plots.blockLen * params.grid.blockLenFactor,
    offX: params.grid.offX,
    offY: params.grid.offY,
  };
}

export type { WorkBlock };
