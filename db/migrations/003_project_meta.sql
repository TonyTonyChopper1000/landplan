-- Project type, wizard details and a cached result summary for the projects list.
alter table projects add column if not exists type text not null default 'plots';
alter table projects add column if not exists details jsonb not null default '{}'::jsonb;
alter table projects add column if not exists summary jsonb;
alter table projects add column if not exists active_scenario text;
