-- Read-only sanitised busy slot feed for live test discovery.
-- No learner IDs, names, email addresses, prices or verification records are returned.
-- Requires a signed-in account and published instructor (or instructor self).
create function public.get_test_busy_slots(p_instructor_ids uuid[])
returns table(instructor_id uuid,lesson_date date,lesson_time time without time zone,duration_minutes smallint)
language plpgsql security definer set search_path=''
as $$
begin
  if auth.uid() is null then raise exception 'Sign in to view test availability'; end if;
  if p_instructor_ids is null or pg_catalog.cardinality(p_instructor_ids)>25 then
    raise exception 'Choose at most 25 test instructors'; end if;
  return query
  select b.instructor_id,b.lesson_date,b.lesson_time,b.duration_minutes
  from public.test_lesson_bookings b
  join public.instructor_live_listings l on l.user_id=b.instructor_id
  where b.instructor_id=any(p_instructor_ids)
    and (l.published or l.user_id=auth.uid())
    and b.status in ('requested','confirmed')
    and b.start_at>=now()-interval '2 hours'
    and b.start_at<now()+interval '91 days';
end;
$$;
revoke all on function public.get_test_busy_slots(uuid[]) from public,anon,authenticated;
grant execute on function public.get_test_busy_slots(uuid[]) to authenticated;
