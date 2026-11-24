-- Run in the Supabase SQL editor. Safe to re-run. No service key belongs in the web app.
-- Roles: the journal owner (listed in training_owners) and trainers (profiles.role = 'trainer').
-- Private records (workouts, cardio, body, stretch sessions, settings) belong to one user;
-- a trainer may read the private records of a client linked in coach_links, never write them.
-- Shared records (machines, machine photos, programs, gym list) are visible to and editable by all members.

create table if not exists public.training_owners (user_id uuid primary key references auth.users(id) on delete cascade);
alter table public.training_owners enable row level security;
revoke all on public.training_owners from anon, authenticated;

create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 username text unique check (username ~ '^[a-z0-9._-]{3,32}$'),
 display_name text not null default '' check (length(display_name) <= 80),
 role text not null check (role in ('owner','trainer')),
 disabled boolean not null default false,
 created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;

create table if not exists public.coach_links (
 trainer_id uuid not null references auth.users(id) on delete cascade,
 client_id uuid not null references auth.users(id) on delete cascade,
 status text not null default 'active' check (status in ('active','revoked')),
 can_view boolean not null default true,
 created_at timestamptz not null default now(),
 primary key (trainer_id, client_id)
);
alter table public.coach_links enable row level security;
revoke all on public.coach_links from anon, authenticated;

-- 'owner' | 'trainer' | null for the signed-in user.
create or replace function public.journal_role() returns text language sql stable security definer set search_path = '' as $$
 select case
  when exists(select 1 from public.training_owners where user_id = auth.uid()) then 'owner'
  when exists(select 1 from public.profiles p where p.id = auth.uid() and p.role = 'trainer' and not p.disabled) then 'trainer'
 end; $$;
revoke all on function public.journal_role() from public, anon;
grant execute on function public.journal_role() to authenticated;

-- Kept under its original name for older app builds: true for any active member (owner or trainer).
create or replace function public.is_training_owner() returns boolean language sql stable security definer set search_path = '' as $$
 select public.journal_role() is not null; $$;
revoke all on function public.is_training_owner() from public, anon;
grant execute on function public.is_training_owner() to authenticated;

create or replace function public.can_view_user(target uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select target = auth.uid() or exists(
  select 1 from public.coach_links l join public.profiles p on p.id = l.trainer_id
  where l.trainer_id = auth.uid() and l.client_id = target and l.status = 'active' and l.can_view and not p.disabled); $$;
revoke all on function public.can_view_user(uuid) from public, anon;
grant execute on function public.can_view_user(uuid) to authenticated;

grant select on public.profiles to authenticated;
drop policy if exists members_read_profiles on public.profiles;
create policy members_read_profiles on public.profiles for select to authenticated using (public.is_training_owner());
grant select on public.coach_links to authenticated;
drop policy if exists own_links on public.coach_links;
create policy own_links on public.coach_links for select to authenticated using (trainer_id = auth.uid() or client_id = auth.uid());

create table if not exists public.training_records (
 user_id uuid not null references auth.users(id), id text not null,
 kind text not null check(kind in ('machine','session','cardio','body','photo','archive','settings','routine')),
 payload jsonb not null check(jsonb_typeof(payload)='object'), version bigint not null default 1,
 deleted boolean not null default false, updated_at timestamptz not null default now(), primary key(user_id,id)
);
alter table public.training_records add column if not exists shared boolean not null default false;
alter table public.training_records add column if not exists updated_by uuid references auth.users(id);
alter table public.training_records enable row level security;
revoke all on public.training_records from anon,authenticated;
grant select on public.training_records to authenticated;

-- Which records are common to everyone: equipment, equipment photos, programs and the gym list.
create or replace function public.is_shared_record(record_id text, record_kind text, record_payload jsonb) returns boolean language sql immutable set search_path = '' as $$
 select record_kind in ('machine','routine')
  or (record_kind = 'settings' and record_id = 'settings-gym-catalog')
  or (record_kind = 'photo' and coalesce(record_payload->>'machineId','') <> ''); $$;

update public.training_records r set shared = true
 where not r.shared and public.is_shared_record(r.id, r.kind, r.payload)
   and not exists (select 1 from public.training_records s where s.shared and s.id = r.id);
create unique index if not exists training_records_shared_id on public.training_records(id) where shared;

drop policy if exists owner_read on public.training_records;
drop policy if exists member_read on public.training_records;
create policy member_read on public.training_records for select to authenticated
 using (public.is_training_owner() and (shared or public.can_view_user(user_id)));

create or replace function public.save_training_record(record_id text,record_kind text,record_payload jsonb,expected_version bigint,is_deleted boolean default false)
returns table(saved boolean,payload jsonb,version bigint,deleted boolean)
language plpgsql security definer set search_path='' as $$
declare current_row public.training_records%rowtype; want_shared boolean;
begin
 if auth.uid() is null or not public.is_training_owner() then raise exception 'Unauthorized'; end if;
 if length(record_id)>200 or octet_length(record_payload::text)>5000000 then raise exception 'Record too large'; end if;
 want_shared := public.is_shared_record(record_id, record_kind, record_payload);
 -- Serialize writes for the same id, including a not-yet-existing record.
 perform pg_advisory_xact_lock(hashtextextended('record:'||record_id,0));
 -- A shared record is edited in place by any member; otherwise only the caller's own row is touched.
 select * into current_row from public.training_records r where r.id=record_id and r.shared for update;
 if not found then
  select * into current_row from public.training_records r where r.user_id=auth.uid() and r.id=record_id for update;
 end if;
 if found then
  if current_row.version<>expected_version then return query select false,current_row.payload,current_row.version,current_row.deleted; return; end if;
  update public.training_records r set payload=record_payload,kind=record_kind,version=r.version+1,deleted=is_deleted,
    shared = r.shared or want_shared, updated_by=auth.uid(), updated_at=now()
   where r.user_id=current_row.user_id and r.id=record_id returning * into current_row;
 else
  if expected_version<>0 then raise exception 'Missing remote record'; end if;
  insert into public.training_records(user_id,id,kind,payload,deleted,shared,updated_by)
   values(auth.uid(),record_id,record_kind,record_payload,is_deleted,want_shared,auth.uid()) returning * into current_row;
 end if;
 return query select true,current_row.payload,current_row.version,current_row.deleted;
end; $$;
revoke all on function public.save_training_record(text,text,jsonb,bigint,boolean) from public, anon;
grant execute on function public.save_training_record(text,text,jsonb,bigint,boolean) to authenticated;

-- Photos: every member can read (machine photos are shared; trainers may see their client's evidence).
-- Uploads go only into the uploader's own folder. Nobody can delete through the API.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values ('training-photos','training-photos',false,10485760,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
drop policy if exists training_photo_read on storage.objects;
create policy training_photo_read on storage.objects for select to authenticated using(bucket_id='training-photos' and public.is_training_owner());
drop policy if exists training_photo_insert on storage.objects;
create policy training_photo_insert on storage.objects for insert to authenticated with check(bucket_id='training-photos' and (storage.foldername(name))[1]=auth.uid()::text and public.is_training_owner());
drop policy if exists training_photo_update on storage.objects;
create policy training_photo_update on storage.objects for update to authenticated using(bucket_id='training-photos' and (storage.foldername(name))[1]=auth.uid()::text and public.is_training_owner()) with check(bucket_id='training-photos' and (storage.foldername(name))[1]=auth.uid()::text and public.is_training_owner());

-- Give the existing owner a profile so trainers see a display name.
insert into public.profiles(id, role, display_name)
 select user_id, 'owner', '' from public.training_owners on conflict (id) do nothing;

-- First setup only, after creating the owner via Dashboard > Authentication > Users:
-- insert into public.training_owners(user_id) values ('THE-OWNER-AUTH-UUID');
-- Trainer accounts are created from the app (Settings > บัญชีเทรนเนอร์) through the trainer-admin Edge Function.
