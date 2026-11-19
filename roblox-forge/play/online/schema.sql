-- Roblox Forge · Jouer — online database (Supabase).
-- Paste everything in Supabase → SQL Editor → New query → Run. Safe to run again.

-- 1. players' profiles (one per account, created at sign-up)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  display_name text not null default '',
  look jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists "profiles readable by everyone" on public.profiles;
create policy "profiles readable by everyone" on public.profiles for select using (true);
drop policy if exists "own profile insert" on public.profiles;
create policy "own profile insert" on public.profiles for insert with check (auth.uid() = id);
drop policy if exists "own profile update" on public.profiles;
create policy "own profile update" on public.profiles for update using (auth.uid() = id);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', 'Player' || substr(new.id::text, 1, 6)), coalesce(new.raw_user_meta_data->>'username', 'Player'))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- 2. games everyone can see and play
create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 60),
  description text not null default '',
  genre text not null default 'jeu',
  kind text not null default 'rbxl' check (kind in ('rbxl', 'forge')),
  file_path text not null,
  size_bytes integer not null default 0,
  thumb text,
  visits bigint not null default 0,
  likes integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists games_visits on public.games (visits desc);
alter table public.games enable row level security;
drop policy if exists "games readable by everyone" on public.games;
create policy "games readable by everyone" on public.games for select using (true);
drop policy if exists "own games insert" on public.games;
create policy "own games insert" on public.games for insert with check (auth.uid() = owner);
drop policy if exists "own games update" on public.games;
create policy "own games update" on public.games for update using (auth.uid() = owner);
drop policy if exists "own games delete" on public.games;
create policy "own games delete" on public.games for delete using (auth.uid() = owner);

-- a visit counts once per player per game per hour (nobody can set the number directly)
create table if not exists public.visits (game_id uuid references public.games(id) on delete cascade, player uuid references public.profiles(id) on delete cascade, at timestamptz not null default now());
alter table public.visits enable row level security;
create or replace function public.record_visit(gid uuid) returns bigint language plpgsql security definer set search_path = public as $$
declare n bigint;
begin
  if auth.uid() is null then return (select visits from games where id = gid); end if;
  if not exists (select 1 from visits where game_id = gid and player = auth.uid() and at > now() - interval '1 hour') then
    insert into visits (game_id, player) values (gid, auth.uid());
    update games set visits = visits + 1 where id = gid;
  end if;
  select visits into n from games where id = gid; return n;
end $$;
grant execute on function public.record_visit(uuid) to anon, authenticated;

-- 3. friends: a request (pending) becomes a friendship (accepted)
create table if not exists public.friendships (
  requester uuid not null references public.profiles(id) on delete cascade,
  addressee uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (requester, addressee),
  check (requester <> addressee)
);
alter table public.friendships enable row level security;
drop policy if exists "see own friendships" on public.friendships;
create policy "see own friendships" on public.friendships for select using (auth.uid() in (requester, addressee));
drop policy if exists "send requests" on public.friendships;
create policy "send requests" on public.friendships for insert with check (auth.uid() = requester and status = 'pending');
drop policy if exists "accept requests" on public.friendships;
create policy "accept requests" on public.friendships for update using (auth.uid() = addressee) with check (status = 'accepted');
drop policy if exists "remove friendships" on public.friendships;
create policy "remove friendships" on public.friendships for delete using (auth.uid() in (requester, addressee));

-- 4. game files: public to read, each player writes only in their own folder
insert into storage.buckets (id, name, public, file_size_limit) values ('games', 'games', true, 52428800) on conflict (id) do nothing;
drop policy if exists "game files readable" on storage.objects;
create policy "game files readable" on storage.objects for select using (bucket_id = 'games');
drop policy if exists "upload own game files" on storage.objects;
create policy "upload own game files" on storage.objects for insert to authenticated with check (bucket_id = 'games' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "update own game files" on storage.objects;
create policy "update own game files" on storage.objects for update to authenticated using (bucket_id = 'games' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "delete own game files" on storage.objects;
create policy "delete own game files" on storage.objects for delete to authenticated using (bucket_id = 'games' and (storage.foldername(name))[1] = auth.uid()::text);

grant select on public.profiles, public.games to anon, authenticated;
grant insert, update on public.profiles to authenticated;
grant insert, update, delete on public.games, public.friendships to authenticated;
grant select on public.friendships to authenticated;
