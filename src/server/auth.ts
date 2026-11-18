import { Problem, type Req } from './http';

/** API-key stub (JWT/Cognito later). Open when API_KEYS is unset. */
export function authenticate(req: Req, env: Record<string, string | undefined> = process.env): string {
  const keys = (env.API_KEYS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const auth = req.headers['authorization'];
  const key = req.headers['x-api-key'] ?? (auth?.startsWith('Bearer ') ? auth.slice(7) : undefined);
  if (!keys.length) return key ?? `ip:${req.ip}`;
  if (!key || !keys.includes(key)) throw new Problem(401, 'Unauthorized', 'Send a valid key in the x-api-key header.');
  return key;
}

const buckets = new Map<string, { tokens: number; at: number }>();
/** Token bucket per key (per instance). */
export function rateLimit(id: string, perMinute = Number(process.env.RATE_LIMIT_PER_MIN ?? 120)): void {
  const now = Date.now();
  const b = buckets.get(id) ?? { tokens: perMinute, at: now };
  b.tokens = Math.min(perMinute, b.tokens + ((now - b.at) / 60000) * perMinute);
  b.at = now;
  if (b.tokens < 1) throw new Problem(429, 'Too many requests', `Limit is ${perMinute} requests per minute.`, { retryAfterSeconds: Math.ceil((1 - b.tokens) * (60 / perMinute)) });
  b.tokens -= 1;
  buckets.set(id, b);
  if (buckets.size > 5000) buckets.clear();
}
