-- LandPlan Studio core schema (plain Postgres; works on Neon, Vercel Postgres, Supabase, RDS).
create table if not exists schema_migrations (id text primary key, applied_at timestamptz not null default now());

create table if not exists projects (
  id text primary key,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists scenarios (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  name text not null,
  inputs jsonb not null,                       -- full Params, incl. rule-conflict choices and overrides with reasons
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists scenarios_project on scenarios(project_id);

create table if not exists runs (
  id text primary key,
  kind text not null,
  status text not null,
  progress jsonb,
  input_hash text not null default '',
  result jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists runs_hash on runs(input_hash);

create table if not exists layout_cache (
  input_hash text primary key,
  result jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists rule_sets (
  version text primary key,
  last_verified date not null,
  rules jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists benchmarks (
  id text primary key,
  source text not null,
  record jsonb not null,
  boundary jsonb,
  last_result jsonb,
  updated_at timestamptz not null default now()
);
