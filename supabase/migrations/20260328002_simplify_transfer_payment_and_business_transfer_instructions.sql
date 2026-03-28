alter table public.businesses
  add column if not exists transfer_instructions text;

grant update on public.businesses to authenticated;

drop policy if exists "authenticated can update owned businesses" on public.businesses;
create policy "authenticated can update owned businesses"
  on public.businesses
  for update
  to authenticated
  using (created_by_user_id = auth.uid())
  with check (created_by_user_id = auth.uid());

update public.orders
set payment_method = 'Transferencia'
where payment_method in ('Nequi', 'Daviplata', 'Bre-B');

update public.orders
set history = replace(
  replace(
    replace(history::text, 'Nequi', 'Transferencia'),
    'Daviplata',
    'Transferencia'
  ),
  'Bre-B',
  'Transferencia'
)::jsonb
where history::text like '%Nequi%'
  or history::text like '%Daviplata%'
  or history::text like '%Bre-B%';

create or replace function public.orders_payment_method_is_valid(candidate_payment_method text)
returns boolean
language sql
immutable
as $$
  select candidate_payment_method in (
    'Efectivo',
    'Transferencia',
    'Tarjeta',
    'Contra entrega'
  );
$$;

create or replace function public.orders_delivery_type_is_valid(candidate_delivery_type text)
returns boolean
language sql
immutable
as $$
  select candidate_delivery_type in ('domicilio', 'recogida en tienda');
$$;

create or replace function public.orders_payment_status_is_valid(candidate_payment_status text)
returns boolean
language sql
immutable
as $$
  select candidate_payment_status in (
    'pendiente',
    'verificado',
    'con novedad',
    'no verificado'
  );
$$;

create or replace function public.orders_status_is_valid(candidate_status text)
returns boolean
language sql
immutable
as $$
  select candidate_status in (
    'pendiente de pago',
    'pago por verificar',
    'confirmado',
    'en preparaciÃ³n',
    'listo',
    'entregado',
    'cancelado'
  );
$$;

create or replace function public.orders_payment_method_is_cash(candidate_payment_method text)
returns boolean
language sql
immutable
as $$
  select candidate_payment_method in ('Efectivo', 'Contra entrega');
$$;

create or replace function public.orders_insert_request_is_valid(
  candidate_delivery_type text,
  candidate_payment_method text
)
returns boolean
language sql
immutable
as $$
  select
    public.orders_delivery_type_is_valid(candidate_delivery_type)
    and public.orders_payment_method_is_valid(candidate_payment_method)
    and (
      candidate_payment_method <> 'Contra entrega'
      or candidate_delivery_type = 'domicilio'
    );
$$;

create or replace function public.orders_payment_write_is_valid(
  candidate_delivery_type text,
  candidate_payment_method text,
  candidate_payment_status text,
  candidate_status text
)
returns boolean
language sql
immutable
as $$
  select
    public.orders_delivery_type_is_valid(candidate_delivery_type)
    and public.orders_payment_method_is_valid(candidate_payment_method)
    and public.orders_payment_status_is_valid(candidate_payment_status)
    and public.orders_status_is_valid(candidate_status)
    and (
      candidate_payment_method <> 'Contra entrega'
      or candidate_delivery_type = 'domicilio'
    )
    and case
      when candidate_payment_method in ('Efectivo', 'Contra entrega') then
        candidate_payment_status = 'verificado'
        and candidate_status not in ('pendiente de pago', 'pago por verificar')
      when candidate_status = 'pago por verificar' then
        candidate_payment_status = 'verificado'
      when candidate_status in ('confirmado', 'en preparaciÃ³n', 'listo', 'entregado') then
        candidate_payment_status = 'verificado'
      when candidate_status = 'pendiente de pago' then
        candidate_payment_status <> 'verificado'
      else
        true
    end;
$$;

create or replace function public.orders_enforce_authoritative_payment_insert()
returns trigger
language plpgsql
as $$
begin
  if not public.orders_delivery_type_is_valid(new.delivery_type) then
    raise exception using
      errcode = '23514',
      message = 'Invalid order payload. deliveryType no es valido para public.orders.';
  end if;

  if not public.orders_payment_method_is_valid(new.payment_method) then
    raise exception using
      errcode = '23514',
      message = 'Invalid order payload. paymentMethod no es valido para public.orders.';
  end if;

  if new.payment_method = 'Contra entrega' and new.delivery_type <> 'domicilio' then
    raise exception using
      errcode = '23514',
      message = 'Invalid order payload. Contra entrega solo se permite en pedidos a domicilio.';
  end if;

  if public.orders_payment_method_is_cash(new.payment_method) then
    new.payment_status := 'verificado';
    new.status := 'confirmado';
  else
    new.payment_status := 'pendiente';
    new.status := 'pendiente de pago';
  end if;

  if not public.orders_payment_write_is_valid(
    new.delivery_type,
    new.payment_method,
    new.payment_status,
    new.status
  ) then
    raise exception using
      errcode = '23514',
      message = 'Invalid order payload. La combinacion de estado del pedido y pago no es valida.';
  end if;

  return new;
end;
$$;

create or replace function public.orders_enforce_authoritative_payment_update()
returns trigger
language plpgsql
as $$
declare
  next_delivery_type text := old.delivery_type;
  next_payment_method text := old.payment_method;
  next_payment_status text := old.payment_status;
  next_status text := old.status;
  requested_payment_status boolean := false;
  requested_status boolean := false;
  order_status_sequence text[] := array[
    'pendiente de pago',
    'pago por verificar',
    'confirmado',
    'en preparaciÃ³n',
    'listo',
    'entregado'
  ];
  current_index integer;
  next_index integer;
begin
  if new.delivery_type is distinct from old.delivery_type then
    next_delivery_type := new.delivery_type;
  end if;

  if new.payment_method is distinct from old.payment_method then
    next_payment_method := new.payment_method;
  end if;

  if new.payment_status is distinct from old.payment_status then
    requested_payment_status := true;
    next_payment_status := new.payment_status;
  end if;

  if new.status is distinct from old.status then
    requested_status := true;
    next_status := new.status;
  end if;

  if not public.orders_delivery_type_is_valid(next_delivery_type) then
    raise exception using
      errcode = '23514',
      message = 'Invalid order update payload. deliveryType no es valido para public.orders.';
  end if;

  if not public.orders_payment_method_is_valid(next_payment_method) then
    raise exception using
      errcode = '23514',
      message = 'Invalid order update payload. paymentMethod no es valido para public.orders.';
  end if;

  if next_payment_method = 'Contra entrega' and next_delivery_type <> 'domicilio' then
    raise exception using
      errcode = '23514',
      message = 'Invalid order update payload. Contra entrega solo se permite en pedidos a domicilio.';
  end if;

  if public.orders_payment_method_is_cash(next_payment_method) then
    if requested_payment_status and next_payment_status <> 'verificado' then
      raise exception using
        errcode = '23514',
        message = 'Invalid order update payload. Los pagos en efectivo o contra entrega solo pueden persistirse como verificados.';
    end if;

    next_payment_status := 'verificado';
  end if;

  if not public.orders_payment_status_is_valid(next_payment_status) then
    raise exception using
      errcode = '23514',
      message = 'Invalid order update payload. paymentStatus no es valido para public.orders.';
  end if;

  if not requested_status then
    if old.status = 'pendiente de pago' and next_payment_status = 'verificado' then
      if public.orders_payment_method_is_cash(next_payment_method) then
        next_status := 'confirmado';
      else
        next_status := 'pago por verificar';
      end if;
    elsif old.status = 'pago por verificar' and next_payment_status <> 'verificado' then
      next_status := 'pendiente de pago';
    end if;
  end if;

  if not public.orders_status_is_valid(next_status) then
    raise exception using
      errcode = '23514',
      message = 'Invalid order update payload. status no es valido para public.orders.';
  end if;

  if not public.orders_payment_write_is_valid(
    next_delivery_type,
    next_payment_method,
    next_payment_status,
    next_status
  ) then
    if next_payment_method in ('Efectivo', 'Contra entrega') then
      raise exception using
        errcode = '23514',
        message = 'Invalid order update payload. Los pagos en efectivo o contra entrega solo pueden persistirse como verificados.';
    elsif next_status = 'pago por verificar' and next_payment_status <> 'verificado' then
      raise exception using
        errcode = '23514',
        message = 'Invalid order update payload. Solo un pago verificado puede quedar en pago por verificar.';
    elsif next_status in ('confirmado', 'en preparaciÃ³n', 'listo', 'entregado')
      and next_payment_status <> 'verificado' then
      raise exception using
        errcode = '23514',
        message = 'Invalid order update payload. No puedes avanzar el pedido mientras el pago no este verificado.';
    elsif next_status = 'pendiente de pago' and next_payment_status = 'verificado' then
      raise exception using
        errcode = '23514',
        message = 'Invalid order update payload. Un pago verificado no puede quedar en pendiente de pago.';
    else
      raise exception using
        errcode = '23514',
        message = 'Invalid order update payload. La combinacion de estado del pedido y pago no es valida.';
    end if;
  end if;

  if next_status <> old.status then
    if old.status in ('entregado', 'cancelado') then
      raise exception using
        errcode = '23514',
        message = 'Invalid order update payload. Este pedido ya termino su flujo y no puede seguir avanzando desde aqui.';
    elsif not (
      next_status = 'cancelado'
      or (
        old.status = 'pendiente de pago'
        and next_status = 'confirmado'
        and public.orders_payment_method_is_cash(next_payment_method)
        and next_payment_status = 'verificado'
      )
      or (
        old.status = 'pago por verificar'
        and next_status = 'pendiente de pago'
        and next_payment_status in ('pendiente', 'con novedad', 'no verificado')
      )
    ) then
      current_index := array_position(order_status_sequence, old.status);
      next_index := array_position(order_status_sequence, next_status);

      if current_index is null or next_index is null or next_index <> current_index + 1 then
        raise exception using
          errcode = '23514',
          message = 'Invalid order update payload. Solo puedes mover el pedido al siguiente paso permitido del flujo.';
      end if;
    end if;
  end if;

  new.delivery_type := next_delivery_type;
  new.payment_method := next_payment_method;
  new.payment_status := next_payment_status;
  new.status := next_status;

  return new;
end;
$$;

drop trigger if exists orders_enforce_authoritative_payment_before_insert on public.orders;
create trigger orders_enforce_authoritative_payment_before_insert
  before insert on public.orders
  for each row
  execute function public.orders_enforce_authoritative_payment_insert();

drop trigger if exists orders_enforce_authoritative_payment_before_update on public.orders;
create trigger orders_enforce_authoritative_payment_before_update
  before update on public.orders
  for each row
  execute function public.orders_enforce_authoritative_payment_update();

drop policy if exists "public can create orders" on public.orders;
create policy "public can create orders"
  on public.orders
  for insert
  to anon
  with check (
    exists (
      select 1
      from public.businesses
      where businesses.id = orders.business_id
        and businesses.created_by_user_id is not null
    )
    and public.orders_insert_request_is_valid(
      orders.delivery_type,
      orders.payment_method
    )
  );

drop policy if exists "authenticated can insert owned orders" on public.orders;
create policy "authenticated can insert owned orders"
  on public.orders
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.businesses
      where businesses.id = orders.business_id
        and businesses.created_by_user_id = auth.uid()
    )
    and public.orders_insert_request_is_valid(
      orders.delivery_type,
      orders.payment_method
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
    and public.orders_payment_write_is_valid(
      orders.delivery_type,
      orders.payment_method,
      orders.payment_status,
      orders.status
    )
  );
