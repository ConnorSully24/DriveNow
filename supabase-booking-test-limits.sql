-- Additional TEST booking integrity:
-- one learner cannot simultaneously hold conflicting test lessons with
-- different instructors; each learner may have at most eight pending future requests.
alter table public.test_lesson_bookings
  add constraint test_learner_no_overlap exclude using gist (
    learner_id with =,busy_range with &&
  ) where(status in ('requested','confirmed'));

create function drivenow_private.limit_pending_test_requests()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_count integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.learner_id::text,83231));
  select count(*) into v_count
  from public.test_lesson_bookings
  where learner_id=new.learner_id
    and status='requested'
    and start_at>now();
  if v_count>=8 then
    raise exception 'You already have eight pending test lesson requests. Wait for an instructor response or cancel one first.';
  end if;
  return new;
end;
$$;
create trigger limit_pending_test_lesson_requests
 before insert on public.test_lesson_bookings for each row
 execute function drivenow_private.limit_pending_test_requests();
revoke all on function drivenow_private.limit_pending_test_requests()
 from public,anon,authenticated;