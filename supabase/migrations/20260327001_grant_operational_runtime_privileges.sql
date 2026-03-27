grant usage on schema public to anon, authenticated;

grant select on public.businesses to anon, authenticated;
grant insert on public.businesses to authenticated;

grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;

grant select on public.orders to authenticated;
grant insert on public.orders to anon, authenticated;
grant update on public.orders to authenticated;
