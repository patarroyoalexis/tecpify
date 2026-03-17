alter table public.orders
add column if not exists order_code text;

with numbered_orders as (
  select
    id,
    'WEB-' || lpad(row_number() over (order by inserted_at asc, created_at asc, id asc)::text, 6, '0') as generated_code
  from public.orders
  where order_code is null or btrim(order_code) = ''
)
update public.orders as orders
set order_code = numbered_orders.generated_code
from numbered_orders
where orders.id = numbered_orders.id;

alter table public.orders
alter column order_code set not null;

create unique index if not exists orders_order_code_key
on public.orders (order_code);
