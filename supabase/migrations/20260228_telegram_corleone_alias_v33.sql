-- Telegram assistant v3.3:
-- Canonical bot id migration (alfred_sentry -> michael_corleone), phase-1 (backward compatible in app code)

do $$
begin
  if to_regclass('public.assistant_threads') is not null then
    insert into assistant_threads (
      thread_id,
      bot_id,
      user_id,
      chat_id,
      summary,
      locale,
      last_message_at,
      created_at,
      updated_at
    )
    select
      replace(t.thread_id, 'telegram:alfred_sentry:', 'telegram:michael_corleone:') as thread_id,
      'michael_corleone' as bot_id,
      t.user_id,
      t.chat_id,
      t.summary,
      t.locale,
      t.last_message_at,
      t.created_at,
      t.updated_at
    from assistant_threads t
    where t.thread_id like 'telegram:alfred_sentry:%'
    on conflict (thread_id) do nothing;
  end if;
end
$$;

do $$
begin
  if to_regclass('public.assistant_messages') is not null then
    update assistant_messages
    set bot_id = 'michael_corleone'
    where bot_id = 'alfred_sentry';

    update assistant_messages
    set thread_id = replace(thread_id, 'telegram:alfred_sentry:', 'telegram:michael_corleone:')
    where thread_id like 'telegram:alfred_sentry:%';
  end if;
end
$$;

do $$
begin
  if to_regclass('public.assistant_local_jobs') is not null then
    update assistant_local_jobs
    set bot_id = 'michael_corleone'
    where bot_id = 'alfred_sentry';

    update assistant_local_jobs
    set thread_id = replace(thread_id, 'telegram:alfred_sentry:', 'telegram:michael_corleone:')
    where thread_id like 'telegram:alfred_sentry:%';
  end if;
end
$$;

do $$
begin
  if to_regclass('public.assistant_updates') is not null then
    update assistant_updates u
    set bot_id = 'michael_corleone'
    where u.bot_id = 'alfred_sentry'
      and not exists (
        select 1
        from assistant_updates x
        where x.bot_id = 'michael_corleone'
          and x.update_id = u.update_id
      );

    delete from assistant_updates
    where bot_id = 'alfred_sentry';
  end if;
end
$$;

do $$
begin
  if to_regclass('public.assistant_reminder_jobs') is not null then
    update assistant_reminder_jobs r
    set bot_id = 'michael_corleone'
    where r.bot_id = 'alfred_sentry'
      and not exists (
        select 1
        from assistant_reminder_jobs x
        where x.bot_id = 'michael_corleone'
          and x.user_id = r.user_id
          and x.kind = r.kind
          and x.schedule_date = r.schedule_date
      );

    delete from assistant_reminder_jobs
    where bot_id = 'alfred_sentry';
  end if;
end
$$;

do $$
begin
  if to_regclass('public.assistant_action_approvals') is not null then
    update assistant_action_approvals
    set requested_by_bot = 'michael_corleone'
    where requested_by_bot = 'alfred_sentry';
  end if;
end
$$;

do $$
begin
  if to_regclass('public.assistant_cost_logs') is not null then
    update assistant_cost_logs
    set bot_id = 'michael_corleone'
    where bot_id = 'alfred_sentry';
  end if;
end
$$;

do $$
begin
  if to_regclass('public.assistant_threads') is not null then
    update assistant_threads
    set bot_id = 'michael_corleone'
    where bot_id = 'alfred_sentry';

    delete from assistant_threads
    where thread_id like 'telegram:alfred_sentry:%';
  end if;
end
$$;
