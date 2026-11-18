// Project repository: Neon/Postgres through the API when the server has a database, else this browser (IndexedDB).
import { del, get, set } from 'idb-keyval';
import type { Params } from '@/engine/types';
import { decodeParams, encodeParams } from '@/lib/share';
import type { ProjectMeta, ProjectSummary } from './types';

export type StoredScenario = { id: string; name: string; params: Params; updatedAt: number };
export type ProjectBundle = { meta: ProjectMeta; scenarios: StoredScenario[]; activeId: string };
export type Backend = 'cloud' | 'browser';

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '';
const KEY = import.meta.env.VITE_API_KEY as string | undefined;
const H = (): Record<string, string> => ({ 'content-type': 'application/json', ...(KEY ? { 'x-api-key': KEY } : {}) });

let backend: Promise<Backend> | null = null;
export function detectBackend(): Promise<Backend> {
  if (!backend)
    backend = fetch(`${BASE}/v1/health`, { signal: AbortSignal.timeout(4000) })
      .then(async (r) => (r.ok && (await r.json()).storage === 'postgres' ? 'cloud' : 'browser'))
      .catch(() => 'browser' as const);
  return backend;
}

async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const r = await fetch(`${BASE}/v1${path}`, { method, headers: H(), body: body === undefined ? undefined : JSON.stringify(body) });
  if (!r.ok) {
    const p = (await r.json().catch(() => ({}))) as { detail?: string; title?: string };
    throw new Error(p.detail ?? p.title ?? `HTTP ${r.status}`);
  }
  return r.status === 204 ? (undefined as T) : ((await r.json()) as T);
}

type ServerProject = Omit<ProjectMeta, 'details' | 'summary'> & { details: unknown; summary: unknown; scenarios?: { id: string; name: string; params?: Params; updatedAt: string }[] };
const toMeta = (p: ServerProject): ProjectMeta => ({ ...p, details: p.details as ProjectMeta['details'], summary: (p.summary as ProjectSummary | null) ?? null });

const LIST = 'landplan:projects';
const pkey = (id: string) => `landplan:project:${id}`;
type LocalBundle = { scenarios: { id: string; name: string; p: string; updatedAt: number }[]; activeId: string };

async function localList(): Promise<ProjectMeta[]> {
  return ((await get(LIST)) as ProjectMeta[] | undefined) ?? [];
}

export const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}${Math.floor(Math.random() * 1e8).toString(36)}`;

export async function listProjects(): Promise<ProjectMeta[]> {
  if ((await detectBackend()) === 'cloud') return (await api<ServerProject[]>('GET', '/projects')).map(toMeta);
  return (await localList()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function createProject(meta: ProjectMeta, params: Params): Promise<ProjectMeta> {
  const scenarioId = newId('scn');
  if ((await detectBackend()) === 'cloud') {
    const p = await api<ServerProject>('POST', '/projects', { id: meta.id, name: meta.name, type: meta.type, details: meta.details, summary: meta.summary ?? undefined, scenario: { id: scenarioId, name: 'Base case', params } });
    return toMeta(p);
  }
  const m = { ...meta, activeScenario: scenarioId };
  await set(LIST, [m, ...(await localList()).filter((x) => x.id !== m.id)]);
  await set(pkey(m.id), { scenarios: [{ id: scenarioId, name: 'Base case', p: encodeParams(params), updatedAt: Date.now() }], activeId: scenarioId } satisfies LocalBundle);
  return m;
}

export async function loadProject(id: string): Promise<ProjectBundle | null> {
  if ((await detectBackend()) === 'cloud') {
    const p = await api<ServerProject>('GET', `/projects/${id}?include=params`).catch(() => null);
    if (!p) return null;
    const scenarios = (p.scenarios ?? []).filter((s) => s.params).map((s) => ({ id: s.id, name: s.name, params: decodeParams(encodeParams(s.params as Params)) as Params, updatedAt: Date.parse(s.updatedAt) }));
    const meta = toMeta(p);
    return { meta, scenarios, activeId: meta.activeScenario && scenarios.some((s) => s.id === meta.activeScenario) ? meta.activeScenario : scenarios[0]?.id ?? '' };
  }
  const meta = (await localList()).find((x) => x.id === id);
  const b = (await get(pkey(id))) as LocalBundle | undefined;
  if (!meta || !b) return null;
  const scenarios = b.scenarios.map((s) => ({ id: s.id, name: s.name, params: decodeParams(s.p), updatedAt: s.updatedAt })).filter((s): s is StoredScenario => !!s.params);
  return { meta, scenarios, activeId: b.activeId };
}

/** Save all scenarios and the project summary. Called by autosave. */
export async function saveProject(meta: ProjectMeta, scenarios: StoredScenario[], activeId: string, removed: string[] = []): Promise<void> {
  if ((await detectBackend()) === 'cloud') {
    await Promise.all(scenarios.map((s) => api('PUT', `/projects/${meta.id}/scenarios/${s.id}`, { name: s.name, params: s.params })));
    await Promise.all(removed.map((sid) => api('DELETE', `/projects/${meta.id}/scenarios/${sid}`).catch(() => undefined)));
    await api('PATCH', `/projects/${meta.id}`, { name: meta.name, details: meta.details, summary: meta.summary, activeScenario: activeId });
    return;
  }
  const m = { ...meta, activeScenario: activeId, updatedAt: new Date().toISOString() };
  await set(LIST, [m, ...(await localList()).filter((x) => x.id !== m.id)]);
  await set(pkey(meta.id), { scenarios: scenarios.map((s) => ({ id: s.id, name: s.name, p: encodeParams(s.params), updatedAt: s.updatedAt })), activeId } satisfies LocalBundle);
}

export async function deleteProject(id: string): Promise<void> {
  if ((await detectBackend()) === 'cloud') {
    await api('DELETE', `/projects/${id}`);
    return;
  }
  await set(LIST, (await localList()).filter((x) => x.id !== id));
  await del(pkey(id));
}
