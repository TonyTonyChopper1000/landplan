import { SQYD } from './geometry';
import { applyMortgage } from './mortgage';
import type { Layout, Params, Plot } from './types';

export type Month = { m: number; sales: number; spend: number; release: number; net: number; cumulative: number };
export type TornadoBar = { factor: string; low: number; high: number; lowLabel: string; highLabel: string };
export type Finance = {
  revenue: number;
  landCost: number;
  devCost: number;
  fees: number;
  roadImpact: number;
  totalCost: number;
  profit: number;
  marginPct: number;
  sellableNow: number;
  mortgagedValue: number;
  months: Month[];
  irr: number | null;
  npv: number;
  peakFunding: number;
  salesMonths: number;
};

export function plotPrice(p: Plot, params: Params): number {
  const o = params.inventory[p.no]?.price;
  if (o !== undefined && o > 0) return o;
  return (p.area / SQYD) * params.money.baseRate * p.multiplier;
}

export function roadImpactFee(params: Params, fees: number): number {
  const s = params.site;
  if (!params.money.roadImpactFee || s.approachExisting >= Math.max(18, s.approachMP)) return 0;
  return s.approachExisting >= 15 && s.approachMP <= 18 ? fees * 0.5 : fees;
}

function irrMonthly(flows: number[]): number | null {
  const npvAt = (r: number) => flows.reduce((s, f, i) => s + f / Math.pow(1 + r, i), 0);
  let lo = -0.9;
  let hi = 1;
  let flo = npvAt(lo);
  const fhi = npvAt(hi);
  if (!Number.isFinite(flo) || flo * fhi > 0) return null;
  for (let i = 0; i < 120; i++) {
    const mid = (lo + hi) / 2;
    const fm = npvAt(mid);
    if (flo * fm <= 0) hi = mid;
    else {
      lo = mid;
      flo = fm;
    }
  }
  return (lo + hi) / 2;
}

type Opts = { rate?: number; cost?: number; velocity?: number; mortPct?: number };

export function finance(layout: Layout, o: Opts = {}): Finance {
  const params = layout.params;
  const m = params.money;
  let plots = layout.plots;
  if (o.mortPct !== undefined) {
    plots = layout.plots.map((p) => ({ ...p }));
    applyMortgage(plots, o.mortPct, params.money.mortPolicy);
  }
  const rateK = o.rate ?? 1;
  const grossSqyd = layout.gross / SQYD;
  const landCost = (layout.gross / 4046.8564224) * m.landCost;
  const roadLen = layout.roadRuns.reduce((s, r) => s + r.length, 0);
  const devCost = (grossSqyd * m.devCost + roadLen * (m.roadCostPerM ?? 0) + layout.openArea * (m.openCostPerM2 ?? 0)) * (o.cost ?? 1);
  const fees = layout.gross * m.approvalFee;
  const roadImpact = roadImpactFee(params, fees);
  const velocity = Math.max(0.1, m.velocity * (o.velocity ?? 1));
  const price = (p: Plot) => plotPrice(p, params) * rateK;

  const sold = plots.filter((p) => params.inventory[p.no]?.status === 'Sold');
  const free = plots.filter((p) => !p.mortgaged && params.inventory[p.no]?.status !== 'Sold');
  const mort = plots.filter((p) => p.mortgaged && params.inventory[p.no]?.status !== 'Sold');
  const devMonths = Math.max(1, Math.min(24, m.releaseMonths || 24));
  const release = m.releaseMonths;

  const months: Month[] = [];
  let queue = [...free];
  let carry = 0;
  let revenue = 0;
  let cum = 0;
  let lastSale = 0;
  const esc = (mm: number) => Math.pow(1 + m.escalation / 100, mm / 12);
  for (let mm = 0; mm <= 240; mm++) {
    let sales = 0;
    let rel = 0;
    let spend = 0;
    if (mm === 0) {
      spend += landCost + fees + roadImpact;
      sales += sold.reduce((s, p) => s + price(p), 0);
    }
    if (mm >= 1 && mm <= devMonths) spend += devCost / devMonths;
    if (mm === release + 1 || (mm === 1 && release <= 0)) {
      rel = mort.reduce((s, p) => s + price(p), 0);
      queue = [...queue, ...mort];
    }
    if (mm >= 1) {
      carry += velocity;
      while (carry >= 1 && queue.length) {
        sales += price(queue.shift() as Plot) * esc(mm);
        carry -= 1;
        lastSale = mm;
      }
      if (!queue.length) carry = 0;
    }
    revenue += sales;
    const net = sales - spend;
    cum += net;
    months.push({ m: mm, sales, spend, release: rel, net, cumulative: cum });
    const pending = mm < release + 1 && mort.length > 0;
    if (mm > devMonths && !queue.length && !pending) break;
  }
  const totalCost = landCost + devCost + fees + roadImpact;
  const profit = revenue - totalCost;
  const flows = months.map((x) => x.net);
  const r = irrMonthly(flows);
  const disc = Math.pow(1 + m.discount / 100, 1 / 12) - 1;
  const npv = flows.reduce((s, f, i) => s + f / Math.pow(1 + disc, i), 0);
  const peak = Math.max(0, -Math.min(0, ...months.map((x) => x.cumulative)));
  const avail = (p: Plot) => {
    const st = params.inventory[p.no]?.status;
    return !st || st === 'Available';
  };
  return {
    revenue,
    landCost,
    devCost,
    fees,
    roadImpact,
    totalCost,
    profit,
    marginPct: revenue > 0 ? (profit / revenue) * 100 : 0,
    sellableNow: plots.filter((p) => !p.mortgaged && avail(p)).reduce((s, p) => s + price(p), 0),
    mortgagedValue: plots.filter((p) => p.mortgaged).reduce((s, p) => s + price(p), 0),
    months,
    irr: r === null ? null : (Math.pow(1 + r, 12) - 1) * 100,
    npv,
    peakFunding: peak,
    salesMonths: lastSale,
  };
}

export function tornado(layout: Layout): { base: number; bars: TornadoBar[] } {
  const base = finance(layout).npv;
  const mp = layout.params.money.mortPct;
  const bar = (factor: string, lo: Opts, hi: Opts, lowLabel: string, highLabel: string): TornadoBar => ({
    factor,
    low: finance(layout, lo).npv - base,
    high: finance(layout, hi).npv - base,
    lowLabel,
    highLabel,
  });
  const bars = [
    bar('Base rate', { rate: 0.9 }, { rate: 1.1 }, '−10%', '+10%'),
    bar('Dev cost', { cost: 1.1 }, { cost: 0.9 }, '+10%', '−10%'),
    bar('Sales velocity', { velocity: 0.75 }, { velocity: 1.25 }, '−25%', '+25%'),
    bar('Mortgage %', { mortPct: Math.min(100, mp + 10) }, { mortPct: Math.max(0, mp - 10) }, `${Math.min(100, mp + 10)}%`, `${Math.max(0, mp - 10)}%`),
  ];
  bars.sort((a, b) => Math.abs(b.high - b.low) - Math.abs(a.high - a.low));
  return { base, bars };
}
