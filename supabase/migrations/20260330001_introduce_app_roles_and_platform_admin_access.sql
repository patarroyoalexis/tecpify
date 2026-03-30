do $$
begin
  if not exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'app_role'
  ) then
    create type public.app_role as enum (
      'platform_admin',
      'business_owner',
      'customer'
    );
  end if;
end $$;

create table if not exists public.user_profiles (
  user_id uuid primary key
    references auth.users (id)
    on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists user_profiles_role_idx
  on public.user_profiles (role);

create or replace function public.set_user_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists user_profiles_set_updated_at on public.user_profiles;
create trigger user_profiles_set_updated_at
before update on public.user_profiles
for each row
execute function public.set_user_profiles_updated_at();

create or replace function public.handle_auth_user_profile_defaults()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.user_profiles (
    user_id,
    role,
    created_at,
    updated_at
  )
  values (
    new.id,
    'business_owner'::public.app_role,
    coalesce(new.created_at, timezone('utc', now())),
    coalesce(new.updated_at, new.created_at, timezone('utc', now()))
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_create_user_profile on auth.users;
create trigger on_auth_user_created_create_user_profile
after insert on auth.users
for each row
execute function public.handle_auth_user_profile_defaults();

insert into public.user_profiles (
  user_id,
  role,
  created_at,
  updated_at
)
select
  users.id,
  'business_owner'::public.app_role,
  coalesce(users.created_at, timezone('utc', now())),
  coalesce(users.updated_at, users.created_at, timezone('utc', now()))
from auth.users as users
on conflict (user_id) do nothing;

insert into public.user_profiles (
  user_id,
  role,
  created_at,
  updated_at
)
select distinct
  businesses.created_by_user_id,
  'business_owner'::public.app_role,
  timezone('utc', now()),
  timezone('utc', now())
from public.businesses as businesses
where businesses.created_by_user_id is not null
on conflict (user_id) do update
set role = case
    when public.user_profiles.role = 'platform_admin'::public.app_role
      then public.user_profiles.role
    else 'business_owner'::public.app_role
  end,
  updated_at = case
    when public.user_profiles.role = 'platform_admin'::public.app_role
      then public.user_profiles.updated_at
    else timezone('utc', now())
  end;

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select user_profiles.role
  from public.user_profiles
  where user_profiles.user_id = auth.uid()
  limit 1;
$$;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.current_app_role() = 'platform_admin'::public.app_role,
    false
  );
$$;

create or replace function public.upsert_user_profile_role(
  target_user_id uuid,
  next_role public.app_role
)
returns public.user_profiles
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_profile public.user_profiles%rowtype;
begin
  if target_user_id is null then
    raise exception 'target_user_id is required'
      using errcode = '22004';
  end if;

  if not exists (
    select 1
    from auth.users
    where id = target_user_id
  ) then
    raise exception 'auth user not found for target_user_id %', target_user_id
      using errcode = '23503';
  end if;

  insert into public.user_profiles (
    user_id,
    role,
    created_at,
    updated_at
  )
  values (
    target_user_id,
    next_role,
    timezone('utc', now()),
    timezone('utc', now())
  )
  on conflict (user_id) do update
  set role = excluded.role,
    updated_at = timezone('utc', now())
  returning *
  into target_profile;

  return target_profile;
end;
$$;

create or replace function public.upsert_user_profile_role_by_email(
  target_email text,
  next_role public.app_role
)
returns public.user_profiles
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  normalized_email text := lower(trim(coalesce(target_email, '')));
  matched_user_id uuid;
  target_profile public.user_profiles%rowtype;
begin
  if normalized_email = '' then
    raise exception 'target_email is required'
      using errcode = '22004';
  end if;

  select users.id
  into matched_user_id
  from auth.users as users
  where lower(coalesce(users.email, '')) = normalized_email
  order by users.created_at desc, users.id desc
  limit 1;

  if matched_user_id is null then
    raise exception 'auth user not found for email %', normalized_email
      using errcode = '23503';
  end if;

  select *
  into target_profile
  from public.upsert_user_profile_role(matched_user_id, next_role);

  return target_profile;
end;
$$;

alter table public.user_profiles
  enable row level security;

drop policy if exists "authenticated can read own or admin user profiles"
  on public.user_profiles;
create policy "authenticated can read own or admin user profiles"
  on public.user_profiles
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_platform_admin()
  );

drop policy if exists "authenticated can read owned businesses" on public.businesses;
create policy "authenticated can read owned businesses"
  on public.businesses
  for select
  to authenticated
  using (
    created_by_user_id = auth.uid()
    or public.is_platform_admin()
  );

drop policy if exists "authenticated can read accessible products" on public.products;
create policy "authenticated can read accessible products"
  on public.products
  for select
  to authenticated
  using (
    public.is_platform_admin()
    or exists (
      select 1
      from public.businesses
      where businesses.id = products.business_id
        and businesses.created_by_user_id = auth.uid()
    )
  );

drop policy if exists "authenticated can read accessible orders" on public.orders;
create policy "authenticated can read accessible orders"
  on public.orders
  for select
  to authenticated
  using (
    public.is_platform_admin()
    or exists (
      select 1
      from public.businesses
      where businesses.id = orders.business_id
        and businesses.created_by_user_id = auth.uid()
    )
  );

grant usage on type public.app_role to authenticated;
grant select on public.user_profiles to authenticated;

revoke all on function public.current_app_role() from public, anon;
revoke all on function public.is_platform_admin() from public, anon;
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.is_platform_admin() to authenticated;

revoke all on function public.upsert_user_profile_role(uuid, public.app_role)
from public, anon, authenticated;
revoke all on function public.upsert_user_profile_role_by_email(text, public.app_role)
from public, anon, authenticated;
