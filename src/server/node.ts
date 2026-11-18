// Adapter from Node's http (also Vercel's Node runtime) to the framework-free handler.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { handle } from './routes';

const MAX_BODY = 12 * 1024 * 1024;

async function readBody(req: IncomingMessage & { body?: unknown }): Promise<unknown> {
  if (req.body !== undefined) return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > MAX_BODY) throw Object.assign(new Error('Body too large'), { status: 413 });
    chunks.push(c as Buffer);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : undefined;
}

export async function nodeHandler(req: IncomingMessage & { body?: unknown }, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const path = url.pathname.replace(/^\/api/, '').replace(/^\/v1/, '') || '/';
  const cors = { 'access-control-allow-origin': process.env.CORS_ORIGIN ?? '*', 'access-control-allow-headers': 'content-type, x-api-key, authorization', 'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS' };
  let body: unknown;
  try {
    body = req.method === 'GET' || req.method === 'HEAD' || req.method === 'DELETE' ? undefined : await readBody(req);
  } catch (e) {
    const status = (e as { status?: number }).status ?? 400;
    res.writeHead(status, { 'content-type': 'application/problem+json', ...cors });
    res.end(JSON.stringify({ type: 'about:blank', title: status === 413 ? 'Payload too large' : 'Malformed JSON', status }));
    return;
  }
  const headers: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(req.headers)) headers[k.toLowerCase()] = Array.isArray(v) ? v[0] : v;
  const ip = (headers['x-forwarded-for'] ?? '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
  const out = await handle({ method: req.method ?? 'GET', path, query: url.searchParams, headers, body, ip });
  const h = { ...cors, ...(out.headers ?? {}) };
  if ('json' in out) {
    res.writeHead(out.status, { 'content-type': 'application/json; charset=utf-8', ...h });
    res.end(JSON.stringify(out.json));
  } else if ('text' in out) {
    res.writeHead(out.status, { 'content-type': out.contentType, ...h });
    res.end(out.text);
  } else {
    res.writeHead(out.status, { 'content-type': out.contentType, connection: 'keep-alive', ...h });
    await out.stream((chunk) => res.write(chunk));
    res.end();
  }
}
