-- DriveNow: ad-hoc one-off openings for cancellation gaps and extra lesson time.
-- TEST AVAILABILITY ONLY. These are never bookings, approvals or paid services.
-- Local calendar dates/times are Europe/London; no learner details are stored.

create table public.instructor_live_openings (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references public.instructor_profiles(user_id) on delete cascade,
  opening_date date not null,
  start_time time without time zone not null,
  end_time time without time zone not null,
  source text not null default 'extra' check (source in ('extra','cancellation')),
  created_at timestamptz not null default now(),
  constraint instructor_opening_valid_times check (start_time < end_time),
  constraint instructor_opening_distinct unique (instructor_id, opening_date, start_time, end_time)
);

create index instructor_live_openings_instructor_date
  on public.instructor_live_openings (instructor_id, opening_date);

alter table public.instructor_live_openings enable row level security;

revoke all on public.instructor_live_openings from public, anon, authenticated;
grant select, insert, delete on public.instructor_live_openings to authenticated;

-- A schedule is visible only to its owner or to signed-in test learners
-- when the owning instructor deliberately opted into publication.
create policy "Read owned or published one-off openings"
  on public.instructor_live_openings
  for select to authenticated
  using (
    (select auth.uid()) = instructor_id
    or exists (
      select 1
      from public.instructor_live_listings listing
      where listing.user_id = instructor_id and listing.published = true
    )
  );

-- Users may post only their own new openings, not those of another account.
-- Limit dates to 90 days. For today's last-minute slots, require at least
-- 30 minutes notice, consistent with the existing slot-search engine.
create policy "Instructors insert own future one-off openings"
  on public.instructor_live_openings
  for insert to authenticated
  with check (
    (select auth.uid()) = instructor_id
    and opening_date between (now() at time zone 'Europe/London')::date
                         and ((now() at time zone 'Europe/London')::date + 90)
    and (
      opening_date > (now() at time zone 'Europe/London')::date
      or start_time >= ((now() at time zone 'Europe/London')::time + interval '30 minutes')::time
    )
  );

create policy "Instructors delete own one-off openings"
  on public.instructor_live_openings
  for delete to authenticated
  using ((select auth.uid()) = instructor_id);

-- No client-side UPDATE grant: to change one opening, remove it then add a new one.
-- A blocked date/time still takes priority when calculating actual open slots.
