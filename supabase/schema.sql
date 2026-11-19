-- Run in a new Supabase project SQL editor. No service key belongs in the web app.
create table if not exists public.training_owners (user_id uuid primary key references auth.users(id) on delete cascade);
alter table public.training_owners enable row level security;
revoke all on public.training_owners from anon, authenticated;
create or replace function public.is_training_owner() returns boolean language sql stable security definer set search_path = '' as $$ select exists(select 1 from public.training_owners where user_id=auth.uid()); $$;
revoke all on function public.is_training_owner() from public, anon;
grant execute on function public.is_training_owner() to authenticated;
create table if not exists public.training_records (
 user_id uuid not null references auth.users(id), id text not null,
 kind text not null check(kind in ('machine','session','cardio','body','photo','archive','settings','routine')),
 payload jsonb not null check(jsonb_typeof(payload)='object'), version bigint not null default 1,
 deleted boolean not null default false, updated_at timestamptz not null default now(), primary key(user_id,id)
);
alter table public.training_records enable row level security;
revoke all on public.training_records from anon,authenticated;
grant select on public.training_records to authenticated;
drop policy if exists owner_read on public.training_records;
create policy owner_read on public.training_records for select to authenticated using (user_id=auth.uid() and public.is_training_owner());
create or replace function public.save_training_record(record_id text,record_kind text,record_payload jsonb,expected_version bigint,is_deleted boolean default false)
returns table(saved boolean,payload jsonb,version bigint,deleted boolean)
language plpgsql security definer set search_path='' as $$
declare current_row public.training_records%rowtype;
begin
 if auth.uid() is null or not public.is_training_owner() then raise exception 'Unauthorized'; end if;
 if length(record_id)>200 or octet_length(record_payload::text)>5000000 then raise exception 'Record too large'; end if;
 -- Serialize writes for the same owner/id, including a not-yet-existing record.
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||record_id,0));
 select * into current_row from public.training_records r where r.user_id=auth.uid() and r.id=record_id for update;
 if found then
  if current_row.version<>expected_version then return query select false,current_row.payload,current_row.version,current_row.deleted; return; end if;
  update public.training_records r set payload=record_payload,kind=record_kind,version=r.version+1,deleted=is_deleted,updated_at=now() where r.user_id=auth.uid() and r.id=record_id returning * into current_row;
 else
  if expected_version<>0 then raise exception 'Missing remote record'; end if;
  insert into public.training_records(user_id,id,kind,payload,deleted) values(auth.uid(),record_id,record_kind,record_payload,is_deleted) returning * into current_row;
 end if;
 return query select true,current_row.payload,current_row.version,current_row.deleted;
end; $$;
revoke all on function public.save_training_record(text,text,jsonb,bigint,boolean) from public, anon;
grant execute on function public.save_training_record(text,text,jsonb,bigint,boolean) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values ('training-photos','training-photos',false,10485760,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
drop policy if exists training_photo_read on storage.objects;
create policy training_photo_read on storage.objects for select to authenticated using(bucket_id='training-photos' and (storage.foldername(name))[1]=auth.uid()::text and public.is_training_owner());
drop policy if exists training_photo_insert on storage.objects;
create policy training_photo_insert on storage.objects for insert to authenticated with check(bucket_id='training-photos' and (storage.foldername(name))[1]=auth.uid()::text and public.is_training_owner());
drop policy if exists training_photo_update on storage.objects;
create policy training_photo_update on storage.objects for update to authenticated using(bucket_id='training-photos' and (storage.foldername(name))[1]=auth.uid()::text and public.is_training_owner()) with check(bucket_id='training-photos' and (storage.foldername(name))[1]=auth.uid()::text and public.is_training_owner());
-- Only the owner may read their own photos; nobody can delete through the API.
-- After creating the owner via Dashboard > Authentication > Users:
-- insert into public.training_owners(user_id) values ('THE-OWNER-AUTH-UUID');
