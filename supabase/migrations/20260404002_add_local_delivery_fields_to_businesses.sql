alter table public.businesses
  add column if not exists local_delivery_enabled boolean not null default false,
  add column if not exists local_delivery_origin_neighborhood_id uuid,
  add column if not exists local_delivery_max_distance_km numeric,
  add column if not exists local_delivery_pricing_bands jsonb not null default '[]'::jsonb;

update public.businesses
set
  local_delivery_enabled = coalesce(local_delivery_enabled, false),
  local_delivery_pricing_bands = coalesce(local_delivery_pricing_bands, '[]'::jsonb);

alter table public.businesses
  alter column local_delivery_enabled set default false,
  alter column local_delivery_enabled set not null,
  alter column local_delivery_pricing_bands set default '[]'::jsonb,
  alter column local_delivery_pricing_bands set not null;

alter table public.businesses
  drop constraint if exists businesses_local_delivery_origin_neighborhood_fk;

alter table public.businesses
  add constraint businesses_local_delivery_origin_neighborhood_fk
  foreign key (local_delivery_origin_neighborhood_id)
  references public.local_delivery_neighborhoods(id)
  on delete set null;

alter table public.businesses
  drop constraint if exists businesses_local_delivery_max_distance_km_nonnegative;

alter table public.businesses
  add constraint businesses_local_delivery_max_distance_km_nonnegative
  check (local_delivery_max_distance_km is null or local_delivery_max_distance_km >= 0);

alter table public.businesses
  drop constraint if exists businesses_local_delivery_pricing_bands_is_array;

alter table public.businesses
  add constraint businesses_local_delivery_pricing_bands_is_array
  check (jsonb_typeof(local_delivery_pricing_bands) = 'array');
