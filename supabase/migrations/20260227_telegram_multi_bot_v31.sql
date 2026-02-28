-- Telegram assistant multi-bot v3.1 upgrade

alter table if exists assistant_threads
  add column if not exists bot_id text not null default 'tyler_durden';

alter table if exists assistant_messages
  add column if not exists bot_id text not null default 'tyler_durden';

alter table if exists assistant_updates
  add column if not exists bot_id text not null default 'tyler_durden';

alter table if exists assistant_reminder_jobs
  add column if not exists bot_id text not null default 'tyler_durden';

do $$
declare
  has_bot_key boolean;
begin
  if to_regclass('public.assistant_updates') is null then
    return;
  end if;

  select exists (
    select 1
    from pg_constraint c
    join pg_attribute a
      on a.attrelid = c.conrelid
     and a.attnum = any(c.conkey)
    where c.conrelid = 'public.assistant_updates'::regclass
      and c.conname = 'assistant_updates_pkey'
      and a.attname = 'bot_id'
  ) into has_bot_key;

  if not has_bot_key then
    alter table assistant_updates drop constraint if exists assistant_updates_pkey;
    alter table assistant_updates add constraint assistant_updates_pkey primary key (bot_id, update_id);
  end if;
end
$$;

drop index if exists idx_assistant_reminder_jobs_unique_slot;
create unique index if not exists idx_assistant_reminder_jobs_unique_slot
  on assistant_reminder_jobs(bot_id, user_id, kind, schedule_date);

create index if not exists idx_assistant_threads_bot_user_updated
  on assistant_threads(bot_id, user_id, updated_at desc);

create index if not exists idx_assistant_messages_bot_thread_created
  on assistant_messages(bot_id, thread_id, created_at desc);

create index if not exists idx_assistant_updates_bot_status_created
  on assistant_updates(bot_id, status, created_at desc);

create index if not exists idx_assistant_reminder_jobs_bot_status_created
  on assistant_reminder_jobs(bot_id, status, created_at desc);
