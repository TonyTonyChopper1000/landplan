-- Optional: PostGIS geometry columns for layouts (run only where the extension is available).
create extension if not exists postgis;
create table if not exists layouts (
  id text primary key,
  scenario_id text references scenarios(id) on delete cascade,
  input_hash text not null,
  result jsonb not null,
  plots geometry(MultiPolygon, 32644),
  roads geometry(MultiLineString, 32644),
  open_space geometry(MultiPolygon, 32644),
  created_at timestamptz not null default now()
);
create index if not exists layouts_plots_gix on layouts using gist (plots);
