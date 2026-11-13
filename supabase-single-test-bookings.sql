-- DriveNow single-lesson TEST booking engine. No money, verification approvals, or real lessons.
-- All booking writes are through restricted RPCs, never directly by browsers.
create extension if not exists btree_gist with schema extensions;

create table public.test_lesson_bookings (
 id uuid primary key default gen_random_uuid(),
 learner_id uuid not null references public.learner_profiles(user_id) on delete cascade,
 instructor_id uuid not null references public.instructor_profiles(user_id) on delete cascade,
 lesson_date date not null,
 lesson_time time without time zone not null,
 duration_minutes smallint not null check(duration_minutes in (60,90,120)),
 transmission text not null check(transmission in ('Manual','Automatic')),
 start_at timestamptz not null,
 end_at timestamptz not null,
 -- Stored here because timestamptz +/- interval isn't IMMUTABLE for GiST expressions.
 busy_range tstzrange not null,
 status text not null default 'requested'
   check(status in ('requested','confirmed','declined','cancelled')),
 learner_display_name text not null,
 instructor_display_name text not null,
 client_request_id uuid not null,
 requested_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 decided_at timestamptz,
 constraint test_lesson_idempotency unique(learner_id,client_request_id),
 constraint test_lesson_time_consistency check(
   end_at = start_at + make_interval(mins=>duration_minutes)
   and end_at > start_at
   and lesson_date=(start_at at time zone 'Europe/London')::date
   and lesson_time=(start_at at time zone 'Europe/London')::time
   and busy_range = tstzrange(start_at-interval '15 minutes',end_at+interval '15 minutes','[)')
 ),
 constraint test_lesson_no_overlap exclude using gist (
   instructor_id with =,busy_range with &&
 ) where (status in ('requested','confirmed'))
);
create index test_lesson_learner_calendar on public.test_lesson_bookings(learner_id,start_at);
create index test_lesson_instructor_calendar on public.test_lesson_bookings(instructor_id,start_at);

alter table public.test_lesson_bookings enable row level security;
revoke all on public.test_lesson_bookings from public,anon,authenticated;
grant select on public.test_lesson_bookings to authenticated;
create policy "Only participants see test bookings" on public.test_lesson_bookings
 for select to authenticated using ((select auth.uid())=learner_id or (select auth.uid())=instructor_id);

create function public.request_single_test_lesson(
 p_instructor_id uuid,p_lesson_date date,p_lesson_time time without time zone,
 p_duration_minutes integer,p_transmission text,p_request_id uuid
) returns uuid language plpgsql security definer set search_path=''
as $$
declare
 v_actor uuid := auth.uid();
 v_listing public.instructor_live_listings%rowtype;
 v_learner public.learner_profiles%rowtype;
 v_local timestamp without time zone;
 v_end_local timestamp without time zone;
 v_start timestamptz;
 v_id uuid;
 v_windows tsmultirange;
begin
 if v_actor is null or p_request_id is null then
   raise exception 'Sign in as a learner to request a test lesson'; end if;
 select * into v_learner from public.learner_profiles where user_id=v_actor;
 if not found then raise exception 'Only learner accounts can request lessons'; end if;
 if p_instructor_id is null or p_lesson_date is null or p_lesson_time is null
    or p_duration_minutes is null or p_duration_minutes not in (60,90,120)
    or p_transmission is null or p_transmission not in ('Manual','Automatic')
 then raise exception 'Choose a valid instructor, time, transmission and lesson length'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_instructor_id::text,221133));
 select id into v_id from public.test_lesson_bookings
   where learner_id=v_actor and client_request_id=p_request_id;
 if found then return v_id; end if;
 select * into v_listing from public.instructor_live_listings
   where user_id=p_instructor_id and published;
 if not found or (v_listing.transmission<>'Both' and v_listing.transmission<>p_transmission)
 then raise exception 'This instructor is not offering that published test transmission'; end if;
 if p_lesson_date < (now() at time zone 'Europe/London')::date
    or p_lesson_date > (now() at time zone 'Europe/London')::date+90
 then raise exception 'Choose a date in the next 90 days'; end if;
 if extract(minute from p_lesson_time)::integer % 30<>0
    or extract(second from p_lesson_time)<>0
 then raise exception 'Choose a start on a half-hour boundary'; end if;
 v_local:=p_lesson_date+p_lesson_time;
 v_end_local:=v_local+make_interval(mins=>p_duration_minutes);
 if v_end_local::date<>p_lesson_date then
   raise exception 'Test lessons must end the same day'; end if;
 v_start:=v_local at time zone 'Europe/London';
 if (v_start at time zone 'Europe/London')<>v_local then
   raise exception 'This UK local time does not exist during the clock change'; end if;
 if v_start < now()+interval '30 minutes' then
   raise exception 'Please allow at least 30 minutes before a lesson starts'; end if;

 select range_agg(tsrange(p_lesson_date+w.start_time,p_lesson_date+w.end_time,'[)'))
 into v_windows
 from (
   select start_time,end_time from public.instructor_live_windows
    where instructor_id=p_instructor_id and weekday=extract(dow from p_lesson_date)::smallint
   union all
   select start_time,end_time from public.instructor_live_openings
    where instructor_id=p_instructor_id and opening_date=p_lesson_date
 ) w;
 if v_windows is null or not (v_windows @> tsrange(v_local,v_end_local,'[)')) then
   raise exception 'That slot is not in this instructor published hours'; end if;
 if exists(
   select 1 from public.instructor_live_blocks b
   where b.instructor_id=p_instructor_id and b.block_date=p_lesson_date
     and b.start_time<v_end_local::time and b.end_time>p_lesson_time
 ) then raise exception 'This slot is blocked in the instructor diary'; end if;
 begin
  insert into public.test_lesson_bookings(
   learner_id,instructor_id,lesson_date,lesson_time,duration_minutes,
   transmission,start_at,end_at,busy_range,status,
   learner_display_name,instructor_display_name,client_request_id
  ) values(
   v_actor,p_instructor_id,p_lesson_date,p_lesson_time,p_duration_minutes,
   p_transmission,v_start,v_start+make_interval(mins=>p_duration_minutes),
   tstzrange(v_start-interval '15 minutes',v_start+make_interval(mins=>p_duration_minutes)+interval '15 minutes','[)'),
   'requested',v_learner.first_name||' '||left(v_learner.last_name,1)||'.',
   v_listing.display_name,p_request_id
  ) returning id into v_id;
 exception when exclusion_violation then
   raise exception 'This slot has already been requested, including the 15-minute buffer. Choose another time.';
 end;
 return v_id;
end;
$$;

create function public.respond_single_test_lesson(p_booking_id uuid,p_action text)
returns text language plpgsql security definer set search_path=''
as $$
declare
 v_actor uuid := auth.uid();
 v_row public.test_lesson_bookings%rowtype;
 v_status text;
begin
 if v_actor is null or p_action is null or p_action not in ('accept','decline')
    or p_booking_id is null then raise exception 'Sign in and choose Accept or Decline'; end if;
 select * into v_row from public.test_lesson_bookings where id=p_booking_id for update;
 if not found or v_row.instructor_id<>v_actor then
   raise exception 'Only the assigned instructor can respond'; end if;
 if v_row.status<>'requested' then raise exception 'Request is no longer pending'; end if;
 if p_action='accept' and v_row.start_at<=now() then
   raise exception 'A past lesson cannot be accepted'; end if;
 v_status:=case when p_action='accept' then 'confirmed' else 'declined' end;
 update public.test_lesson_bookings
   set status=v_status,updated_at=now(),decided_at=now() where id=p_booking_id;
 return v_status;
end;
$$;

create function public.cancel_single_test_lesson(p_booking_id uuid)
returns text language plpgsql security definer set search_path=''
as $$
declare
 v_actor uuid:=auth.uid();
 v_row public.test_lesson_bookings%rowtype;
begin
 if v_actor is null or p_booking_id is null then raise exception 'Sign in to cancel'; end if;
 select * into v_row from public.test_lesson_bookings where id=p_booking_id for update;
 if not found or v_actor not in (v_row.learner_id,v_row.instructor_id) then
   raise exception 'Only a booking participant can cancel'; end if;
 if v_row.status not in ('requested','confirmed') then
   raise exception 'This test lesson is no longer active'; end if;
 update public.test_lesson_bookings
   set status='cancelled',updated_at=now(),decided_at=now()
   where id=p_booking_id;
 return 'cancelled';
end;
$$;

-- Do not allow a new time-off block to overlap an existing live test request.
create function drivenow_private.prevent_booking_block_conflict()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if exists(
   select 1 from public.test_lesson_bookings l
   where l.instructor_id=new.instructor_id and l.lesson_date=new.block_date
     and l.status in ('requested','confirmed')
     and new.start_time<(l.lesson_time+make_interval(mins=>l.duration_minutes))::time
     and new.end_time>l.lesson_time
 ) then
   raise exception 'Cancel the pending or confirmed test lesson before blocking that time';
 end if;
 return new;
end;
$$;
create trigger prevent_live_block_over_test_booking
 before insert on public.instructor_live_blocks for each row
 execute function drivenow_private.prevent_booking_block_conflict();

revoke all on function drivenow_private.prevent_booking_block_conflict() from public,anon,authenticated;
revoke all on function public.request_single_test_lesson(uuid,date,time without time zone,integer,text,uuid) from public,anon,authenticated;
revoke all on function public.respond_single_test_lesson(uuid,text) from public,anon,authenticated;
revoke all on function public.cancel_single_test_lesson(uuid) from public,anon,authenticated;
grant execute on function public.request_single_test_lesson(uuid,date,time without time zone,integer,text,uuid) to authenticated;
grant execute on function public.respond_single_test_lesson(uuid,text) to authenticated;
grant execute on function public.cancel_single_test_lesson(uuid) to authenticated;
