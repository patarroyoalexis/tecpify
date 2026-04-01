-- Add status columns and full_name to user_profiles
alter table public.user_profiles
  add column if not exists full_name text,
  add column if not exists is_active boolean not null default true,
  add column if not exists deactivated_at timestamptz;

-- Add status columns to businesses
alter table public.businesses
  add column if not exists is_active boolean not null default true,
  add column if not exists deactivated_at timestamptz;

-- Update RLS for businesses to respect is_active for public access
-- Owners and admins can still see deactivated businesses
drop policy if exists "public can read businesses" on public.businesses;
create policy "public can read businesses"
  on public.businesses
  for select
  using (
    (is_active = true)
    or (auth.uid() = created_by_user_id)
    or public.is_platform_admin()
  );

-- Update RLS for products: only active businesses or owner/admin can read products
drop policy if exists "public can read active products" on public.products;
create policy "public can read active products"
  on public.products
  for select
  using (
    is_available = true
    and exists (
      select 1
      from public.businesses
      where businesses.id = products.business_id
        and businesses.is_active = true
    )
  );

-- Update RLS for orders creation: only active businesses can receive orders from public
drop policy if exists "public can create orders" on public.orders;
create policy "public can create orders"
  on public.orders
  for insert
  with check (
    exists (
      select 1
      from public.businesses
      where businesses.id = orders.business_id
        and businesses.is_active = true
    )
  );

-- Function to deactivate a business (logical delete/archive)
create or replace function public.deactivate_business(target_business_slug text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  update public.businesses
  set is_active = false,
      deactivated_at = timezone('utc', now())
  where business_slug = target_business_slug
    and (created_by_user_id = auth.uid() or public.is_platform_admin());
end;
$$;

-- Function to reactivate a business
create or replace function public.reactivate_business(target_business_slug text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  update public.businesses
  set is_active = true,
      deactivated_at = null
  where business_slug = target_business_slug
    and (created_by_user_id = auth.uid() or public.is_platform_admin());
end;
$$;

-- Function to deactivate a user account (close account)
create or replace function public.deactivate_user_profile()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  -- Deactivate the user profile
  update public.user_profiles
  set is_active = false,
      deactivated_at = timezone('utc', now())
  where user_id = auth.uid();

  -- Deactivate all businesses owned by this user
  update public.businesses
  set is_active = false,
      deactivated_at = timezone('utc', now())
  where created_by_user_id = auth.uid();
end;
$$;

-- Function to update user profile
create or replace function public.update_user_profile(
  new_full_name text
)
returns public.user_profiles
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  updated_profile public.user_profiles%rowtype;
begin
  update public.user_profiles
  set full_name = new_full_name,
      updated_at = timezone('utc', now())
  where user_id = auth.uid()
  returning * into updated_profile;

  return updated_profile;
end;
$$;

-- Function to update business name
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
  where business_slug = target_business_slug
    and (created_by_user_id = auth.uid() or public.is_platform_admin())
  returning * into updated_business;

  return updated_business;
end;
$$;

grant execute on function public.deactivate_business(text) to authenticated;
grant execute on function public.reactivate_business(text) to authenticated;
grant execute on function public.deactivate_user_profile() to authenticated;
grant execute on function public.update_user_profile(text) to authenticated;
grant execute on function public.update_business_name(text, text) to authenticated;
