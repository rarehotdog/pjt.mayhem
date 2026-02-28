-- Telegram Assistant tables

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

create table if not exists assistant_messages (
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

create table if not exists assistant_updates (
  update_id bigint primary key,
  user_id bigint,
  chat_id bigint,
  source text not null,
  status text not null,
  error text,
  created_at timestamptz not null,
  processed_at timestamptz
);

create index if not exists idx_assistant_updates_status_created
  on assistant_updates(status, created_at desc);

create table if not exists assistant_reminder_jobs (
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
  on assistant_reminder_jobs(user_id, kind, schedule_date);

create index if not exists idx_assistant_reminder_jobs_status_created
  on assistant_reminder_jobs(status, created_at desc);
