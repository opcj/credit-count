-- Credit Count's entire authorization boundary is reproducible from this migration.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create type public.coaster_type as enum ('steel', 'wooden', 'hybrid');

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (display_name = btrim(display_name) and char_length(display_name) between 1 and 50),
  leaderboard_opt_in boolean not null default false,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.coasters (
  id uuid primary key default gen_random_uuid(),
  name text not null check (name = btrim(name) and char_length(name) between 1 and 120),
  park text not null check (park = btrim(park) and char_length(park) between 1 and 120),
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  manufacturer text not null check (manufacturer = btrim(manufacturer) and char_length(manufacturer) between 1 and 100),
  type public.coaster_type not null,
  source_url text check (source_url is null or (source_url ~ '^https://' and char_length(source_url) <= 500)),
  archived_at timestamptz,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index coasters_identity on public.coasters (
  lower(regexp_replace(btrim(name), '\s+', ' ', 'g')),
  lower(regexp_replace(btrim(park), '\s+', ' ', 'g')), country_code
);

create table public.rides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  coaster_id uuid not null references public.coasters(id) on delete restrict,
  ridden_on date not null check (ridden_on between date '0001-01-01' and date '9999-12-31'),
  note text check (note is null or char_length(note) <= 500),
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index rides_user_coaster on public.rides(user_id, coaster_id);
create index rides_history on public.rides(user_id, ridden_on desc, id desc);
create index rides_coaster on public.rides(coaster_id);

create table private.catalogue_audit (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_id uuid,
  origin text not null,
  operation text not null,
  coaster_id uuid not null,
  related_coaster_id uuid,
  before_data jsonb,
  after_data jsonb
);

alter table public.profiles enable row level security;
alter table public.admin_users enable row level security;
alter table public.coasters enable row level security;
alter table public.rides enable row level security;
alter table private.catalogue_audit enable row level security;

revoke all on public.profiles, public.admin_users, public.coasters, public.rides from anon, authenticated;
grant select on public.profiles, public.admin_users, public.coasters, public.rides to authenticated;
grant update(display_name, leaderboard_opt_in) on public.profiles to authenticated;
grant insert(id, coaster_id, ridden_on, note) on public.rides to authenticated;
grant update(coaster_id, ridden_on, note) on public.rides to authenticated;
grant delete on public.rides to authenticated;
grant insert(id, name, park, country_code, manufacturer, type, source_url) on public.coasters to authenticated;
grant update(name, park, country_code, manufacturer, type, source_url, archived_at) on public.coasters to authenticated;
grant delete on public.coasters to authenticated;
grant all on public.profiles, public.admin_users, public.coasters, public.rides to service_role;
revoke all on private.catalogue_audit from public, anon, authenticated;

create policy profiles_own_read on public.profiles for select to authenticated using (user_id = (select auth.uid()));
create policy profiles_own_update on public.profiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy admin_membership_own_read on public.admin_users for select to authenticated using (user_id = (select auth.uid()));
create policy catalogue_read on public.coasters for select to authenticated using (true);
create policy catalogue_admin_insert on public.coasters for insert to authenticated with check (
  exists (select 1 from public.admin_users where user_id = (select auth.uid()))
);
create policy catalogue_admin_update on public.coasters for update to authenticated
  using (exists (select 1 from public.admin_users where user_id = (select auth.uid())))
  with check (exists (select 1 from public.admin_users where user_id = (select auth.uid())));
create policy catalogue_admin_delete on public.coasters for delete to authenticated
  using (exists (select 1 from public.admin_users where user_id = (select auth.uid())));
create policy rides_own_read on public.rides for select to authenticated using (user_id = (select auth.uid()));
create policy rides_own_insert on public.rides for insert to authenticated with check (user_id = (select auth.uid()));
create policy rides_own_update on public.rides for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy rides_own_delete on public.rides for delete to authenticated using (user_id = (select auth.uid()));

create function private.touch_revision() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.revision := old.revision + 1;
  new.created_at := old.created_at;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
create trigger profiles_revision before update on public.profiles for each row execute function private.touch_revision();
create trigger coasters_revision before update on public.coasters for each row execute function private.touch_revision();
create trigger rides_revision before update on public.rides for each row execute function private.touch_revision();

create function private.handle_signup() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(user_id, display_name)
  values (new.id, coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), 'Enthusiast'));
  return new;
end;
$$;
create trigger credit_count_signup after insert on auth.users for each row execute function private.handle_signup();

-- A normal user must not receive catalogue UPDATE grants merely to lock this row.
-- SHARE serializes against archival (a non-key UPDATE); KEY SHARE would not.
create function private.validate_active_coaster() returns trigger
language plpgsql security definer set search_path = '' as $$
declare archived timestamptz;
begin
  if tg_op = 'UPDATE' and new.coaster_id = old.coaster_id then return new; end if;
  select archived_at into archived from public.coasters where id = new.coaster_id for share;
  if not found or archived is not null then
    raise exception using errcode = '23514', message = 'Choose an active coaster from the catalogue.';
  end if;
  return new;
end;
$$;
create trigger rides_active_coaster before insert or update of coaster_id on public.rides
  for each row execute function private.validate_active_coaster();

create function private.audit_catalogue() returns trigger
language plpgsql security definer set search_path = '' as $$
declare before_row jsonb; after_row jsonb; change_kind text;
begin
  if tg_op <> 'INSERT' then before_row := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then after_row := to_jsonb(new); end if;
  change_kind := lower(tg_op);
  if tg_op = 'UPDATE' and old.archived_at is distinct from new.archived_at then
    change_kind := case when new.archived_at is null then 'restore' else 'archive' end;
  end if;
  insert into private.catalogue_audit(actor_id, origin, operation, coaster_id, before_data, after_data)
  values (auth.uid(), case when auth.uid() is null then 'operator' else 'application' end,
    change_kind, coalesce(new.id, old.id), before_row, after_row);
  return coalesce(new, old);
end;
$$;
create trigger coasters_audit after insert or update or delete on public.coasters
  for each row execute function private.audit_catalogue();

-- Only changes to already-public identity/consent emit this empty refresh hint.
-- The exception block applies solely to notification delivery, never the profile write.
create function private.notify_leaderboard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare changed boolean := false;
begin
  if tg_op = 'INSERT' then changed := new.leaderboard_opt_in;
  elsif tg_op = 'DELETE' then changed := old.leaderboard_opt_in;
  else changed := new.leaderboard_opt_in is distinct from old.leaderboard_opt_in
      or (new.leaderboard_opt_in and new.display_name is distinct from old.display_name);
  end if;
  if changed then
    begin
      perform realtime.send('{}'::jsonb, 'leaderboard_changed', 'credit-count:leaderboard', false);
    exception when others then
      raise log 'Credit Count notification unavailable (SQLSTATE %)', sqlstate;
    end;
  end if;
  return coalesce(new, old);
end;
$$;
create trigger profiles_leaderboard_event after insert or update or delete on public.profiles
  for each row execute function private.notify_leaderboard();

create function public.get_my_stats() returns jsonb
language sql stable security invoker set search_path = '' as $$
  with my_rides as materialized (
    select coaster_id from public.rides where user_id = (select auth.uid())
  ), credits as materialized (
    select c.* from public.coasters c join (select distinct coaster_id from my_rides) r on r.coaster_id = c.id
  )
  select jsonb_build_object(
    'total_credits', (select count(*) from credits),
    'total_rides', (select count(*) from my_rides),
    'by_country', (select coalesce(jsonb_agg(jsonb_build_object('label', label, 'count', n) order by n desc, label), '[]'::jsonb)
      from (select country_code as label, count(*) as n from credits group by country_code) g),
    'by_manufacturer', (select coalesce(jsonb_agg(jsonb_build_object('label', label, 'count', n) order by n desc, label), '[]'::jsonb)
      from (select manufacturer as label, count(*) as n from credits group by manufacturer) g),
    'by_type', (select coalesce(jsonb_agg(jsonb_build_object('label', label, 'count', n) order by n desc, label), '[]'::jsonb)
      from (select type::text as label, count(*) as n from credits group by type) g),
    'most_ridden', (select jsonb_build_object('id', c.id, 'name', c.name, 'park', c.park, 'rides', count(*))
      from my_rides r join public.coasters c on c.id = r.coaster_id
      group by c.id, c.name, c.park order by count(*) desc, c.name, c.id limit 1)
  );
$$;

create function public.get_leaderboard(p_limit integer default 25, p_offset integer default 0)
returns table(display_name text, credit_count bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_limit is null or p_limit < 1 or p_limit > 100 or p_offset is null or p_offset < 0 or p_offset > 100000 then
    raise exception using errcode = '22023', message = 'Invalid leaderboard page.';
  end if;
  return query select p.display_name, count(distinct r.coaster_id) as credit_count
    from public.profiles p left join public.rides r on r.user_id = p.user_id
    where p.leaderboard_opt_in
    group by p.user_id, p.display_name
    order by count(distinct r.coaster_id) desc, lower(p.display_name), p.display_name, p.user_id
    limit p_limit offset p_offset;
end;
$$;

create function public.merge_coasters(p_source_id uuid, p_target_id uuid, p_source_revision integer, p_target_revision integer)
returns void language plpgsql security definer set search_path = '' as $$
declare source_row public.coasters; target_row public.coasters;
begin
  if auth.uid() is null or not exists (select 1 from public.admin_users where user_id = auth.uid()) then
    raise exception using errcode = '42501', message = 'Catalogue administrator access required.';
  end if;
  if p_source_id is null or p_target_id is null or p_source_id = p_target_id then
    raise exception using errcode = '22023', message = 'Choose two different coasters.';
  end if;
  perform id from public.coasters where id in (p_source_id, p_target_id) order by id for update;
  select * into source_row from public.coasters where id = p_source_id;
  select * into target_row from public.coasters where id = p_target_id;
  if source_row.id is null or target_row.id is null or target_row.archived_at is not null then
    raise exception using errcode = '22023', message = 'Choose an existing source and an active destination.';
  end if;
  if p_source_revision is distinct from source_row.revision or p_target_revision is distinct from target_row.revision then
    raise exception using errcode = '40001', message = 'The catalogue changed. Reload and review the merge again.';
  end if;
  update public.rides set coaster_id = p_target_id where coaster_id = p_source_id;
  delete from public.coasters where id = p_source_id;
  insert into private.catalogue_audit(actor_id, origin, operation, coaster_id, related_coaster_id, before_data, after_data)
    values (auth.uid(), 'application', 'merge', p_source_id, p_target_id, to_jsonb(source_row), to_jsonb(target_row));
end;
$$;

revoke all on all functions in schema private from public, anon, authenticated;
revoke all on function public.get_my_stats() from public, anon;
revoke all on function public.get_leaderboard(integer, integer) from public;
revoke all on function public.merge_coasters(uuid, uuid, integer, integer) from public, anon;
grant execute on function public.get_my_stats() to authenticated;
grant execute on function public.get_leaderboard(integer, integer) to anon, authenticated;
grant execute on function public.merge_coasters(uuid, uuid, integer, integer) to authenticated;

-- No private ride/profile row publication. Realtime uses only the explicit broadcast above.
do $$
declare t record;
begin
  for t in select schemaname, tablename from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename in ('profiles', 'rides', 'admin_users', 'coasters')
  loop
    execute format('alter publication supabase_realtime drop table %I.%I', t.schemaname, t.tablename);
  end loop;
end;
$$;
