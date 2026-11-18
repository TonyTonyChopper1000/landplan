import { describe, expect, it } from 'vitest';
import { handle } from '../routes';
import type { Req, Res } from '../http';

const call = (method: string, path: string, body?: unknown, q = '', headers: Record<string, string> = {}) =>
  handle({ method, path, query: new URLSearchParams(q), headers, body, ip: '127.0.0.1' } as Req);
const body = (r: Res) => ('json' in r ? (r.json as Record<string, unknown>) : {});

describe('API /v1', () => {
  it('health, rules with ETag, profiles', async () => {
    expect((await call('GET', '/health')).status).toBe(200);
    const r = await call('GET', '/rules');
    expect(r.status).toBe(200);
    const etag = r.headers?.etag ?? '';
    expect((await call('GET', '/rules', undefined, '', { 'if-none-match': etag })).status).toBe(304);
    expect((await call('GET', '/rules/profiles/dtcp')).status).toBe(200);
    expect((await call('GET', '/rules/profiles/xyz')).status).toBe(404);
  });
  it('generate returns a balanced LayoutResult and caches by input hash', async () => {
    const a = await call('POST', '/layouts/generate', { params: { site: { acres: 12 } } });
    expect(a.status).toBe(200);
    const d = body(a) as { areaStatement: { areaM2: number }[]; features: { features: unknown[] }; kpis: { plots: number }; inputHash: string };
    expect(d.kpis.plots).toBeGreaterThan(50);
    expect(d.features.features.length).toBeGreaterThan(d.kpis.plots);
    const b = await call('POST', '/layouts/generate', { params: { site: { acres: 12 } } });
    expect(b.headers?.['x-cache']).toBe('hit');
  });
  it('validation errors are RFC 7807', async () => {
    const r = await call('POST', '/layouts/generate', { params: { roads: { frontage: -1 } } });
    expect(r.status).toBe(400);
    expect(r.headers?.['content-type']).toBe('application/problem+json');
    expect(body(r).errors).toBeTruthy();
    expect((await call('POST', '/layouts/generate', { params: { site: { acres: 500 } } })).status).toBe(413);
  });
  it('optimize runs inline without a database and stores the job', async () => {
    const r = await call('POST', '/layouts/optimize', { params: { site: { acres: 10 } }, maxCandidates: 120 });
    expect(r.status).toBe(202);
    const j = body(r) as { jobId: string; status: string };
    expect(j.status).toBe('done');
    expect((await call('GET', `/jobs/${j.jobId}`)).status).toBe(200);
    expect((await call('GET', `/jobs/${j.jobId}/result`)).status).toBe(200);
  }, 30000);
  it('projects and scenarios CRUD, exports', async () => {
    const p = body(await call('POST', '/projects', { name: 'Test' })) as { id: string };
    const s = await call('POST', `/projects/${p.id}/scenarios`, { name: 'A', params: { site: { acres: 9 } } });
    expect(s.status).toBe(201);
    const sid = (body(s) as { id: string }).id;
    expect((await call('PUT', `/projects/${p.id}/scenarios/${sid}`, { name: 'B' })).status).toBe(200);
    const ex = await call('POST', '/exports', { format: 'dxf', scenarioId: sid });
    expect(ex.status).toBe(200);
    expect('text' in ex && ex.text.includes('POLYLINE')).toBe(true);
    expect((await call('DELETE', `/projects/${p.id}`)).status).toBe(204);
  });
  it('API keys are enforced when configured', async () => {
    process.env.API_KEYS = 'k1';
    try {
      expect((await call('GET', '/rules')).status).toBe(401);
      expect((await call('GET', '/rules', undefined, '', { 'x-api-key': 'k1' })).status).toBe(200);
      expect((await call('GET', '/health')).status).toBe(200);
    } finally {
      delete process.env.API_KEYS;
    }
  });
  it('benchmark harness reports share errors', async () => {
    const r = body(await call('POST', '/benchmarks/run')) as { benchmarks: { meanAbsErrorPctPoints: number }[] };
    expect(r.benchmarks[0].meanAbsErrorPctPoints).toBeLessThan(10);
  }, 30000);
});
