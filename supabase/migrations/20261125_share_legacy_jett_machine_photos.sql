-- Older seed photos were attached by machine references before machineId was stored.
-- Share only historical equipment photos owned and referenced by the journal owner.
with matches as (
  select distinct on (photo.user_id, photo.id)
    photo.user_id, photo.id, machine.id as machine_id
  from public.training_records photo
  join public.training_owners owner on owner.user_id = photo.user_id
  join public.training_records machine on machine.user_id = photo.user_id
    and machine.kind = 'machine' and machine.shared and not machine.deleted
    and machine.payload->>'gym' = 'Jett'
    and (machine.payload->>'photoId' = photo.id or machine.payload->>'referencePhotoId' = photo.id
      or photo.id = 'photo-' || machine.id
      or photo.id = 'photo-' || regexp_replace(machine.id, '^jett-', 'jett-ref-'))
  where photo.kind = 'photo' and not photo.deleted and not photo.shared
    and coalesce(photo.payload->>'machineId', '') = ''
    and photo.id ~ '^photo-jett-(ref-[a-z0-9-]+|extra-[0-9]+)$'
  order by photo.user_id, photo.id,
    (machine.payload->>'photoId' = photo.id) desc nulls last, machine.id
)
update public.training_records photo
set payload = photo.payload || jsonb_build_object('machineId', matches.machine_id),
    shared = true, version = photo.version + 1, updated_at = now()
from matches
where photo.user_id = matches.user_id and photo.id = matches.id
  and not exists (select 1 from public.training_records other where other.shared and other.id = photo.id);
