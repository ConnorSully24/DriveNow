-- DriveNow live availability test (no bookings, payments or verification approvals)
-- All published availability is TEST DATA and cannot be reserved.
-- "Published" means visible to signed-in test users, NOT DVSA/DVA verified.

create table public.instructor_live_listings (
  user_id uuid primary key references public.instructor_profiles(user_id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 90),
  transmission text not null check (transmission in ('Manual','Automatic','Both')),
  published boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.instructor_live_windows (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references public.instructor_profiles(user_id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time without time zone not null,
  end_time time without time zone not null,
  created_at timestamptz not null default now(),
  constraint live_window_valid check (start_time < end_time),
  constraint live_window_unique unique (instructor_id,weekday,start_time,end_time)
);

create table public.instructor_live_blocks (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references public.instructor_profiles(user_id) on delete cascade,
  block_date date not null,
  start_time time without time zone not null,
  end_time time without time zone not null,
  created_at timestamptz not null default now(),
  constraint live_block_valid check (start_time < end_time),
  constraint live_block_unique unique (instructor_id,block_date,start_time,end_time)
);

create index instructor_live_windows_instructor_day on public.instructor_live_windows(instructor_id,weekday);
create index instructor_live_blocks_instructor_date on public.instructor_live_blocks(instructor_id,block_date);

alter table public.instructor_live_listings enable row level security;
alter table public.instructor_live_windows enable row level security;
alter table public.instructor_live_blocks enable row level security;

-- Only authenticated users may read published test listings; instructors
-- may read their own unpublished rows. No personal/private profile is exposed.
revoke all on public.instructor_live_listings from public, anon, authenticated;
revoke all on public.instructor_live_windows from public, anon, authenticated;
revoke all on public.instructor_live_blocks from public, anon, authenticated;

grant select on public.instructor_live_listings to authenticated;
grant update (published) on public.instructor_live_listings to authenticated;
grant select, insert, delete on public.instructor_live_windows to authenticated;
grant select, insert, delete on public.instructor_live_blocks to authenticated;

create policy "View published live instructor test listings or own"
  on public.instructor_live_listings for select to authenticated
  using (published or (select auth.uid()) = user_id);
create policy "Instructors publish only their own test listing"
  on public.instructor_live_listings for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Each table checks ownership using auth.uid(), never mutable user_metadata.
create policy "View visible instructor live windows"
  on public.instructor_live_windows for select to authenticated
  using (
    (select auth.uid()) = instructor_id
    or exists (
      select 1 from public.instructor_live_listings listing
      where listing.user_id = instructor_id and listing.published = true
    )
  );
create policy "Instructors add own live windows"
  on public.instructor_live_windows for insert to authenticated
  with check ((select auth.uid()) = instructor_id);
create policy "Instructors remove own live windows"
  on public.instructor_live_windows for delete to authenticated
  using ((select auth.uid()) = instructor_id);

create policy "View visible instructor live blocks"
  on public.instructor_live_blocks for select to authenticated
  using (
    (select auth.uid()) = instructor_id
    or exists (
      select 1 from public.instructor_live_listings listing
      where listing.user_id = instructor_id and listing.published = true
    )
  );
create policy "Instructors add own live blocks"
  on public.instructor_live_blocks for insert to authenticated
  with check ((select auth.uid()) = instructor_id);
create policy "Instructors remove own live blocks"
  on public.instructor_live_blocks for delete to authenticated
  using ((select auth.uid()) = instructor_id);

-- Maintain a minimal opt-in public display record. Instructors cannot edit its
-- display name/transmission via Data API; they can only toggle 'published'.
create function public.seed_instructor_live_listing()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.instructor_live_listings(user_id,display_name,transmission)
  values(new.user_id,
         trim(new.first_name) || ' ' || left(trim(new.last_name),1) || '.',
         new.transmission)
  on conflict (user_id) do nothing;
  return new;
end;
$$;
revoke all on function public.seed_instructor_live_listing() from public, anon, authenticated;

create trigger seed_instructor_live_listing_after_signup
  after insert on public.instructor_profiles
  for each row execute function public.seed_instructor_live_listing();

-- Safe backfill for any previously registered instructors.
insert into public.instructor_live_listings(user_id,display_name,transmission)
select user_id, trim(first_name) || ' ' || left(trim(last_name),1) || '.', transmission
from public.instructor_profiles
on conflict(user_id) do nothing;
