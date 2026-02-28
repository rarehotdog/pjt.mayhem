-- Growth Analytics + Consent + Delivery logs

create table if not exists user_consents (
  session_id text primary key references sessions(session_id) on delete cascade,
  essential_analytics boolean not null default true,
  marketing_tracking boolean not null default false,
  updated_at timestamptz not null
);

create table if not exists attribution_snapshots (
  snapshot_id bigserial primary key,
  session_id text not null references sessions(session_id) on delete cascade,
  campaign_id text,
  click_source text,
  partition text,
  ua_creative_topic text,
  utm_source text,
  source text,
  mode text,
  created_at timestamptz not null
);

create index if not exists idx_attribution_snapshots_session_created
  on attribution_snapshots(session_id, created_at desc);

create table if not exists telemetry_events (
  event_id text primary key,
  event_name text not null,
  event_type text not null,
  event_time timestamptz not null,
  session_id text references sessions(session_id) on delete set null,
  page_path text not null,
  source_channel text not null,
  consent_marketing boolean not null,
  payload jsonb not null default '{}'::jsonb,
  campaign_id text,
  click_source text,
  partition text,
  ua_creative_topic text,
  utm_source text,
  source text,
  mode text,
  delivery_amplitude text not null,
  delivery_meta text not null,
  retry_count integer not null default 0,
  created_at timestamptz not null
);

create table if not exists event_delivery_logs (
  delivery_log_id bigserial primary key,
  event_id text not null references telemetry_events(event_id) on delete cascade,
  destination text not null,
  status text not null,
  attempt integer not null,
  error text,
  created_at timestamptz not null
);

create index if not exists idx_telemetry_events_session_time
  on telemetry_events(session_id, event_time desc);

create index if not exists idx_telemetry_events_name_time
  on telemetry_events(event_name, event_time desc);

create index if not exists idx_telemetry_events_campaign_partition_time
  on telemetry_events(campaign_id, partition, event_time desc);

create index if not exists idx_event_delivery_logs_event_destination
  on event_delivery_logs(event_id, destination);
