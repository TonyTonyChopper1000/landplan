// Idempotent schema applied automatically on first connection (same SQL as db/migrations 001 + 003).
export const AUTO_MIGRATIONS: { id: string; sql: string }[] = [
  {
    id: '001_init.sql',
    sql: `
create table if not exists projects (id text primary key, name text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists scenarios (id text primary key, project_id text not null references projects(id) on delete cascade, name text not null, inputs jsonb not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index if not exists scenarios_project on scenarios(project_id);
create table if not exists runs (id text primary key, kind text not null, status text not null, progress jsonb, input_hash text not null default '', result jsonb, error text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index if not exists runs_hash on runs(input_hash);
create table if not exists layout_cache (input_hash text primary key, result jsonb not null, created_at timestamptz not null default now());
create table if not exists rule_sets (version text primary key, last_verified date not null, rules jsonb not null, created_at timestamptz not null default now());
create table if not exists benchmarks (id text primary key, source text not null, record jsonb not null, boundary jsonb, last_result jsonb, updated_at timestamptz not null default now());`,
  },
  {
    id: '003_project_meta.sql',
    sql: `
alter table projects add column if not exists type text not null default 'plots';
alter table projects add column if not exists details jsonb not null default '{}'::jsonb;
alter table projects add column if not exists summary jsonb;
alter table projects add column if not exists active_scenario text;`,
  },
];
