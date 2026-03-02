-- Time Capsule: scope by room + prevent immediate unlock
-- Run in Supabase SQL Editor after lingo_schema.sql

create extension if not exists pgcrypto;

create table if not exists public.time_capsules (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.lingo_rooms(id) on delete cascade,
  title text not null,
  message text not null,
  image_url text,
  unlock_at timestamptz not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete cascade
);

alter table public.time_capsules
  add column if not exists room_id uuid,
  add column if not exists created_by uuid,
  add column if not exists created_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'time_capsules_room_id_fkey'
  ) then
    alter table public.time_capsules
      add constraint time_capsules_room_id_fkey
      foreign key (room_id) references public.lingo_rooms(id) on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'time_capsules_created_by_fkey'
  ) then
    alter table public.time_capsules
      add constraint time_capsules_created_by_fkey
      foreign key (created_by) references auth.users(id) on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'time_capsules_unlock_future_chk'
  ) then
    alter table public.time_capsules
      add constraint time_capsules_unlock_future_chk
      check (unlock_at > created_at + interval '1 second')
      not valid;
  end if;
end $$;

-- Best-effort backfill room_id for old rows by member relation.
with candidate as (
  select
    t.id as capsule_id,
    (
      select r.id
      from public.lingo_rooms r
      where r.owner_user_id = t.created_by or r.partner_user_id = t.created_by
      order by r.updated_at desc, r.created_at desc
      limit 1
    ) as room_uuid
  from public.time_capsules t
  where t.room_id is null
)
update public.time_capsules t
set room_id = c.room_uuid
from candidate c
where t.id = c.capsule_id
  and c.room_uuid is not null;

-- Tighten nullability only when legacy rows are clean.
do $$
begin
  if not exists (select 1 from public.time_capsules where room_id is null) then
    alter table public.time_capsules
      alter column room_id set not null;
  else
    raise notice 'time_capsules.room_id still has NULL rows; skip SET NOT NULL for now.';
  end if;

  if not exists (select 1 from public.time_capsules where created_by is null) then
    alter table public.time_capsules
      alter column created_by set not null;
  else
    raise notice 'time_capsules.created_by still has NULL rows; skip SET NOT NULL for now.';
  end if;
end $$;

-- Validate unlock constraint when historical data already satisfies it.
do $$
begin
  if not exists (
    select 1
    from public.time_capsules
    where unlock_at <= created_at + interval '1 second'
  ) then
    alter table public.time_capsules
      validate constraint time_capsules_unlock_future_chk;
  else
    raise notice 'time_capsules has legacy rows unlocking immediately; constraint kept NOT VALID for old rows.';
  end if;
end $$;

create index if not exists idx_time_capsules_room_unlock
  on public.time_capsules (room_id, unlock_at, created_at desc);

alter table public.time_capsules enable row level security;

drop policy if exists "time_capsules_select_members" on public.time_capsules;
create policy "time_capsules_select_members"
on public.time_capsules
for select
to authenticated
using (
  exists (
    select 1
    from public.lingo_rooms r
    where r.id = room_id
      and (r.owner_user_id = auth.uid() or r.partner_user_id = auth.uid())
  )
);

drop policy if exists "time_capsules_insert_members" on public.time_capsules;
create policy "time_capsules_insert_members"
on public.time_capsules
for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.lingo_rooms r
    where r.id = room_id
      and (r.owner_user_id = auth.uid() or r.partner_user_id = auth.uid())
  )
);

drop policy if exists "time_capsules_update_creator_member" on public.time_capsules;
create policy "time_capsules_update_creator_member"
on public.time_capsules
for update
to authenticated
using (
  created_by = auth.uid()
  and exists (
    select 1
    from public.lingo_rooms r
    where r.id = room_id
      and (r.owner_user_id = auth.uid() or r.partner_user_id = auth.uid())
  )
)
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.lingo_rooms r
    where r.id = room_id
      and (r.owner_user_id = auth.uid() or r.partner_user_id = auth.uid())
  )
);

drop policy if exists "time_capsules_delete_creator_member" on public.time_capsules;
create policy "time_capsules_delete_creator_member"
on public.time_capsules
for delete
to authenticated
using (
  created_by = auth.uid()
  and exists (
    select 1
    from public.lingo_rooms r
    where r.id = room_id
      and (r.owner_user_id = auth.uid() or r.partner_user_id = auth.uid())
  )
);
