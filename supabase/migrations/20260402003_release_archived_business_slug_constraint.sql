alter table if exists public.businesses
  drop constraint if exists businesses_slug_key;

drop index if exists public.businesses_slug_key;
drop index if exists public.businesses_slug_unique_idx;

create unique index if not exists businesses_active_slug_unique_idx
  on public.businesses (slug)
  where is_active = true;
