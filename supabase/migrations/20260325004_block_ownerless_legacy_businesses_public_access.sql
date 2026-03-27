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
        and businesses.created_by_user_id is not null
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
        and businesses.created_by_user_id is not null
    )
  );
