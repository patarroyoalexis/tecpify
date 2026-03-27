drop policy if exists "public can read businesses" on public.businesses;
drop policy if exists "authenticated can read owned businesses" on public.businesses;
create policy "authenticated can read owned businesses"
  on public.businesses
  for select
  to authenticated
  using (created_by_user_id = auth.uid());

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
        and businesses.created_by_user_id = auth.uid()
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
    )
  )
  with check (
    exists (
      select 1
      from public.businesses
      where businesses.id = products.business_id
        and businesses.created_by_user_id = auth.uid()
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
        and businesses.created_by_user_id = auth.uid()
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
    )
  )
  with check (
    exists (
      select 1
      from public.businesses
      where businesses.id = orders.business_id
        and businesses.created_by_user_id = auth.uid()
    )
  );
