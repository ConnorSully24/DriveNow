-- DriveNow onboarding baseline. Run this in Supabase SQL Editor after creating a project.
-- Never expose your project secret/service-role key in frontend code.
-- A declaration of eligibility is NOT verification of driving entitlement.

create table if not exists public.learner_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null check (char_length(first_name) between 2 and 70),
  last_name text not null check (char_length(last_name) between 2 and 70),
  date_of_birth date not null,
  postcode text not null,
  licence_issuer text not null check (licence_issuer in ('GB','NI')),
  created_at timestamptz not null default now()
);

create table if not exists public.learner_verifications (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'not_submitted'
    check (status in ('not_submitted','pending','verified','rejected')),
  checked_at timestamptz,
  -- Only trusted backend personnel may update this status after genuine checks.
  updated_at timestamptz not null default now()
);

alter table public.learner_profiles enable row level security;
alter table public.learner_verifications enable row level security;

-- Profiles are created by the auth trigger; users cannot set their own verification state.
revoke all on public.learner_profiles from anon, authenticated;
revoke all on public.learner_verifications from anon, authenticated;
grant select on public.learner_profiles to authenticated;
grant select on public.learner_verifications to authenticated;

create policy "Learners may read their own profile" on public.learner_profiles
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Learners may read their own verification status" on public.learner_verifications
  for select to authenticated using ((select auth.uid()) = user_id);

create or replace function public.new_learner_profile()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  m jsonb := new.raw_user_meta_data;
  dob date;
begin
  if m->>'role' <> 'learner' then return new; end if;
  if length(coalesce(m->>'first_name','')) < 2 or length(coalesce(m->>'last_name','')) < 2 then
    raise exception 'Invalid learner name';
  end if;
  dob := (m->>'date_of_birth')::date;
  -- Age 16 mobility exceptions require a separate verified manual workflow.
  if dob > (current_date - interval '17 years')::date then
    raise exception 'DriveNow pilot requires age 17 or over';
  end if;
  if m->>'provisional_declared' <> 'true' or m->>'eyesight_declared' <> 'true' then
    raise exception 'Driving eligibility declarations required';
  end if;
  insert into public.learner_profiles(user_id,first_name,last_name,date_of_birth,postcode,licence_issuer)
  values (new.id,trim(m->>'first_name'),trim(m->>'last_name'),dob,upper(trim(m->>'postcode')),m->>'licence_issuer');
  insert into public.learner_verifications(user_id) values (new.id);
  return new;
end;
$$;

drop trigger if exists on_new_learner on auth.users;
create trigger on_new_learner after insert on auth.users
  for each row execute function public.new_learner_profile();

-- Production TODO: build a server-only review endpoint using a vetted identity/licence
-- verification provider and/or appropriately authorised DVLA checking workflow.
-- A trusted backend with service-role privileges updates learner_verifications.
-- Enforce status = 'verified' in server-side paid-booking creation; NEVER trust
-- the UI or user_metadata for the entitlement decision.
-- Implement retention, subject rights, deletion, fraud controls and audit logs.
