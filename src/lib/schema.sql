create table if not exists monitored_nodes (
  id bigserial primary key,
  label text not null,
  name_pattern text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

insert into settings (key, value)
values ('checkIntervalMinutes', '60')
on conflict (key) do nothing;

create table if not exists check_runs (
  id bigserial primary key,
  checked_at timestamptz not null default now(),
  status text not null check (status in ('success', 'error')),
  source_latency_ms integer,
  error_message text
);

create table if not exists node_samples (
  id bigserial primary key,
  node_id bigint not null references monitored_nodes(id) on delete cascade,
  check_run_id bigint not null references check_runs(id) on delete cascade,
  checked_at timestamptz not null,
  is_online boolean not null,
  matched_telemetry_names text[] not null default '{}',
  startup_time timestamptz,
  node_uptime_seconds integer,
  block_height bigint,
  finalized_block_height bigint,
  location text,
  version text
);

alter table node_samples
  add column if not exists finalized_block_height bigint,
  add column if not exists location text;

create index if not exists idx_node_samples_node_checked
  on node_samples (node_id, checked_at desc);

create index if not exists idx_check_runs_checked_at
  on check_runs (checked_at desc);
