create table if not exists sessions (
  session_id text primary key,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  user_agent text,
  attribution jsonb
);

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

create table if not exists profiles (
  session_id text primary key references sessions(session_id) on delete cascade,
  name text not null,
  birth_date text not null,
  birth_time text,
  is_birth_time_unknown boolean not null default false,
  calendar_type text not null,
  gender text not null,
  concern_topic text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists preview_reports (
  report_id text primary key,
  session_id text not null references sessions(session_id) on delete cascade,
  summary jsonb not null,
  action_card text not null,
  blurred_detail text not null,
  price_krw integer not null,
  created_at timestamptz not null
);

create table if not exists full_reports (
  report_id text primary key,
  session_id text not null references sessions(session_id) on delete cascade,
  sections jsonb not null,
  weekly_action_card text not null,
  disclaimer text not null,
  created_at timestamptz not null
);

create table if not exists payment_orders (
  order_id text primary key,
  session_id text not null references sessions(session_id) on delete cascade,
  report_id text not null references preview_reports(report_id) on delete cascade,
  product_code text not null,
  amount_krw integer not null,
  currency text not null,
  status text not null,
  provider text not null,
  idempotency_key text not null unique,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists entitlements (
  entitlement_id text primary key,
  session_id text not null references sessions(session_id) on delete cascade,
  report_id text not null references preview_reports(report_id) on delete cascade,
  product_code text not null,
  status text not null,
  created_at timestamptz not null,
  expires_at timestamptz
);

create table if not exists share_cards (
  card_id text primary key,
  report_id text not null references preview_reports(report_id) on delete cascade,
  session_id text not null references sessions(session_id) on delete cascade,
  headline text not null,
  subline text not null,
  action_line text not null,
  image_svg_data_url text not null,
  created_at timestamptz not null
);

create table if not exists invites (
  code text primary key,
  owner_session_id text not null references sessions(session_id) on delete cascade,
  report_id text not null references preview_reports(report_id) on delete cascade,
  created_at timestamptz not null,
  redeemed_by jsonb not null default '[]'::jsonb
);

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

create table if not exists assistant_users (
  user_id bigint primary key,
  chat_id bigint not null,
  username text,
  first_name text,
  language_code text,
  timezone text not null default 'Asia/Seoul',
  reminders_paused boolean not null default false,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  last_seen_at timestamptz not null
);

create table if not exists assistant_threads (
  bot_id text not null default 'tyler_durden',
  thread_id text primary key,
  user_id bigint not null references assistant_users(user_id) on delete cascade,
  chat_id bigint not null,
  summary text,
  locale text,
  last_message_at timestamptz not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists idx_assistant_threads_user_updated
  on assistant_threads(user_id, updated_at desc);

create index if not exists idx_assistant_threads_bot_user_updated
  on assistant_threads(bot_id, user_id, updated_at desc);

create table if not exists assistant_messages (
  bot_id text not null default 'tyler_durden',
  message_id text primary key,
  thread_id text not null references assistant_threads(thread_id) on delete cascade,
  telegram_update_id bigint,
  role text not null check (role in ('system', 'user', 'assistant')),
  content text not null,
  provider text not null default 'none',
  model text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null
);

create index if not exists idx_assistant_messages_thread_created
  on assistant_messages(thread_id, created_at desc);

create index if not exists idx_assistant_messages_bot_thread_created
  on assistant_messages(bot_id, thread_id, created_at desc);

create table if not exists assistant_updates (
  bot_id text not null default 'tyler_durden',
  update_id bigint not null,
  user_id bigint,
  chat_id bigint,
  source text not null,
  status text not null,
  error text,
  created_at timestamptz not null,
  processed_at timestamptz,
  primary key (bot_id, update_id)
);

create index if not exists idx_assistant_updates_status_created
  on assistant_updates(status, created_at desc);

create index if not exists idx_assistant_updates_bot_status_created
  on assistant_updates(bot_id, status, created_at desc);

create table if not exists assistant_reminder_jobs (
  bot_id text not null default 'tyler_durden',
  job_id text primary key,
  user_id bigint not null references assistant_users(user_id) on delete cascade,
  chat_id bigint not null,
  kind text not null check (kind in ('morning_plan', 'evening_review')),
  schedule_date text not null,
  scheduled_for timestamptz not null,
  timezone text not null,
  status text not null check (status in ('pending', 'sent', 'failed', 'skipped')),
  attempt_count integer not null default 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create unique index if not exists idx_assistant_reminder_jobs_unique_slot
  on assistant_reminder_jobs(bot_id, user_id, kind, schedule_date);

create index if not exists idx_assistant_reminder_jobs_status_created
  on assistant_reminder_jobs(status, created_at desc);

create index if not exists idx_assistant_reminder_jobs_bot_status_created
  on assistant_reminder_jobs(bot_id, status, created_at desc);
