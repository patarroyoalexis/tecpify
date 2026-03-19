create table if not exists public.businesses (
  id uuid primary key,
  slug text not null,
  name text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.businesses
  add column if not exists name text;

alter table public.businesses
  add column if not exists created_at timestamptz not null default timezone('utc', now());

alter table public.businesses
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

update public.businesses
set name = initcap(replace(slug, '-', ' '))
where name is null or btrim(name) = '';

alter table public.businesses
  alter column name set not null;

create unique index if not exists businesses_slug_unique_idx on public.businesses (slug);
