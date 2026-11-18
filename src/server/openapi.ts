import { z } from 'zod';
import { ExportRequestSchema, GenerateRequestSchema, ImportRequestSchema, LayoutResultSchema, OptimizeRequestSchema, ParamsSchema } from '../schemas';

const js = (s: z.ZodType) => z.toJSONSchema(s, { unrepresentable: 'any', io: 'input' }) as Record<string, unknown>;
const ref = (n: string) => ({ $ref: `#/components/schemas/${n}` });
const body = (n: string) => ({ required: true, content: { 'application/json': { schema: ref(n) } } });
const ok = (d: string, schema?: object) => ({ description: d, content: { 'application/json': { schema: schema ?? { type: 'object' } } } });
const problem = { description: 'RFC 7807 problem', content: { 'application/problem+json': { schema: ref('Problem') } } };

let cached: object | null = null;
export function openApiDocument(): object {
  if (cached) return cached;
  cached = {
    openapi: '3.1.0',
    info: { title: 'LandPlan Studio API', version: '2.0.0', description: 'Plotted-layout generation, rule checks and feasibility for Telangana (HMDA / DTCP / GO Ms 105). Yield study only — not a submission drawing.' },
    servers: [{ url: '/v1' }],
    components: {
      securitySchemes: { apiKey: { type: 'apiKey', in: 'header', name: 'x-api-key' } },
      schemas: {
        Params: js(ParamsSchema),
        GenerateRequest: js(GenerateRequestSchema),
        OptimizeRequest: js(OptimizeRequestSchema),
        ImportRequest: js(ImportRequestSchema),
        ExportRequest: js(ExportRequestSchema),
        LayoutResult: js(LayoutResultSchema),
        Problem: { type: 'object', properties: { type: { type: 'string' }, title: { type: 'string' }, status: { type: 'integer' }, detail: { type: 'string' } } },
      },
    },
    security: [{ apiKey: [] }],
    paths: {
      '/health': { get: { summary: 'Health and storage mode', security: [], responses: { 200: ok('OK') } } },
      '/parcels/import': { post: { summary: 'Import GeoJSON, KML, DXF or bearings → cleaned parcel + area reconciliation', requestBody: body('ImportRequest'), responses: { 200: ok('Parcel'), 400: problem, 422: problem } } },
      '/layouts/generate': { post: { summary: 'Generate one layout synchronously (≤ 3 s budget)', parameters: [{ name: 'crs', in: 'query', schema: { enum: ['local', 'wgs84'] } }], requestBody: body('GenerateRequest'), responses: { 200: ok('LayoutResult', ref('LayoutResult')), 400: problem, 413: problem } } },
      '/layouts/optimize': { post: { summary: 'Search for the best layouts (top-5 diverse + Pareto). ?stream=1 streams SSE progress.', parameters: [{ name: 'stream', in: 'query', schema: { enum: ['1'] } }, { name: 'wait', in: 'query', schema: { enum: ['1'] } }], requestBody: body('OptimizeRequest'), responses: { 202: ok('Job accepted'), 400: problem } } },
      '/jobs/{id}': { get: { summary: 'Job status and progress', responses: { 200: ok('Job'), 404: problem } }, delete: { summary: 'Cancel a job', responses: { 202: ok('Cancelled') } } },
      '/jobs/{id}/events': { get: { summary: 'Server-Sent Events progress stream', responses: { 200: { description: 'text/event-stream' } } } },
      '/jobs/{id}/result': { get: { summary: 'Top-5 LayoutResult[] + Pareto set', responses: { 200: ok('Result'), 409: problem } } },
      '/rules': { get: { summary: 'Rule library (versioned, ETag)', responses: { 200: ok('Rules'), 304: { description: 'Not modified' } } } },
      '/rules/profiles/{authority}': { get: { summary: 'Authority profile', responses: { 200: ok('Profile'), 404: problem } } },
      '/projects': { get: { summary: 'List projects', responses: { 200: ok('Projects') } }, post: { summary: 'Create project', responses: { 201: ok('Project') } } },
      '/projects/{id}': { get: { summary: 'Get project', responses: { 200: ok('Project') } }, patch: { summary: 'Rename project', responses: { 200: ok('Project') } }, delete: { summary: 'Delete project', responses: { 204: { description: 'Deleted' } } } },
      '/projects/{id}/scenarios': { get: { summary: 'List scenarios', responses: { 200: ok('Scenarios') } }, post: { summary: 'Create scenario', responses: { 201: ok('Scenario') } } },
      '/projects/{id}/scenarios/{sid}': { get: { summary: 'Get scenario', responses: { 200: ok('Scenario') } }, put: { summary: 'Update scenario', responses: { 200: ok('Scenario') } }, delete: { summary: 'Delete scenario', responses: { 204: { description: 'Deleted' } } } },
      '/exports': { post: { summary: 'Export SVG, DXF, GeoJSON or CSV (PDF/XLSX are generated in the browser)', requestBody: body('ExportRequest'), responses: { 200: { description: 'File' } } } },
      '/benchmarks/run': { post: { summary: 'Run the engine on the benchmark set', responses: { 200: ok('Metrics') } } },
    },
  };
  return cached;
}

export function swaggerHtml(): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>LandPlan Studio API</title>
<link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui.css"></head>
<body><div id="ui"></div><script src="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-bundle.js"></script>
<script>SwaggerUIBundle({ url: '/v1/openapi.json', dom_id: '#ui' });</script></body></html>`;
}
