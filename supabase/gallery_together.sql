-- Gallery Together (Album Kỷ Niệm)
-- Run this script in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.albums (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  cover_image_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references public.albums(id) on delete cascade,
  image_url text not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_albums_created_at_desc
  on public.albums (created_at desc);

create index if not exists idx_photos_album_created_at_desc
  on public.photos (album_id, created_at desc);

-- Auto set album cover from first uploaded photo if cover is empty.
create or replace function public.set_album_cover_if_empty()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.albums
  set cover_image_url = coalesce(nullif(cover_image_url, ''), new.image_url)
  where id = new.album_id;
  return new;
end;
$$;

drop trigger if exists trg_set_album_cover_if_empty on public.photos;
create trigger trg_set_album_cover_if_empty
after insert on public.photos
for each row
execute function public.set_album_cover_if_empty();

alter table public.albums enable row level security;
alter table public.photos enable row level security;

-- For app scope currently: all authenticated users can read/write.
-- If you want stricter per-couple rules later, add owner/room columns + policy filter.
drop policy if exists albums_select_authenticated on public.albums;
drop policy if exists albums_insert_authenticated on public.albums;
drop policy if exists albums_update_authenticated on public.albums;
drop policy if exists albums_delete_authenticated on public.albums;

create policy albums_select_authenticated
on public.albums
for select
to authenticated
using (true);

create policy albums_insert_authenticated
on public.albums
for insert
to authenticated
with check (true);

create policy albums_update_authenticated
on public.albums
for update
to authenticated
using (true)
with check (true);

create policy albums_delete_authenticated
on public.albums
for delete
to authenticated
using (true);

drop policy if exists photos_select_authenticated on public.photos;
drop policy if exists photos_insert_authenticated on public.photos;
drop policy if exists photos_update_authenticated on public.photos;
drop policy if exists photos_delete_authenticated on public.photos;

create policy photos_select_authenticated
on public.photos
for select
to authenticated
using (true);

create policy photos_insert_authenticated
on public.photos
for insert
to authenticated
with check (true);

create policy photos_update_authenticated
on public.photos
for update
to authenticated
using (true)
with check (true);

create policy photos_delete_authenticated
on public.photos
for delete
to authenticated
using (true);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.albums to authenticated;
grant select, insert, update, delete on public.photos to authenticated;
