// Vercel Node.js function entry (bundled by scripts/build-vercel.mjs into .vercel/output).
import type { IncomingMessage, ServerResponse } from 'node:http';
import { nodeHandler } from './node';

type Ctx = { waitUntil?: (p: Promise<unknown>) => void };
const CTX = Symbol.for('@vercel/request-context');

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const ctx = (globalThis as unknown as Record<symbol, { get?: () => Ctx } | undefined>)[CTX]?.get?.();
  (globalThis as { __vercelWaitUntil?: (p: Promise<unknown>) => void }).__vercelWaitUntil = ctx?.waitUntil;
  await nodeHandler(req, res);
}
