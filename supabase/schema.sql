-- Lingrow cloud schema (run in Supabase SQL editor)
-- Enables per-user collections synced from the app via GitHub auth.

create table if not exists public.collections (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  description text not null default '',
  word_lang text not null,
  translation_lang text not null,
  level text,
  theme text,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.words (
  id text primary key,
  collection_id text not null references public.collections (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  word text not null,
  translation text not null,
  examples jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0
);

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  pronounce_first text not null default 'translation',
  updated_at timestamptz not null default now()
);

create index if not exists collections_user_id_idx on public.collections (user_id);
create index if not exists words_user_id_idx on public.words (user_id);
create index if not exists words_collection_id_idx on public.words (collection_id);

alter table public.collections enable row level security;
alter table public.words enable row level security;
alter table public.user_settings enable row level security;

drop policy if exists "collections_select_own" on public.collections;
drop policy if exists "collections_insert_own" on public.collections;
drop policy if exists "collections_update_own" on public.collections;
drop policy if exists "collections_delete_own" on public.collections;

create policy "collections_select_own" on public.collections
  for select using (auth.uid() = user_id);
create policy "collections_insert_own" on public.collections
  for insert with check (auth.uid() = user_id);
create policy "collections_update_own" on public.collections
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "collections_delete_own" on public.collections
  for delete using (auth.uid() = user_id);

drop policy if exists "words_select_own" on public.words;
drop policy if exists "words_insert_own" on public.words;
drop policy if exists "words_update_own" on public.words;
drop policy if exists "words_delete_own" on public.words;

create policy "words_select_own" on public.words
  for select using (auth.uid() = user_id);
create policy "words_insert_own" on public.words
  for insert with check (auth.uid() = user_id);
create policy "words_update_own" on public.words
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "words_delete_own" on public.words
  for delete using (auth.uid() = user_id);

drop policy if exists "settings_select_own" on public.user_settings;
drop policy if exists "settings_insert_own" on public.user_settings;
drop policy if exists "settings_update_own" on public.user_settings;
drop policy if exists "settings_delete_own" on public.user_settings;

create policy "settings_select_own" on public.user_settings
  for select using (auth.uid() = user_id);
create policy "settings_insert_own" on public.user_settings
  for insert with check (auth.uid() = user_id);
create policy "settings_update_own" on public.user_settings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "settings_delete_own" on public.user_settings
  for delete using (auth.uid() = user_id);
