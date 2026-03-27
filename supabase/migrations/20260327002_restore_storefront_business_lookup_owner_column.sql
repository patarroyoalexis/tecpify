drop function if exists public.get_storefront_business_by_slug(text);

create function public.get_storefront_business_by_slug(requested_slug text)
returns table (
  id uuid,
  slug text,
  name text,
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
    businesses.created_at,
    businesses.updated_at,
    businesses.created_by_user_id
  from public.businesses
  where businesses.slug = requested_slug
    and businesses.created_by_user_id is not null
  limit 1;
$$;

revoke all on function public.get_storefront_business_by_slug(text) from public;
grant execute on function public.get_storefront_business_by_slug(text) to anon;
grant execute on function public.get_storefront_business_by_slug(text) to authenticated;
