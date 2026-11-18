import { RULES, RULES_VERSION, CONFLICT_GROUPS, DOCUMENT_CHECKS } from '../rules/regulations';
import { PROFILES, rulesFor } from '../rules/profiles';
import { intake, SiteError, type SiteInput } from '../engine/site';
import { AreaBalanceError } from '../engine/areas';
import { generate } from '../engine/layout';
import { GenerateRequestSchema, ExportRequestSchema, ImportRequestSchema, OptimizeRequestSchema } from '../schemas';
import type { Authority } from '../engine/types';
import { Problem, json, type Req, type Res } from './http';
import { authenticate, rateLimit } from './auth';
import { getStorage, type Job } from './storage';
import { generateHash, generateResult, optimizeResult, paramsFor } from './engine';
import { resolveParams } from './params';
import { openApiDocument, swaggerHtml } from './openapi';
import { exportFile } from './exports';
import { runBenchmarks } from './benchmarks';

const id = (p: string) => `${p}_${Date.now().toString(36)}${Math.floor(Math.random() * 1e9).toString(36)}`;
const now = () => new Date().toISOString();
const running = new Map<string, AbortController>();

function parse<T>(schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } } }, body: unknown): T {
  const r = schema.safeParse(body ?? {});
  if (!r.success) throw new Problem(400, 'Invalid request body', 'The request body failed validation.', { errors: r.error.issues.map((i) => ({ path: i.path.map(String).join('.'), message: i.message })) });
  return r.data;
}

function bearingsCsv(csv: string) {
  return csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !/^[a-z#]/i.test(l))
    .map((l) => {
      const [b, d] = l.split(/[,;\t]/).map((x) => Number(x.trim()));
      return { bearing: b, distance: d };
    });
}

type Handler = (req: Req, m: string[]) => Promise<Res>;
const routes: [string, RegExp, Handler][] = [
  ['GET', /^\/health$/, async () => {
    const s = await getStorage();
    return json(200, { ok: true, engineVersion: '2.0.0', rulesVersion: RULES_VERSION, storage: s.persistent ? 'postgres' : 'memory' });
  }],
  ['GET', /^\/openapi\.json$/, async () => json(200, openApiDocument())],
  ['GET', /^\/docs\/?$/, async () => ({ status: 200, text: swaggerHtml(), contentType: 'text/html; charset=utf-8' })],
  ['GET', /^\/rules$/, async (req) => {
    const etag = `"rules-${RULES_VERSION}"`;
    if (req.headers['if-none-match'] === etag) return { status: 304, text: '', contentType: 'text/plain', headers: { etag } };
    return json(200, { version: RULES_VERSION, rules: RULES, conflictGroups: CONFLICT_GROUPS, documentChecks: DOCUMENT_CHECKS }, { etag, 'cache-control': 'public, max-age=300' });
  }],
  ['GET', /^\/rules\/profiles\/([A-Za-z]+)$/, async (_req, m) => {
    const a = m[1].toUpperCase() as Authority;
    const prof = PROFILES[a];
    if (!prof) throw new Problem(404, 'Unknown authority', `Use one of ${Object.keys(PROFILES).join(', ')}.`);
    return json(200, { version: RULES_VERSION, profile: prof, rules: rulesFor(a).map((r) => r.id) }, { etag: `"profile-${a}-${RULES_VERSION}"` });
  }],
  ['POST', /^\/parcels\/import$/, async (req) => {
    const body = parse(ImportRequestSchema, req.body);
    const input: SiteInput = body.kind === 'bearings-csv' ? { kind: 'bearings', rows: bearingsCsv(body.csv) } : (body as SiteInput);
    try {
      return json(200, intake(input, { acres: body.recordAcres, guntas: body.recordGuntas, tolPct: body.tolerancePct }));
    } catch (e) {
      if (e instanceof SiteError) throw new Problem(422, 'Parcel rejected', e.message, { code: e.code });
      throw e;
    }
  }],
  ['POST', /^\/layouts\/generate$/, async (req) => {
    const body = parse(GenerateRequestSchema, req.body);
    const params = paramsFor(body.params, body.engine);
    const output = req.query.get('crs') === 'wgs84' ? 'wgs84' : 'local';
    const store = await getStorage();
    const opts = { engine: body.engine, seed: body.seed, optimizeGrid: body.optimizeGrid, output } as const;
    const key = await generateHash(params, opts);
    const cached = await store.cacheGet(key).catch(() => null);
    if (cached) return json(200, cached, { 'x-cache': 'hit', etag: `"${key}"` });
    const { hash, result } = await generateResult(params, opts);
    await store.cachePut(hash, result).catch(() => undefined);
    return json(200, result, { 'x-cache': 'miss', etag: `"${hash}"` });
  }],
  ['POST', /^\/layouts\/optimize$/, async (req) => {
    const body = parse(OptimizeRequestSchema, req.body);
    const params = paramsFor(body.params, body.engine);
    const output = req.query.get('crs') === 'wgs84' ? 'wgs84' : 'local';
    const store = await getStorage();
    const job: Job = { id: id('job'), kind: 'optimize', status: 'running', progress: null, inputHash: '', result: null, error: null, createdAt: now(), updatedAt: now() };
    await store.putJob(job);
    const ctrl = new AbortController();
    running.set(job.id, ctrl);
    const run = async (onEvent?: (ev: string, data: unknown) => void) => {
      let lastSave = 0;
      try {
        const { hash, result } = await optimizeResult(params, {
          engine: body.engine,
          output,
          seed: body.seed,
          budgetMs: body.budgetMs,
          maxCandidates: body.maxCandidates,
          weights: body.weights,
          signal: ctrl.signal,
          onProgress: (p) => {
            job.progress = p;
            onEvent?.('progress', p);
            if (store.persistent && Date.now() - lastSave > 1000) {
              lastSave = Date.now();
              void store.putJob({ ...job, updatedAt: now() }).catch(() => undefined);
            }
          },
        });
        Object.assign(job, { inputHash: hash, result, status: ctrl.signal.aborted ? 'cancelled' : 'done', updatedAt: now() });
      } catch (e) {
        Object.assign(job, { status: 'failed', error: e instanceof Error ? e.message : String(e), updatedAt: now() });
      } finally {
        running.delete(job.id);
        await store.putJob(job);
        onEvent?.(job.status, { jobId: job.id, status: job.status, error: job.error });
      }
    };
    if (req.query.get('stream') === '1')
      return {
        status: 200,
        contentType: 'text/event-stream',
        headers: { 'cache-control': 'no-cache', 'x-job-id': job.id },
        stream: async (write) => {
          write(`event: job\ndata: ${JSON.stringify({ jobId: job.id })}\n\n`);
          await run((ev, data) => write(`event: ${ev}\ndata: ${JSON.stringify(data)}\n\n`));
          write(`event: result\ndata: ${JSON.stringify(job.result)}\n\n`);
        },
      };
    const links = { status: `/v1/jobs/${job.id}`, events: `/v1/jobs/${job.id}/events`, result: `/v1/jobs/${job.id}/result` };
    // Serverless instances don't share memory, so without a database the job runs inside this request.
    if (!store.persistent || req.query.get('wait') === '1') {
      await run();
      return json(202, { jobId: job.id, status: job.status, links, result: job.result, note: store.persistent ? undefined : 'No DATABASE_URL: job ran inline and its result is included.' });
    }
    const p = run();
    const wu = (globalThis as { __vercelWaitUntil?: (p: Promise<unknown>) => void }).__vercelWaitUntil;
    if (wu) wu(p);
    return json(202, { jobId: job.id, status: 'running', links });
  }],
  ['GET', /^\/jobs\/([\w-]+)$/, async (_req, m) => {
    const j = await (await getStorage()).getJob(m[1]);
    if (!j) throw new Problem(404, 'Job not found');
    const { result: _r, ...rest } = j;
    void _r;
    return json(200, rest);
  }],
  ['GET', /^\/jobs\/([\w-]+)\/result$/, async (_req, m) => {
    const j = await (await getStorage()).getJob(m[1]);
    if (!j) throw new Problem(404, 'Job not found');
    if (j.status !== 'done' && j.status !== 'cancelled') throw new Problem(409, 'Job not finished', `Status is ${j.status}.`);
    return json(200, j.result);
  }],
  ['GET', /^\/jobs\/([\w-]+)\/events$/, async (_req, m) => {
    const store = await getStorage();
    const first = await store.getJob(m[1]);
    if (!first) throw new Problem(404, 'Job not found');
    return {
      status: 200,
      contentType: 'text/event-stream',
      headers: { 'cache-control': 'no-cache' },
      stream: async (write) => {
        const deadline = Date.now() + 55000;
        for (;;) {
          const j = await store.getJob(m[1]);
          if (!j) return;
          write(`event: ${j.status === 'running' || j.status === 'queued' ? 'progress' : j.status}\ndata: ${JSON.stringify({ status: j.status, progress: j.progress })}\n\n`);
          if (j.status !== 'running' && j.status !== 'queued') return;
          if (Date.now() > deadline) return;
          await new Promise((r) => setTimeout(r, 750));
        }
      },
    };
  }],
  ['DELETE', /^\/jobs\/([\w-]+)$/, async (_req, m) => {
    const store = await getStorage();
    const j = await store.getJob(m[1]);
    if (!j) throw new Problem(404, 'Job not found');
    running.get(j.id)?.abort();
    if (j.status === 'running' || j.status === 'queued') await store.putJob({ ...j, status: 'cancelled', updatedAt: now() });
    return json(202, { jobId: j.id, status: 'cancelled' });
  }],
  ['GET', /^\/projects$/, async () => json(200, await (await getStorage()).listProjects())],
  ['POST', /^\/projects$/, async (req) => {
    const name = String((req.body as { name?: unknown })?.name ?? 'Untitled project').slice(0, 200);
    const t = now();
    return json(201, await (await getStorage()).createProject({ id: id('prj'), name, createdAt: t, updatedAt: t }));
  }],
  ['GET', /^\/projects\/([\w-]+)$/, async (_req, m) => {
    const s = await getStorage();
    const p = await s.getProject(m[1]);
    if (!p) throw new Problem(404, 'Project not found');
    return json(200, { ...p, scenarios: (await s.listScenarios(p.id)).map(({ params: _p, ...x }) => (void _p, x)) });
  }],
  ['PATCH', /^\/projects\/([\w-]+)$/, async (req, m) => {
    const p = await (await getStorage()).updateProject(m[1], String((req.body as { name?: unknown })?.name ?? '').slice(0, 200) || 'Untitled project');
    if (!p) throw new Problem(404, 'Project not found');
    return json(200, p);
  }],
  ['DELETE', /^\/projects\/([\w-]+)$/, async (_req, m) => {
    if (!(await (await getStorage()).deleteProject(m[1]))) throw new Problem(404, 'Project not found');
    return { status: 204, text: '', contentType: 'text/plain' };
  }],
  ['GET', /^\/projects\/([\w-]+)\/scenarios$/, async (_req, m) => json(200, await (await getStorage()).listScenarios(m[1]))],
  ['POST', /^\/projects\/([\w-]+)\/scenarios$/, async (req, m) => {
    const s = await getStorage();
    if (!(await s.getProject(m[1]))) throw new Problem(404, 'Project not found');
    const b = (req.body ?? {}) as { name?: unknown; params?: unknown };
    const t = now();
    return json(201, await s.upsertScenario({ id: id('scn'), projectId: m[1], name: String(b.name ?? 'Scenario').slice(0, 200), params: resolveParams(b.params), createdAt: t, updatedAt: t }));
  }],
  ['GET', /^\/projects\/([\w-]+)\/scenarios\/([\w-]+)$/, async (_req, m) => {
    const sc = await (await getStorage()).getScenario(m[2]);
    if (!sc || sc.projectId !== m[1]) throw new Problem(404, 'Scenario not found');
    return json(200, sc);
  }],
  ['PUT', /^\/projects\/([\w-]+)\/scenarios\/([\w-]+)$/, async (req, m) => {
    const s = await getStorage();
    const sc = await s.getScenario(m[2]);
    if (!sc || sc.projectId !== m[1]) throw new Problem(404, 'Scenario not found');
    const b = (req.body ?? {}) as { name?: unknown; params?: unknown };
    return json(200, await s.upsertScenario({ ...sc, name: b.name ? String(b.name).slice(0, 200) : sc.name, params: b.params ? resolveParams(b.params) : sc.params, updatedAt: now() }));
  }],
  ['DELETE', /^\/projects\/([\w-]+)\/scenarios\/([\w-]+)$/, async (_req, m) => {
    if (!(await (await getStorage()).deleteScenario(m[2]))) throw new Problem(404, 'Scenario not found');
    return { status: 204, text: '', contentType: 'text/plain' };
  }],
  ['POST', /^\/exports$/, async (req) => {
    const body = parse(ExportRequestSchema, req.body);
    let params = body.params;
    if (body.scenarioId) {
      const sc = await (await getStorage()).getScenario(body.scenarioId);
      if (!sc) throw new Problem(404, 'Scenario not found');
      params = sc.params as unknown as Record<string, unknown>;
    }
    const layout = generate(resolveParams(params));
    return exportFile(body.format, layout);
  }],
  ['POST', /^\/benchmarks\/run$/, async () => json(200, await runBenchmarks())],
];

export async function handle(req: Req): Promise<Res> {
  try {
    if (req.method === 'OPTIONS') return { status: 204, text: '', contentType: 'text/plain' };
    const open = req.path === '/health' || req.path === '/docs' || req.path === '/docs/' || req.path === '/openapi.json';
    if (!open) rateLimit(authenticate(req));
    let pathMatched = false;
    for (const [method, re, h] of routes) {
      const m = re.exec(req.path);
      if (!m) continue;
      pathMatched = true;
      if (method === req.method) return await h(req, Array.from(m));
    }
    if (pathMatched) throw new Problem(405, 'Method not allowed');
    throw new Problem(404, 'Not found', `No route for ${req.method} /v1${req.path}`);
  } catch (e) {
    if (e instanceof Problem) return { status: e.status, json: e.toJSON(), headers: { 'content-type': 'application/problem+json' } };
    if (e instanceof AreaBalanceError) return { status: 500, json: new Problem(500, 'Area balance error', e.message).toJSON(), headers: { 'content-type': 'application/problem+json' } };
    const msg = e instanceof Error ? e.message : String(e);
    return { status: 500, json: new Problem(500, 'Internal error', msg).toJSON(), headers: { 'content-type': 'application/problem+json' } };
  }
}
