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
  latitude numeric,
  longitude numeric,
  coordinate_source text,
  version text
);

alter table node_samples
  add column if not exists finalized_block_height bigint,
  add column if not exists location text,
  add column if not exists latitude numeric,
  add column if not exists longitude numeric,
  add column if not exists coordinate_source text;

create index if not exists idx_node_samples_node_checked
  on node_samples (node_id, checked_at desc);

create index if not exists idx_check_runs_checked_at
  on check_runs (checked_at desc);

create table if not exists reward_profiles (
  node_id bigint primary key references monitored_nodes(id) on delete cascade,
  discord_name text not null default '',
  region text not null default '',
  address text not null default '',
  identity_name text not null default '',
  has_identity boolean not null default false,
  eligible boolean not null default false,
  version integer not null default 1,
  updated_at timestamptz not null default now()
);

create table if not exists reward_periods (
  id bigserial primary key,
  month text not null unique check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  payment_month text not null,
  price_date date not null,
  base_usd numeric(38,18) not null default 30 check (base_usd > 0),
  price_usd numeric(38,18) check (price_usd > 0),
  price_source text,
  price_fetched_at timestamptz,
  price_reason text not null default '',
  status text not null default 'draft' check (status in ('draft', 'confirmed')),
  version integer not null default 1,
  observed_at timestamptz not null default now(),
  confirmed_at timestamptz,
  rule_version text not null,
  check_interval_minutes integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists reward_entries (
  id bigserial primary key,
  period_id bigint not null references reward_periods(id),
  original_node_id bigint not null,
  node_ref bigint references monitored_nodes(id) on delete set null,
  label text not null,
  discord_name text not null,
  region text not null,
  address text not null,
  identity_name text not null,
  has_identity boolean not null,
  availability jsonb not null,
  state text not null default 'normal' check (state in ('normal', 'recovery', 'inactive')),
  calculated_amount numeric(38,18) check (calculated_amount >= 0),
  override_amount numeric(38,18) check (override_amount >= 0),
  adjustment_reason text not null default '',
  confirmed_amount numeric(38,18) check (confirmed_amount >= 0),
  state_percent integer,
  identity_percent integer not null,
  unique (period_id, original_node_id)
);

create table if not exists reward_payments (
  id bigserial primary key,
  entry_id bigint not null references reward_entries(id),
  amount numeric(38,18) not null check (amount > 0),
  paid_on date not null,
  tx_url text not null,
  memo text not null default '',
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entry_id, tx_url)
);

create table if not exists reward_audit (
  id bigserial primary key,
  period_id bigint references reward_periods(id),
  node_id bigint,
  action text not null,
  reason text not null default '',
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_reward_entries_period on reward_entries(period_id);
create index if not exists idx_reward_audit_period on reward_audit(period_id, id desc);
