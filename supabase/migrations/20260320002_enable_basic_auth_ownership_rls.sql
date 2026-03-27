alter table public.businesses
  enable row level security;

alter table public.products
  enable row level security;

alter table public.orders
  enable row level security;

drop policy if exists "public can read businesses" on public.businesses;
create policy "public can read businesses"
  on public.businesses
  for select
  using (true);

drop policy if exists "authenticated can create owned businesses" on public.businesses;
create policy "authenticated can create owned businesses"
  on public.businesses
  for insert
  to authenticated
  with check (created_by_user_id = auth.uid());

drop policy if exists "authenticated can read accessible products" on public.products;
create policy "authenticated can read accessible products"
  on public.products
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.businesses
      where businesses.id = products.business_id
        and (
          businesses.created_by_user_id = auth.uid()
          or businesses.created_by_user_id is null
        )
    )
  );

drop policy if exists "public can read active products" on public.products;
create policy "public can read active products"
  on public.products
  for select
  using (is_available = true);

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
        and (
          businesses.created_by_user_id = auth.uid()
          or businesses.created_by_user_id is null
        )
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
        and (
          businesses.created_by_user_id = auth.uid()
          or businesses.created_by_user_id is null
        )
    )
  )
  with check (
    exists (
      select 1
      from public.businesses
      where businesses.id = products.business_id
        and (
          businesses.created_by_user_id = auth.uid()
          or businesses.created_by_user_id is null
        )
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
        and (
          businesses.created_by_user_id = auth.uid()
          or businesses.created_by_user_id is null
        )
    )
  );

drop policy if exists "authenticated can read accessible orders" on public.orders;
create policy "authenticated can read accessible orders"
  on public.orders
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.businesses
      where businesses.id = orders.business_id
        and (
          businesses.created_by_user_id = auth.uid()
          or businesses.created_by_user_id is null
        )
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
        and (
          businesses.created_by_user_id = auth.uid()
          or businesses.created_by_user_id is null
        )
    )
  )
  with check (
    exists (
      select 1
      from public.businesses
      where businesses.id = orders.business_id
        and (
          businesses.created_by_user_id = auth.uid()
          or businesses.created_by_user_id is null
        )
    )
  );

drop policy if exists "public can create orders" on public.orders;
create policy "public can create orders"
  on public.orders
  for insert
  with check (
    exists (
      select 1
      from public.businesses
      where businesses.id = orders.business_id
    )
  );
