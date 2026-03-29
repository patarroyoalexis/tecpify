alter table public.orders
  disable trigger orders_block_direct_history_before_update;

alter table public.orders
  disable trigger orders_enforce_authoritative_payment_before_update;

alter table public.orders
  drop constraint if exists orders_status_check,
  drop constraint if exists orders_payment_status_check;

update public.orders
set status = 'nuevo'
where status in ('pendiente de pago', 'pago por verificar');

alter table public.orders
  add constraint orders_status_check
  check (public.orders_status_is_valid(status)),
  add constraint orders_payment_status_check
  check (public.orders_payment_status_is_valid(payment_status));

alter table public.orders
  enable trigger orders_enforce_authoritative_payment_before_update;

alter table public.orders
  enable trigger orders_block_direct_history_before_update;
