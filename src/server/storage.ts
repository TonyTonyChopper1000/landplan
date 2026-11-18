// Storage port: in-memory (default) or Postgres when DATABASE_URL is set (Neon / Vercel Postgres / RDS).
import type { Params } from '../engine/types';
import { AUTO_MIGRATIONS } from './schema';

export type ProjectType = 'plots' | 'villas' | 'farm';
export type Project = {
  id: string;
  name: string;
  type: ProjectType;
  details: Record<string, unknown>;
  summary: Record<string, unknown> | null;
  activeScenario: string | null;
  createdAt: string;
  updatedAt: string;
};
export type ProjectPatch = Partial<Pick<Project, 'name' | 'type' | 'details' | 'summary' | 'activeScenario'>>;
export type Scenario = { id: string; projectId: string; name: string; params: Params; createdAt: string; updatedAt: string };
export type Job = {
  id: string;
  kind: 'optimize';
  status: 'queued' | 'running' | 'done' | 'failed' | 'cancelled';
  progress: { evaluated: number; bestScore: number; etaMs: number } | null;
  inputHash: string;
  result: unknown | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

export interface Storage {
  readonly persistent: boolean;
  listProjects(): Promise<Project[]>;
  getProject(id: string): Promise<Project | null>;
  createProject(p: Project): Promise<Project>;
  updateProject(id: string, patch: ProjectPatch): Promise<Project | null>;
  deleteProject(id: string): Promise<boolean>;
  listScenarios(projectId: string): Promise<Scenario[]>;
  getScenario(id: string): Promise<Scenario | null>;
  upsertScenario(s: Scenario): Promise<Scenario>;
  deleteScenario(id: string): Promise<boolean>;
  putJob(j: Job): Promise<void>;
  getJob(id: string): Promise<Job | null>;
  cacheGet(hash: string): Promise<unknown | null>;
  cachePut(hash: string, value: unknown): Promise<void>;
}

export class MemoryStorage implements Storage {
  readonly persistent = false;
  private projects = new Map<string, Project>();
  private scenarios = new Map<string, Scenario>();
  private jobs = new Map<string, Job>();
  private cache = new Map<string, unknown>();
  async listProjects() {
    return [...this.projects.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  async getProject(id: string) {
    return this.projects.get(id) ?? null;
  }
  async createProject(p: Project) {
    this.projects.set(p.id, p);
    return p;
  }
  async updateProject(id: string, patch: ProjectPatch) {
    const p = this.projects.get(id);
    if (!p) return null;
    const n = { ...p, ...patch, updatedAt: new Date().toISOString() };
    this.projects.set(id, n);
    return n;
  }
  async deleteProject(id: string) {
    for (const s of this.scenarios.values()) if (s.projectId === id) this.scenarios.delete(s.id);
    return this.projects.delete(id);
  }
  async listScenarios(projectId: string) {
    return [...this.scenarios.values()].filter((s) => s.projectId === projectId);
  }
  async getScenario(id: string) {
    return this.scenarios.get(id) ?? null;
  }
  async upsertScenario(s: Scenario) {
    this.scenarios.set(s.id, s);
    return s;
  }
  async deleteScenario(id: string) {
    return this.scenarios.delete(id);
  }
  async putJob(j: Job) {
    this.jobs.set(j.id, j);
  }
  async getJob(id: string) {
    return this.jobs.get(id) ?? null;
  }
  async cacheGet(hash: string) {
    return this.cache.get(hash) ?? null;
  }
  async cachePut(hash: string, value: unknown) {
    if (this.cache.size > 200) this.cache.delete(this.cache.keys().next().value as string);
    this.cache.set(hash, value);
  }
}

type Sql = import('postgres').Sql;

export class PostgresStorage implements Storage {
  readonly persistent = true;
  constructor(private sql: Sql) {}
  static async connect(url: string): Promise<PostgresStorage> {
    const { default: postgres } = await import('postgres');
    const sql = postgres(url, { max: 3, idle_timeout: 20, prepare: false, onnotice: () => undefined, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : 'require' });
    const store = new PostgresStorage(sql);
    await store.migrate();
    return store;
  }

  /** Apply the idempotent schema once per cold start, so a fresh Neon database works without a manual migration. */
  async migrate(): Promise<void> {
    await this.sql`create table if not exists schema_migrations (id text primary key, applied_at timestamptz not null default now())`;
    const done = new Set((await this.sql`select id from schema_migrations`).map((r) => r.id as string));
    for (const m of AUTO_MIGRATIONS) {
      if (done.has(m.id)) continue;
      await this.sql.unsafe(m.sql);
      await this.sql`insert into schema_migrations (id) values (${m.id}) on conflict do nothing`;
    }
  }
  async listProjects() {
    return (await this.sql`select id, name, type, details, summary, active_scenario as "activeScenario", created_at as "createdAt", updated_at as "updatedAt" from projects order by updated_at desc limit 500`) as unknown as Project[];
  }
  async getProject(id: string) {
    const r = await this.sql`select id, name, type, details, summary, active_scenario as "activeScenario", created_at as "createdAt", updated_at as "updatedAt" from projects where id = ${id}`;
    return (r[0] as Project) ?? null;
  }
  async createProject(p: Project) {
    await this.sql`insert into projects (id, name, type, details, summary, active_scenario, created_at, updated_at)
      values (${p.id}, ${p.name}, ${p.type}, ${this.sql.json(p.details as never)}, ${p.summary ? this.sql.json(p.summary as never) : null}, ${p.activeScenario}, ${p.createdAt}, ${p.updatedAt})`;
    return p;
  }
  async updateProject(id: string, patch: ProjectPatch) {
    const cur = await this.getProject(id);
    if (!cur) return null;
    const n = { ...cur, ...patch };
    await this.sql`update projects set name = ${n.name}, type = ${n.type}, details = ${this.sql.json(n.details as never)},
      summary = ${n.summary ? this.sql.json(n.summary as never) : null}, active_scenario = ${n.activeScenario}, updated_at = now() where id = ${id}`;
    return this.getProject(id);
  }
  async deleteProject(id: string) {
    const r = await this.sql`delete from projects where id = ${id}`;
    return r.count > 0;
  }
  async listScenarios(projectId: string) {
    return (await this.sql`select id, project_id as "projectId", name, inputs as params, created_at as "createdAt", updated_at as "updatedAt" from scenarios where project_id = ${projectId} order by created_at`) as unknown as Scenario[];
  }
  async getScenario(id: string) {
    const r = await this.sql`select id, project_id as "projectId", name, inputs as params, created_at as "createdAt", updated_at as "updatedAt" from scenarios where id = ${id}`;
    return (r[0] as Scenario) ?? null;
  }
  async upsertScenario(s: Scenario) {
    await this.sql`insert into scenarios (id, project_id, name, inputs, created_at, updated_at)
      values (${s.id}, ${s.projectId}, ${s.name}, ${this.sql.json(s.params as never)}, ${s.createdAt}, ${s.updatedAt})
      on conflict (id) do update set name = excluded.name, inputs = excluded.inputs, updated_at = excluded.updated_at`;
    return s;
  }
  async deleteScenario(id: string) {
    const r = await this.sql`delete from scenarios where id = ${id}`;
    return r.count > 0;
  }
  async putJob(j: Job) {
    await this.sql`insert into runs (id, kind, status, progress, input_hash, result, error, created_at, updated_at)
      values (${j.id}, ${j.kind}, ${j.status}, ${this.sql.json(j.progress as never)}, ${j.inputHash}, ${this.sql.json(j.result as never)}, ${j.error}, ${j.createdAt}, ${j.updatedAt})
      on conflict (id) do update set status = excluded.status, progress = excluded.progress, result = excluded.result, error = excluded.error, updated_at = excluded.updated_at`;
  }
  async getJob(id: string) {
    const r = await this.sql`select id, kind, status, progress, input_hash as "inputHash", result, error, created_at as "createdAt", updated_at as "updatedAt" from runs where id = ${id}`;
    return (r[0] as Job) ?? null;
  }
  async cacheGet(hash: string) {
    const r = await this.sql`select result from layout_cache where input_hash = ${hash}`;
    return r[0]?.result ?? null;
  }
  async cachePut(hash: string, value: unknown) {
    await this.sql`insert into layout_cache (input_hash, result) values (${hash}, ${this.sql.json(value as never)}) on conflict (input_hash) do nothing`;
  }
}

let storage: Promise<Storage> | null = null;
export function getStorage(env: Record<string, string | undefined> = process.env): Promise<Storage> {
  if (!storage) {
    const url = env.DATABASE_URL ?? env.POSTGRES_URL;
    storage = url ? PostgresStorage.connect(url) : Promise.resolve(new MemoryStorage());
    storage.catch(() => {
      storage = null; // retry on the next request instead of caching a failed connection
    });
  }
  return storage;
}
export function setStorage(s: Storage) {
  storage = Promise.resolve(s);
}
