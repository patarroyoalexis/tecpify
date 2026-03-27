alter table public.businesses
  add column if not exists created_by_user_id uuid references auth.users (id) on delete set null;

create index if not exists businesses_created_by_user_id_idx
  on public.businesses (created_by_user_id);
