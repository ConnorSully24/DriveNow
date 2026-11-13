-- DriveNow cancellation alerts MVP: opt-in, persistent IN-APP notifications only.
-- No email, APNs/Web Push, paid lessons, reservations or verification approvals.
-- All timestamps for the opening are stored as UK local calendar date/time.
-- Alerts are only generated for cancellation-type openings within the next 48h.

create table public.cancellation_alert_preferences (
  learner_id uuid primary key references public.learner_profiles(user_id) on delete cascade,
  instructor_id uuid references public.instructor_profiles(user_id) on delete set null,
  transmission text not null check (transmission in ('Manual','Automatic')),
  lesson_minutes smallint not null check (lesson_minutes in (60,90,120)),
  created_at timestamptz not null default now()
);

create table public.cancellation_alerts (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.learner_profiles(user_id) on delete cascade,
  opening_id uuid not null references public.instructor_live_openings(id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique (learner_id, opening_id)
);

create index cancellation_alerts_inbox_idx
  on public.cancellation_alerts(learner_id,created_at desc);
create index cancellation_alerts_opening_idx
  on public.cancellation_alerts(opening_id);

alter table public.cancellation_alert_preferences enable row level security;
alter table public.cancellation_alerts enable row level security;
revoke all on public.cancellation_alert_preferences from public,anon,authenticated;
revoke all on public.cancellation_alerts from public,anon,authenticated;

grant select,insert,update,delete on public.cancellation_alert_preferences to authenticated;
grant select on public.cancellation_alerts to authenticated;
grant update (read_at) on public.cancellation_alerts to authenticated;

create policy "Learner reads own cancellation preference"
  on public.cancellation_alert_preferences for select to authenticated
  using ((select auth.uid()) = learner_id);

create policy "Learner opts in to own cancellation preference"
  on public.cancellation_alert_preferences for insert to authenticated
  with check ((select auth.uid()) = learner_id);

create policy "Learner changes own cancellation preference"
  on public.cancellation_alert_preferences for update to authenticated
  using ((select auth.uid()) = learner_id)
  with check ((select auth.uid()) = learner_id);

create policy "Learner opts out of cancellation preference"
  on public.cancellation_alert_preferences for delete to authenticated
  using ((select auth.uid()) = learner_id);

create policy "Learner reads own cancellation inbox"
  on public.cancellation_alerts for select to authenticated
  using ((select auth.uid()) = learner_id);

create policy "Learner marks own cancellation alert as read"
  on public.cancellation_alerts for update to authenticated
  using ((select auth.uid()) = learner_id)
  with check ((select auth.uid()) = learner_id);

-- The trigger runs as a trusted backend function; it is not exposed to API
-- callers. No service-role key is sent to any browser.
create schema if not exists drivenow_private;
revoke all on schema drivenow_private from public,anon,authenticated;

create function drivenow_private.fan_out_cancelled_slot(p_opening public.instructor_live_openings)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if p_opening.source <> 'cancellation' then return; end if;
  if not exists (
    select 1 from public.instructor_live_listings listing
    where listing.user_id = p_opening.instructor_id and listing.published
  ) then return; end if;
  if (p_opening.opening_date + p_opening.start_time) at time zone 'Europe/London'
        < now() + interval '30 minutes' then return; end if;
  if (p_opening.opening_date + p_opening.start_time) at time zone 'Europe/London'
        > now() + interval '48 hours' then return; end if;

  insert into public.cancellation_alerts(learner_id,opening_id)
  select pref.learner_id,p_opening.id
  from public.cancellation_alert_preferences pref
  join public.instructor_live_listings listing
    on listing.user_id=p_opening.instructor_id and listing.published
  where (pref.instructor_id is null or pref.instructor_id=p_opening.instructor_id)
    and (listing.transmission='Both' or listing.transmission=pref.transmission)
    and extract(epoch from (p_opening.end_time-p_opening.start_time)) / 60 >= pref.lesson_minutes
    and not exists (
      select 1 from public.instructor_live_blocks blocked
      where blocked.instructor_id=p_opening.instructor_id
        and blocked.block_date=p_opening.opening_date
        and blocked.start_time < p_opening.end_time
        and blocked.end_time > p_opening.start_time
    )
  on conflict (learner_id,opening_id) do nothing;
end;
$$;

create function drivenow_private.alert_on_cancellation_opening()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  perform drivenow_private.fan_out_cancelled_slot(new);
  return new;
end;
$$;

create trigger drivenow_cancellation_alert_on_opening
  after insert on public.instructor_live_openings
  for each row execute function drivenow_private.alert_on_cancellation_opening();

create function drivenow_private.alert_on_listing_publish()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare opening public.instructor_live_openings;
begin
  if old.published and not new.published then
    -- A private test schedule must not leave discoverable alerts behind.
    delete from public.cancellation_alerts alert
    using public.instructor_live_openings o
    where alert.opening_id=o.id and o.instructor_id=new.user_id;
  elsif not old.published and new.published then
    -- Catch test cancellations entered before the instructor publishes.
    for opening in
      select * from public.instructor_live_openings o
      where o.instructor_id=new.user_id and o.source='cancellation'
    loop
      perform drivenow_private.fan_out_cancelled_slot(opening);
    end loop;
  end if;
  return new;
end;
$$;

create trigger drivenow_cancellation_alert_on_publish
  after update of published on public.instructor_live_listings
  for each row when (old.published is distinct from new.published)
  execute function drivenow_private.alert_on_listing_publish();

revoke all on function drivenow_private.fan_out_cancelled_slot(public.instructor_live_openings) from public,anon,authenticated;
revoke all on function drivenow_private.alert_on_cancellation_opening() from public,anon,authenticated;
revoke all on function drivenow_private.alert_on_listing_publish() from public,anon,authenticated;
