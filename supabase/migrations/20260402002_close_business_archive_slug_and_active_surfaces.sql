drop index if exists public.businesses_slug_unique_idx;

create unique index if not exists businesses_active_slug_unique_idx
  on public.businesses (slug)
  where is_active = true;

drop function if exists public.get_storefront_business_by_slug(text);

create function public.get_storefront_business_by_slug(requested_slug text)
returns table (
  id uuid,
  slug text,
  name text,
  business_type text,
  transfer_instructions text,
  accepts_cash boolean,
  accepts_transfer boolean,
  accepts_card boolean,
  created_at timestamptz,
  updated_at timestamptz,
  created_by_user_id uuid
)
language sql
security definer
set search_path = public
as $$
  select
    businesses.id,
    businesses.slug,
    businesses.name,
    businesses.business_type,
    businesses.transfer_instructions,
    coalesce(businesses.accepts_cash, true) as accepts_cash,
    coalesce(businesses.accepts_transfer, true) as accepts_transfer,
    coalesce(businesses.accepts_card, true) as accepts_card,
    businesses.created_at,
    businesses.updated_at,
    businesses.created_by_user_id
  from public.businesses
  where businesses.slug = requested_slug
    and businesses.is_active = true
    and businesses.created_by_user_id is not null
  limit 1;
$$;

revoke all on function public.get_storefront_business_by_slug(text) from public;
grant execute on function public.get_storefront_business_by_slug(text) to anon;
grant execute on function public.get_storefront_business_by_slug(text) to authenticated;

create or replace function public.deactivate_business(target_business_slug text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  archived_business public.businesses%rowtype;
begin
  update public.businesses
  set is_active = false,
      deactivated_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
  where slug = target_business_slug
    and is_active = true
    and (created_by_user_id = auth.uid() or public.is_platform_admin())
  returning * into archived_business;

  if archived_business.id is not null then
    return;
  end if;

  if exists (
    select 1
    from public.businesses
    where slug = target_business_slug
      and is_active = true
  ) then
    raise exception 'No tienes acceso para archivar este negocio.'
      using errcode = '42501';
  end if;

  raise exception 'Active business not found for slug "%".', target_business_slug
    using errcode = 'P0002';
end;
$$;

create or replace function public.deactivate_user_profile()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  update public.user_profiles
  set is_active = false,
      deactivated_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
  where user_id = auth.uid();

  update public.businesses
  set is_active = false,
      deactivated_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
  where created_by_user_id = auth.uid()
    and is_active = true;
end;
$$;

create or replace function public.update_business_name(
  target_business_slug text,
  new_name text
)
returns public.businesses
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  updated_business public.businesses%rowtype;
begin
  update public.businesses
  set name = new_name,
      updated_at = timezone('utc', now())
  where slug = target_business_slug
    and is_active = true
    and (created_by_user_id = auth.uid() or public.is_platform_admin())
  returning * into updated_business;

  return updated_business;
end;
$$;

drop policy if exists "authenticated can update owned businesses" on public.businesses;
create policy "authenticated can update owned businesses"
  on public.businesses
  for update
  to authenticated
  using (
    created_by_user_id = auth.uid()
    and is_active = true
  )
  with check (
    created_by_user_id = auth.uid()
    and is_active = true
    and (accepts_cash or accepts_transfer or accepts_card)
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
        and businesses.is_active = true
    )
  );

drop policy if exists "authenticated can insert accessible products" on public.products;
create policy "authenticated can insert accessible products"
  on public.products
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.businesses
      where businesses.id = products.business_id
        and businesses.created_by_user_id = auth.uid()
        and businesses.is_active = true
    )
  );

drop policy if exists "authenticated can update accessible products" on public.products;
create policy "authenticated can update accessible products"
  on public.products
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.businesses
      where businesses.id = products.business_id
        and businesses.created_by_user_id = auth.uid()
        and businesses.is_active = true
    )
  )
  with check (
    exists (
      select 1
      from public.businesses
      where businesses.id = products.business_id
        and businesses.created_by_user_id = auth.uid()
        and businesses.is_active = true
    )
  );

drop policy if exists "authenticated can delete accessible products" on public.products;
create policy "authenticated can delete accessible products"
  on public.products
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.businesses
      where businesses.id = products.business_id
        and businesses.created_by_user_id = auth.uid()
        and businesses.is_active = true
    )
  );

drop policy if exists "public can create orders" on public.orders;
create policy "public can create orders"
  on public.orders
  for insert
  to anon
  with check (
    exists (
      select 1
      from public.businesses
      where businesses.id = orders.business_id
        and businesses.created_by_user_id is not null
        and businesses.is_active = true
    )
    and public.orders_insert_request_is_valid(
      orders.delivery_type,
      orders.payment_method
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
        and businesses.is_active = true
    )
  );

drop policy if exists "authenticated can insert owned orders" on public.orders;
create policy "authenticated can insert owned orders"
  on public.orders
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.businesses
      where businesses.id = orders.business_id
        and businesses.created_by_user_id = auth.uid()
        and businesses.is_active = true
    )
    and public.orders_insert_request_is_valid(
      orders.delivery_type,
      orders.payment_method
    )
  );

drop policy if exists "authenticated can update accessible orders" on public.orders;
create policy "authenticated can update accessible orders"
  on public.orders
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.businesses
      where businesses.id = orders.business_id
        and businesses.created_by_user_id = auth.uid()
        and businesses.is_active = true
    )
  )
  with check (
    exists (
      select 1
      from public.businesses
      where businesses.id = orders.business_id
        and businesses.created_by_user_id = auth.uid()
        and businesses.is_active = true
    )
    and public.orders_payment_write_is_valid(
      orders.delivery_type,
      orders.payment_method,
      orders.payment_status,
      orders.status,
      orders.is_fiado,
      orders.fiado_status
    )
  );

grant execute on function public.deactivate_business(text) to authenticated;
grant execute on function public.deactivate_user_profile() to authenticated;
grant execute on function public.update_business_name(text, text) to authenticated;
revoke execute on function public.reactivate_business(text) from authenticated;
