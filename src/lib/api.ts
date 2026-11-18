// Thin client for the LandPlan API (same origin by default; set VITE_API_BASE to point elsewhere).
import type { Params } from '@/engine/types';

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '';
const KEY = import.meta.env.VITE_API_KEY as string | undefined;
const headers = (): Record<string, string> => ({ 'content-type': 'application/json', ...(KEY ? { 'x-api-key': KEY } : {}) });

let healthy: Promise<boolean> | null = null;
export function apiAvailable(): Promise<boolean> {
  if (!healthy)
    healthy = fetch(`${BASE}/v1/health`, { signal: AbortSignal.timeout(2500) })
      .then((r) => r.ok && (r.headers.get('content-type') ?? '').includes('json'))
      .catch(() => false);
  return healthy;
}

export type ServerTop = { params: Params; kpis: { plots: number }; evaluation?: { score: number } };

/** Optimize on the server, streaming SSE progress. Resolves with the best layout's params. */
export async function optimizeOnServer(params: Params, onProgress: (evaluated: number) => void, signal: AbortSignal): Promise<ServerTop[]> {
  const res = await fetch(`${BASE}/v1/layouts/optimize?stream=1`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ params, engine: params.mode === 'parity' ? 'v1' : 'v2', budgetMs: 20000 }),
    signal,
  });
  if (!res.ok || !res.body) throw new Error(`Server optimize failed (${res.status})`);
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = '';
  let result: { top?: ServerTop[] } | null = null;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += value;
    let i: number;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const block = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const ev = /^event: (.*)$/m.exec(block)?.[1];
      const data = /^data: (.*)$/m.exec(block)?.[1];
      if (!ev || !data) continue;
      if (ev === 'progress') onProgress((JSON.parse(data) as { evaluated: number }).evaluated);
      if (ev === 'result') result = JSON.parse(data);
      if (ev === 'failed') throw new Error('Server optimization failed');
    }
  }
  if (!result?.top?.length) throw new Error('Server returned no layouts');
  return result.top;
}
