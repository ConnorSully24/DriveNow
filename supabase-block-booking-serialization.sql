-- Serialize instructor time-off blocks with test booking requests.
-- This avoids a race where a block and booking are submitted simultaneously.
create or replace function drivenow_private.prevent_booking_block_conflict()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.instructor_id::text,221133));
  if exists(
    select 1 from public.test_lesson_bookings l
    where l.instructor_id=new.instructor_id
      and l.lesson_date=new.block_date
      and l.status in ('requested','confirmed')
      and new.start_time <
        (l.lesson_time+pg_catalog.make_interval(mins=>l.duration_minutes))::time
      and new.end_time>l.lesson_time
  ) then
    raise exception 'Cancel the pending or confirmed test lesson before blocking that time';
  end if;
  return new;
end;
$$;
revoke all on function drivenow_private.prevent_booking_block_conflict()
from public,anon,authenticated;