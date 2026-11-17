import { ROAD_TABLE, type RoadBand } from '../rules/regulations';
import { horizontalRuns, rotate, verticalRuns, type Pt, type Rect, type Region } from './geometry';
import type { RoadRun } from './types';

/** Band lookup. Boundaries are inclusive (≤600, ≤1000), fixing v1's "unknown" at exactly 1000 m. */
export function bandFor(length: number): RoadBand {
  return ROAD_TABLE.find((b) => length <= b.maxLen) ?? ROAD_TABLE[ROAD_TABLE.length - 1];
}

/** Splay leg for a road of a given ROW, from the road table. */
export function splayForWidth(width: number): number {
  const b = ROAD_TABLE.find((x) => width <= x.row + 0.5) ?? ROAD_TABLE[ROAD_TABLE.length - 1];
  return b.splay;
}

type GridGeom = {
  x0: number;
  y0: number;
  pitchX: number;
  pitchY: number;
  blockLen: number;
  depth2: number;
  roadX: number;
  roadY: number;
  cols: number;
  rows: number;
};

/** Intersect road centrelines with the (rotated) inset parcel; keep runs that serve a kept block. */
export function roadRuns(
  insetRot: Region,
  g: GridGeom,
  kept: Rect[],
  theta: number,
  origin: Pt,
): RoadRun[] {
  const runs: RoadRun[] = [];
  const toWorld = (p: Pt) => rotate(p, theta, origin);
  const eps = 1e-6;
  for (let j = -1; j < g.rows; j++) {
    const yc = g.y0 + j * g.pitchY + g.depth2 + g.roadY / 2;
    for (const [a, b] of horizontalRuns(insetRot, yc)) {
      const serves = kept.some(
        (r) =>
          (Math.abs(r.y0 - (yc + g.roadY / 2)) < eps || Math.abs(r.y1 - (yc - g.roadY / 2)) < eps) &&
          r.x1 > a &&
          r.x0 < b,
      );
      if (!serves) continue;
      const length = b - a;
      const band = bandFor(length);
      runs.push({
        id: `F${runs.length + 1}`,
        axis: 'frontage',
        a: toWorld({ x: a, y: yc }),
        b: toWorld({ x: b, y: yc }),
        length,
        width: g.roadY,
        requiredRow: band.row,
        splay: band.splay,
        carriageway: band.carriageway,
      });
    }
  }
  for (let i = -1; i < g.cols; i++) {
    const xc = g.x0 + i * g.pitchX + g.blockLen + g.roadX / 2;
    for (const [a, b] of verticalRuns(insetRot, xc)) {
      const serves = kept.some(
        (r) =>
          (Math.abs(r.x0 - (xc + g.roadX / 2)) < eps || Math.abs(r.x1 - (xc - g.roadX / 2)) < eps) &&
          r.y1 > a &&
          r.y0 < b,
      );
      if (!serves) continue;
      const length = b - a;
      const band = bandFor(length);
      runs.push({
        id: `S${runs.filter((r) => r.axis === 'spine').length + 1}`,
        axis: 'spine',
        a: toWorld({ x: xc, y: a }),
        b: toWorld({ x: xc, y: b }),
        length,
        width: g.roadX,
        requiredRow: band.row,
        splay: band.splay,
        carriageway: band.carriageway,
      });
    }
  }
  return runs;
}

export type { GridGeom };
