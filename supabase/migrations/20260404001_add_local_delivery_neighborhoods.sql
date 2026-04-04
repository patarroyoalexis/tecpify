create table if not exists public.local_delivery_neighborhoods (
  id uuid primary key,
  city_key text not null,
  city_name text not null,
  name text not null,
  latitude double precision not null,
  longitude double precision not null,
  is_active boolean not null default true
);

alter table public.local_delivery_neighborhoods
  enable row level security;

create unique index if not exists local_delivery_neighborhoods_city_key_name_key
  on public.local_delivery_neighborhoods (
    lower(btrim(city_key)),
    lower(btrim(name))
  );

create index if not exists local_delivery_neighborhoods_city_key_idx
  on public.local_delivery_neighborhoods (city_key);

drop policy if exists "public can read active local delivery neighborhoods"
  on public.local_delivery_neighborhoods;
create policy "public can read active local delivery neighborhoods"
  on public.local_delivery_neighborhoods
  for select
  to anon
  using (is_active = true);

drop policy if exists "authenticated can read local delivery neighborhoods"
  on public.local_delivery_neighborhoods;
create policy "authenticated can read local delivery neighborhoods"
  on public.local_delivery_neighborhoods
  for select
  to authenticated
  using (
    is_active = true
    or public.is_platform_admin()
  );

drop policy if exists "authenticated can insert local delivery neighborhoods"
  on public.local_delivery_neighborhoods;
create policy "authenticated can insert local delivery neighborhoods"
  on public.local_delivery_neighborhoods
  for insert
  to authenticated
  with check (public.is_platform_admin());

drop policy if exists "authenticated can update local delivery neighborhoods"
  on public.local_delivery_neighborhoods;
create policy "authenticated can update local delivery neighborhoods"
  on public.local_delivery_neighborhoods
  for update
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists "authenticated can delete local delivery neighborhoods"
  on public.local_delivery_neighborhoods;
create policy "authenticated can delete local delivery neighborhoods"
  on public.local_delivery_neighborhoods
  for delete
  to authenticated
  using (public.is_platform_admin());

grant select on public.local_delivery_neighborhoods to anon, authenticated;
grant insert, update, delete on public.local_delivery_neighborhoods to authenticated;
