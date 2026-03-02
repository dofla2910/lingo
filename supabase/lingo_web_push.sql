-- Web Push subscriptions for lingo ping notifications
-- Run in Supabase SQL Editor

create extension if not exists pgcrypto;

create table if not exists public.lingo_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  room_id uuid not null references public.lingo_rooms(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  subscription jsonb not null,
  enabled boolean not null default true,
  user_agent text,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_lingo_push_subscriptions_room_user
  on public.lingo_push_subscriptions(room_id, user_id);

create index if not exists idx_lingo_push_subscriptions_user
  on public.lingo_push_subscriptions(user_id);

create or replace function public.lingo_touch_push_subscription_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_lingo_push_subscriptions_updated_at on public.lingo_push_subscriptions;
create trigger trg_lingo_push_subscriptions_updated_at
before update on public.lingo_push_subscriptions
for each row execute function public.lingo_touch_push_subscription_updated_at();

alter table public.lingo_push_subscriptions enable row level security;

drop policy if exists "lingo_push_subscriptions_select_own" on public.lingo_push_subscriptions;
create policy "lingo_push_subscriptions_select_own"
on public.lingo_push_subscriptions
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "lingo_push_subscriptions_insert_own_member" on public.lingo_push_subscriptions;
create policy "lingo_push_subscriptions_insert_own_member"
on public.lingo_push_subscriptions
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.lingo_rooms r
    where r.id = room_id
      and (r.owner_user_id = auth.uid() or r.partner_user_id = auth.uid())
  )
);

drop policy if exists "lingo_push_subscriptions_update_own_member" on public.lingo_push_subscriptions;
create policy "lingo_push_subscriptions_update_own_member"
on public.lingo_push_subscriptions
for update
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.lingo_rooms r
    where r.id = room_id
      and (r.owner_user_id = auth.uid() or r.partner_user_id = auth.uid())
  )
)
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.lingo_rooms r
    where r.id = room_id
      and (r.owner_user_id = auth.uid() or r.partner_user_id = auth.uid())
  )
);

drop policy if exists "lingo_push_subscriptions_delete_own" on public.lingo_push_subscriptions;
create policy "lingo_push_subscriptions_delete_own"
on public.lingo_push_subscriptions
for delete
to authenticated
using (user_id = auth.uid());

grant select, insert, update, delete on public.lingo_push_subscriptions to authenticated;
