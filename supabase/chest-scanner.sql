-- =====================================================================
--  CHEST SCANNER — classement en ligne + modération (Supabase)
--  À coller UNE FOIS dans Supabase : SQL Editor → New query → Run.
--  Ré-exécutable sans risque (idempotent).
--
--  Sécurité :
--   - la clé publique ne peut que LIRE le classement et la liste des bannis ;
--   - les scores passent par submit_score() : chaque joueur a une clé secrète,
--     personne ne peut écraser le score d'un autre ; un banni est refusé ;
--   - le pseudo « haydenV » est réservé à l'admin ;
--   - le code admin est vérifié DANS la base (jamais dans l'app),
--     avec un anti-force-brute (15 essais ratés / 10 min max).
-- =====================================================================

create table if not exists public.players (
  id         text primary key check (char_length(id) between 8 and 64),
  name       text not null check (char_length(name) between 1 and 16),
  all_time   integer not null default 0 check (all_time between 0 and 9999999),
  today      integer not null default 0 check (today between 0 and 9999999),
  day        text not null default '',
  updated_at bigint not null default 0
);
create table if not exists public.banned (
  id       text primary key,
  name     text,
  all_time integer not null default 0,
  at       bigint not null default 0,
  by       text
);
create table if not exists public.player_keys (id text primary key, secret text not null);
create table if not exists public.admins (token text primary key, device text, at timestamptz not null default now());
create table if not exists public.admin_fail (at timestamptz not null default now());
create table if not exists public.admin_config (k text primary key, v text not null);

-- code admin : 1324 (stocké sous forme d'empreinte)
insert into public.admin_config (k, v)
values ('code_hash', encode(sha256(convert_to('chestscanner|1324', 'UTF8')), 'hex'))
on conflict (k) do update set v = excluded.v;

alter table public.players      enable row level security;
alter table public.banned       enable row level security;
alter table public.player_keys  enable row level security;
alter table public.admins       enable row level security;
alter table public.admin_fail   enable row level security;
alter table public.admin_config enable row level security;

drop policy if exists "lecture publique" on public.players;
create policy "lecture publique" on public.players for select using (true);
drop policy if exists "lecture publique" on public.banned;
create policy "lecture publique" on public.banned for select using (true);
-- aucune politique d'écriture : tout passe par les fonctions ci-dessous

create or replace function public.now_ms() returns bigint language sql stable
as $$ select (extract(epoch from clock_timestamp()) * 1000)::bigint $$;

-- ---------- envoi du score ----------
create or replace function public.submit_score(p_id text, p_secret text, p_name text, p_all int, p_today int, p_day text)
returns text language plpgsql security definer set search_path = public as $$
declare k text;
begin
  if p_id is null or char_length(p_id) not between 8 and 64 or p_secret is null or char_length(p_secret) < 16 then return 'invalid'; end if;
  if exists (select 1 from banned where id = p_id) then delete from players where id = p_id; return 'banned'; end if;
  select secret into k from player_keys where id = p_id;
  if k is null then insert into player_keys (id, secret) values (p_id, p_secret);
  elsif k <> p_secret then return 'forbidden'; end if;
  p_name := left(btrim(regexp_replace(coalesce(p_name, ''), '[<>"''`[:cntrl:]]', '', 'g')), 16);
  if char_length(p_name) < 1 then p_name := 'Joueur'; end if;
  if lower(p_name) = 'haydenv' and not exists (select 1 from admins where device = p_id) then return 'reserved'; end if;
  insert into players (id, name, all_time, today, day, updated_at)
  values (p_id, p_name, greatest(0, least(coalesce(p_all, 0), 9999999)), greatest(0, least(coalesce(p_today, 0), 9999999)), left(coalesce(p_day, ''), 10), now_ms())
  on conflict (id) do update set name = excluded.name, all_time = excluded.all_time, today = excluded.today, day = excluded.day, updated_at = excluded.updated_at;
  return 'ok';
end $$;

-- ---------- admin ----------
create or replace function public.admin_login(p_code text, p_device text)
returns text language plpgsql security definer set search_path = public as $$
declare tok text;
begin
  delete from admin_fail where at < now() - interval '1 day';
  if (select count(*) from admin_fail where at > now() - interval '10 minutes') >= 15 then return 'locked'; end if;
  if encode(sha256(convert_to('chestscanner|' || coalesce(p_code, ''), 'UTF8')), 'hex') <> (select v from admin_config where k = 'code_hash') then
    insert into admin_fail default values; return null;
  end if;
  tok := md5(random()::text || clock_timestamp()::text) || md5(random()::text);
  insert into admins (token, device) values (tok, left(p_device, 64));
  return tok;
end $$;

create or replace function public.admin_ban(p_token text, p_target text, p_by text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from admins where token = p_token) then return false; end if;
  if exists (select 1 from admins where token = p_token and device = p_target) then return false; end if;
  insert into banned (id, name, all_time, at, by)
  select p_target, coalesce(p.name, 'Joueur'), coalesce(p.all_time, 0), now_ms(), left(p_by, 16)
  from (select 1) x left join players p on p.id = p_target
  on conflict (id) do update set at = excluded.at, by = excluded.by;
  delete from players where id = p_target;
  return true;
end $$;

create or replace function public.admin_unban(p_token text, p_target text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from admins where token = p_token) then return false; end if;
  delete from banned where id = p_target;
  return true;
end $$;

create or replace function public.admin_check(p_token text)
returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from admins where token = p_token)
$$;

revoke all on function public.submit_score(text, text, text, int, int, text) from public;
revoke all on function public.admin_login(text, text) from public;
revoke all on function public.admin_ban(text, text, text) from public;
revoke all on function public.admin_unban(text, text) from public;
revoke all on function public.admin_check(text) from public;
grant execute on function public.submit_score(text, text, text, int, int, text) to anon, authenticated;
grant execute on function public.admin_login(text, text) to anon, authenticated;
grant execute on function public.admin_ban(text, text, text) to anon, authenticated;
grant execute on function public.admin_unban(text, text) to anon, authenticated;
grant execute on function public.admin_check(text) to anon, authenticated;
grant select on public.players, public.banned to anon, authenticated;
