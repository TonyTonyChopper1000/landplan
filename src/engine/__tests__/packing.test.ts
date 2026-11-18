import { describe, expect, it } from 'vitest';
import { packRow } from '../packing';
import { FT } from '../geometry';
import { V1_MIX } from '../defaults';

describe('DP row packing', () => {
  const depth = 60 * FT;
  it('uses whole-foot widths and respects the minimum width', () => {
    const r = packRow(150, depth, V1_MIX, 6);
    expect(r.widths.length).toBeGreaterThan(5);
    for (const w of r.widths) expect(w.width).toBeGreaterThanOrEqual(6 - 1e-9);
  });
  it('fills the frontage within stretch tolerance or reports the leftover', () => {
    for (const L of [60, 97.3, 150, 233.7]) {
      const r = packRow(L, depth, V1_MIX, 0);
      const used = r.widths.reduce((s, w) => s + w.width, 0);
      expect(used).toBeLessThanOrEqual(L + 0.4 * 25 * FT + 1e-6);
      if (r.leftover > 0) expect(r.leftover).toBeGreaterThan(0.02 * L - 1e-9);
    }
  });
  it('is deterministic', () => {
    expect(packRow(150, depth, V1_MIX)).toEqual(packRow(150, depth, V1_MIX));
  });
});
