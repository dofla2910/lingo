-- Quick Ping / Heartbeat table for realtime "Nút chạm"
-- Run after supabase/lingo_schema.sql

create extension if not exists pgcrypto;

create table if not exists public.lingo_pings (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.lingo_rooms(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_lingo_pings_room_created
  on public.lingo_pings (room_id, created_at desc);

alter table public.lingo_pings enable row level security;

drop policy if exists "lingo_pings_select_members" on public.lingo_pings;
create policy "lingo_pings_select_members"
on public.lingo_pings
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

drop policy if exists "lingo_pings_insert_members" on public.lingo_pings;
create policy "lingo_pings_insert_members"
on public.lingo_pings
for insert
to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1
    from public.lingo_rooms r
    where r.id = room_id
      and (r.owner_user_id = auth.uid() or r.partner_user_id = auth.uid())
  )
);

-- Required for Supabase Realtime INSERT stream.
do $$
begin
  if not exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    create publication supabase_realtime;
  end if;
exception
  when insufficient_privilege then
    raise notice 'Skip creating publication supabase_realtime due to privilege. Create manually if needed.';
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'lingo_pings'
  ) then
    alter publication supabase_realtime add table public.lingo_pings;
  end if;
exception
  when insufficient_privilege then
    raise notice 'Skip adding table to publication supabase_realtime due to privilege. Add manually in dashboard.';
  when undefined_object then
    raise notice 'Publication supabase_realtime does not exist. Create it first, then add public.lingo_pings.';
end $$;
