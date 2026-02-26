-- Lingo (Supabase-only) schema for pair code + shared room state
-- Run in Supabase SQL Editor (project DB)
-- After running:
-- 1) Enable your desired Auth providers in Supabase Auth
-- 2) Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to frontend env
-- 3) Enable Realtime on table public.lingo_room_states

create extension if not exists pgcrypto;

create table if not exists public.lingo_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  owner_username text not null,
  owner_provider text,
  owner_avatar_url text,
  partner_user_id uuid references auth.users(id) on delete set null,
  partner_username text,
  partner_provider text,
  partner_avatar_url text,
  status text not null default 'waiting' check (status in ('waiting', 'paired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz
);

create table if not exists public.lingo_room_states (
  room_id uuid primary key references public.lingo_rooms(id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create or replace function public.lingo_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_lingo_rooms_updated_at on public.lingo_rooms;
create trigger trg_lingo_rooms_updated_at
before update on public.lingo_rooms
for each row execute function public.lingo_touch_updated_at();

drop trigger if exists trg_lingo_room_states_updated_at on public.lingo_room_states;
create trigger trg_lingo_room_states_updated_at
before update on public.lingo_room_states
for each row execute function public.lingo_touch_updated_at();

alter table public.lingo_rooms enable row level security;
alter table public.lingo_room_states enable row level security;

-- Members can read only rooms they belong to
drop policy if exists "lingo_rooms_select_members" on public.lingo_rooms;
create policy "lingo_rooms_select_members"
on public.lingo_rooms
for select
to authenticated
using (auth.uid() = owner_user_id or auth.uid() = partner_user_id);

-- No direct insert/update/delete on rooms from client; use RPC functions below

-- Members can read/write room state for rooms they belong to
drop policy if exists "lingo_room_states_select_members" on public.lingo_room_states;
create policy "lingo_room_states_select_members"
on public.lingo_room_states
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

drop policy if exists "lingo_room_states_insert_members" on public.lingo_room_states;
create policy "lingo_room_states_insert_members"
on public.lingo_room_states
for insert
to authenticated
with check (
  exists (
    select 1
    from public.lingo_rooms r
    where r.id = room_id
      and (r.owner_user_id = auth.uid() or r.partner_user_id = auth.uid())
  )
);

drop policy if exists "lingo_room_states_update_members" on public.lingo_room_states;
create policy "lingo_room_states_update_members"
on public.lingo_room_states
for update
to authenticated
using (
  exists (
    select 1
    from public.lingo_rooms r
    where r.id = room_id
      and (r.owner_user_id = auth.uid() or r.partner_user_id = auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.lingo_rooms r
    where r.id = room_id
      and (r.owner_user_id = auth.uid() or r.partner_user_id = auth.uid())
  )
);

create or replace function public.lingo_generate_code()
returns text
language plpgsql
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  out_code text := '';
begin
  for i in 1..6 loop
    out_code := out_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return out_code;
end;
$$;

create or replace function public.lingo_my_room()
returns setof public.lingo_rooms
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  return query
  select r.*
  from public.lingo_rooms r
  where r.owner_user_id = auth.uid() or r.partner_user_id = auth.uid()
  order by r.updated_at desc, r.created_at desc
  limit 1;
end;
$$;

create or replace function public.lingo_create_room(
  p_owner_username text,
  p_owner_provider text default null,
  p_owner_avatar_url text default null
)
returns setof public.lingo_rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.lingo_rooms;
  v_room public.lingo_rooms;
  v_code text;
  v_attempt int := 0;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  select *
    into v_existing
  from public.lingo_rooms r
  where r.owner_user_id = auth.uid() or r.partner_user_id = auth.uid()
  order by r.updated_at desc, r.created_at desc
  limit 1;

  if found then
    return query select v_existing.*;
    return;
  end if;

  loop
    v_attempt := v_attempt + 1;
    if v_attempt > 20 then
      raise exception 'CANNOT_GENERATE_UNIQUE_CODE';
    end if;

    v_code := public.lingo_generate_code();
    begin
      insert into public.lingo_rooms (
        code,
        owner_user_id,
        owner_username,
        owner_provider,
        owner_avatar_url,
        status,
        expires_at
      )
      values (
        v_code,
        auth.uid(),
        coalesce(nullif(trim(p_owner_username), ''), 'user'),
        nullif(trim(coalesce(p_owner_provider, '')), ''),
        nullif(trim(coalesce(p_owner_avatar_url, '')), ''),
        'waiting',
        now() + interval '30 days'
      )
      returning * into v_room;

      exit;
    exception when unique_violation then
      -- retry
    end;
  end loop;

  return query select v_room.*;
end;
$$;

create or replace function public.lingo_join_room(
  p_code text,
  p_partner_username text,
  p_partner_provider text default null,
  p_partner_avatar_url text default null
)
returns setof public.lingo_rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_room public.lingo_rooms;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  v_code := upper(regexp_replace(coalesce(p_code, ''), '[^A-Z0-9]', '', 'g'));
  if length(v_code) <> 6 then
    raise exception 'INVALID_CODE';
  end if;

  select *
    into v_room
  from public.lingo_rooms r
  where r.code = v_code
  for update;

  if not found then
    raise exception 'CODE_NOT_FOUND_OR_EXPIRED';
  end if;

  if v_room.owner_user_id = auth.uid() then
    return query select v_room.*;
    return;
  end if;

  if v_room.partner_user_id is not null and v_room.partner_user_id <> auth.uid() then
    raise exception 'ROOM_ALREADY_HAS_2_PEOPLE';
  end if;

  update public.lingo_rooms r
  set partner_user_id = auth.uid(),
      partner_username = coalesce(nullif(trim(p_partner_username), ''), 'partner'),
      partner_provider = nullif(trim(coalesce(p_partner_provider, '')), ''),
      partner_avatar_url = nullif(trim(coalesce(p_partner_avatar_url, '')), ''),
      status = 'paired',
      expires_at = now() + interval '365 days'
  where r.id = v_room.id
  returning * into v_room;

  return query select v_room.*;
end;
$$;

grant execute on function public.lingo_my_room() to authenticated;
grant execute on function public.lingo_create_room(text, text, text) to authenticated;
grant execute on function public.lingo_join_room(text, text, text, text) to authenticated;

-- Realtime (run once if not already enabled)
alter publication supabase_realtime add table public.lingo_room_states;

