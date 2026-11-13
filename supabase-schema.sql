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

-- Existing learners may be null; new signup trigger requires an initial skill rating.
alter table public.learner_profiles
  add column if not exists self_assessed_skill smallint check (self_assessed_skill between 1 and 10);

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

drop policy if exists "Learners may read their own profile" on public.learner_profiles;
create policy "Learners may read their own profile" on public.learner_profiles
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Learners may read their own verification status" on public.learner_verifications;
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
  if coalesce(m->>'self_assessed_skill','') !~ '^(10|[1-9])$' then
    raise exception 'Initial learner skill from 1 to 10 required at signup';
  end if;
  insert into public.learner_profiles
    (user_id,first_name,last_name,date_of_birth,postcode,licence_issuer,self_assessed_skill)
  values
    (new.id,trim(m->>'first_name'),trim(m->>'last_name'),dob,
     upper(trim(m->>'postcode')),m->>'licence_issuer',
     (m->>'self_assessed_skill')::smallint);
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

-- Instructor accounts. Registration is not instructor approval.
-- These rows are written by a security-definer signup trigger, not editable by users.
create table if not exists public.instructor_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null check (char_length(first_name) between 2 and 70),
  last_name text not null check (char_length(last_name) between 2 and 70),
  date_of_birth date not null,
  postcode text not null,
  licence_issuer text not null check (licence_issuer in ('GB', 'NI')),
  registration_type text not null check (registration_type in ('adi', 'trainee', 'ni')),
  transmission text not null check (transmission in ('Manual', 'Automatic', 'Both')),
  created_at timestamptz not null default now(),
  constraint instructor_issuer_registration_match check (
    (licence_issuer = 'NI' and registration_type = 'ni')
    or (licence_issuer = 'GB' and registration_type in ('adi', 'trainee'))
  )
);

create table if not exists public.instructor_verifications (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'not_submitted'
    check (status in ('not_submitted', 'pending', 'verified', 'rejected')),
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.instructor_profiles enable row level security;
alter table public.instructor_verifications enable row level security;
revoke all on public.instructor_profiles from anon, authenticated;
revoke all on public.instructor_verifications from anon, authenticated;
grant select on public.instructor_profiles to authenticated;
grant select on public.instructor_verifications to authenticated;

drop policy if exists "Instructors may read their own profile" on public.instructor_profiles;
create policy "Instructors may read their own profile" on public.instructor_profiles
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Instructors may read their own verification status" on public.instructor_verifications;
create policy "Instructors may read their own verification status" on public.instructor_verifications
  for select to authenticated using ((select auth.uid()) = user_id);

create or replace function public.new_instructor_profile()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  m jsonb := new.raw_user_meta_data;
  dob date;
begin
  if m->>'role' <> 'instructor' then return new; end if;
  if char_length(coalesce(m->>'first_name','')) < 2
      or char_length(coalesce(m->>'last_name','')) < 2 then
    raise exception 'Invalid instructor name';
  end if;
  dob := (m->>'date_of_birth')::date;
  if dob > (current_date - interval '21 years')::date then
    raise exception 'Instructors must be 21 or over';
  end if;
  if m->>'full_licence_three_years_declared' <> 'true'
      or m->>'insured_teaching_vehicle_declared' <> 'true' then
    raise exception 'Instructor eligibility declarations are required';
  end if;
  if coalesce(m->>'licence_issuer','') not in ('GB', 'NI')
      or coalesce(m->>'registration_type','') not in ('adi', 'trainee', 'ni')
      or coalesce(m->>'transmission','') not in ('Manual', 'Automatic', 'Both') then
    raise exception 'Invalid instructor registration details';
  end if;
  insert into public.instructor_profiles
    (user_id,first_name,last_name,date_of_birth,postcode,licence_issuer,registration_type,transmission)
  values
    (new.id,trim(m->>'first_name'),trim(m->>'last_name'),dob,upper(trim(m->>'postcode')),
     m->>'licence_issuer',m->>'registration_type',m->>'transmission');
  insert into public.instructor_verifications (user_id) values (new.id);
  return new;
end;
$$;

drop trigger if exists on_new_instructor on auth.users;
create trigger on_new_instructor after insert on auth.users
  for each row execute function public.new_instructor_profile();

-- SECURITY: Only trusted server-side administrative verification may set 'verified'.
-- Never grant insert/update/delete on the verification tables to authenticated users.
-- Live lesson APIs must check verified learner AND verified instructor status server-side.
-- Demo mode may never create real bookings or set a verification status.

-- Production post-lesson feedback: attach one instructor score (1–10) and one
-- learner instructor-review (1–5) to each real completed lesson, authenticated
-- by verified participant IDs and enforced server-side uniqueness/RLS.
-- An instructor assessment average, excluding the original self-rating,
-- replaces the one-time signup rating as soon as the first score is recorded.
-- Not live until server-side lesson and review APIs exist.

-- Keep auth trigger functions internal; they run through triggers, not client API calls.
revoke all on function public.new_learner_profile() from public, anon, authenticated;
revoke all on function public.new_instructor_profile() from public, anon, authenticated;
