create or replace function public.order_products_include_product(
  candidate_products jsonb,
  candidate_product_id uuid
)
returns boolean
language sql
immutable
as $$
  select exists (
    select 1
    from jsonb_array_elements(coalesce(candidate_products, '[]'::jsonb)) as order_product(value)
    where jsonb_typeof(order_product.value) = 'object'
      and coalesce(
        nullif(trim(order_product.value ->> 'productId'), ''),
        nullif(trim(order_product.value ->> 'product_id'), '')
      ) = candidate_product_id::text
  );
$$;

create or replace function public.count_orders_that_reference_product(
  candidate_business_id uuid,
  candidate_product_id uuid
)
returns bigint
language sql
stable
as $$
  select count(*)
  from public.orders
  where orders.business_id = candidate_business_id
    and public.order_products_include_product(orders.products, candidate_product_id);
$$;

create or replace function public.products_block_delete_when_referenced_by_orders()
returns trigger
language plpgsql
as $$
declare
  referenced_orders_count bigint;
begin
  referenced_orders_count := public.count_orders_that_reference_product(old.business_id, old.id);

  if referenced_orders_count > 0 then
    raise exception using
      errcode = '23514',
      message = format(
        'No puedes borrar "%s" porque ya aparece en %s pedido%s historico%s persistido%s. Desactivalo en lugar de borrarlo.',
        old.name,
        referenced_orders_count,
        case when referenced_orders_count = 1 then '' else 's' end,
        case when referenced_orders_count = 1 then '' else 's' end,
        case when referenced_orders_count = 1 then '' else 's' end
      );
  end if;

  return old;
end;
$$;

drop trigger if exists products_block_delete_when_referenced_by_orders on public.products;
create trigger products_block_delete_when_referenced_by_orders
  before delete on public.products
  for each row
  execute function public.products_block_delete_when_referenced_by_orders();
