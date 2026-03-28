alter table public.businesses
  add column if not exists transfer_instructions text,
  add column if not exists accepts_cash boolean not null default true,
  add column if not exists accepts_transfer boolean not null default true,
  add column if not exists accepts_card boolean not null default true,
  add column if not exists allows_fiado boolean not null default false;

alter table public.businesses
  alter column accepts_cash set default true,
  alter column accepts_transfer set default true,
  alter column accepts_card set default true,
  alter column allows_fiado set default false;

update public.businesses
set
  accepts_cash = coalesce(accepts_cash, true),
  accepts_transfer = coalesce(accepts_transfer, true),
  accepts_card = coalesce(accepts_card, true),
  allows_fiado = coalesce(allows_fiado, false);

alter table public.businesses
  alter column accepts_cash set not null,
  alter column accepts_transfer set not null,
  alter column accepts_card set not null,
  alter column allows_fiado set not null;

alter table public.businesses
  drop constraint if exists businesses_public_payment_method_required;

alter table public.businesses
  add constraint businesses_public_payment_method_required
  check (accepts_cash or accepts_transfer or accepts_card);

grant update on public.businesses to authenticated;

drop policy if exists "authenticated can update owned businesses" on public.businesses;
create policy "authenticated can update owned businesses"
  on public.businesses
  for update
  to authenticated
  using (created_by_user_id = auth.uid())
  with check (
    created_by_user_id = auth.uid()
    and (accepts_cash or accepts_transfer or accepts_card)
  );

alter table public.orders
  add column if not exists is_fiado boolean not null default false,
  add column if not exists fiado_status text,
  add column if not exists fiado_observation text;

update public.orders
set
  is_fiado = coalesce(is_fiado, false),
  fiado_status = case
    when coalesce(is_fiado, false) then fiado_status
    else null
  end,
  fiado_observation = case
    when coalesce(is_fiado, false) then nullif(trim(coalesce(fiado_observation, '')), '')
    else null
  end;

alter table public.orders
  alter column is_fiado set default false;

drop function if exists public.get_storefront_business_by_slug(text);

create function public.get_storefront_business_by_slug(requested_slug text)
returns table (
  id uuid,
  slug text,
  name text,
  transfer_instructions text,
  accepts_cash boolean,
  accepts_transfer boolean,
  accepts_card boolean,
  created_at timestamptz,
  updated_at timestamptz,
  created_by_user_id uuid
)
language sql
security definer
set search_path = public
as $$
  select
    businesses.id,
    businesses.slug,
    businesses.name,
    businesses.transfer_instructions,
    coalesce(businesses.accepts_cash, true) as accepts_cash,
    coalesce(businesses.accepts_transfer, true) as accepts_transfer,
    coalesce(businesses.accepts_card, true) as accepts_card,
    businesses.created_at,
    businesses.updated_at,
    businesses.created_by_user_id
  from public.businesses
  where businesses.slug = requested_slug
    and businesses.created_by_user_id is not null
  limit 1;
$$;

revoke all on function public.get_storefront_business_by_slug(text) from public;
grant execute on function public.get_storefront_business_by_slug(text) to anon;
grant execute on function public.get_storefront_business_by_slug(text) to authenticated;

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
    'en preparación',
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
      when candidate_status in ('confirmado', 'en preparación', 'listo', 'entregado') then
        candidate_payment_status = 'verificado'
      when candidate_status = 'pendiente de pago' then
        candidate_payment_status <> 'verificado'
      else
        true
    end;
$$;

create or replace function public.business_payment_method_is_enabled(
  candidate_business_id uuid,
  candidate_payment_method text
)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.businesses
    where businesses.id = candidate_business_id
      and case
        when candidate_payment_method in ('Efectivo', 'Contra entrega') then coalesce(businesses.accepts_cash, true)
        when candidate_payment_method = 'Transferencia' then coalesce(businesses.accepts_transfer, true)
        when candidate_payment_method = 'Tarjeta' then coalesce(businesses.accepts_card, true)
        else false
      end
  );
$$;

create or replace function public.business_allows_fiado(candidate_business_id uuid)
returns boolean
language sql
stable
as $$
  select coalesce(
    (
      select businesses.allows_fiado
      from public.businesses
      where businesses.id = candidate_business_id
    ),
    false
  );
$$;

create or replace function public.orders_fiado_status_is_valid(candidate_fiado_status text)
returns boolean
language sql
immutable
as $$
  select candidate_fiado_status in ('pending', 'paid');
$$;

create or replace function public.orders_fiado_write_is_valid(
  candidate_is_fiado boolean,
  candidate_fiado_status text,
  candidate_fiado_observation text
)
returns boolean
language sql
immutable
as $$
  select case
    when coalesce(candidate_is_fiado, false) = false then
      candidate_fiado_status is null
      and nullif(trim(coalesce(candidate_fiado_observation, '')), '') is null
    else
      public.orders_fiado_status_is_valid(candidate_fiado_status)
      and nullif(trim(coalesce(candidate_fiado_observation, '')), '') is not null
  end;
$$;

create or replace function public.orders_history_timestamp_text(candidate_occurred_at timestamptz)
returns text
language sql
immutable
as $$
  select to_char(
    candidate_occurred_at at time zone 'UTC',
    'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
  );
$$;

create or replace function public.orders_history_event_is_valid(candidate_event jsonb)
returns boolean
language sql
immutable
as $$
  select
    jsonb_typeof(candidate_event) = 'object'
    and jsonb_typeof(candidate_event -> 'id') = 'string'
    and jsonb_typeof(candidate_event -> 'title') = 'string'
    and jsonb_typeof(candidate_event -> 'description') = 'string'
    and jsonb_typeof(candidate_event -> 'occurredAt') = 'string'
    and (
      not (candidate_event ? 'field')
      or jsonb_typeof(candidate_event -> 'field') = 'string'
    )
    and (
      not (candidate_event ? 'previousValue')
      or jsonb_typeof(candidate_event -> 'previousValue') = 'string'
    )
    and (
      not (candidate_event ? 'newValue')
      or jsonb_typeof(candidate_event -> 'newValue') = 'string'
    );
$$;

create or replace function public.orders_history_is_valid(candidate_history jsonb)
returns boolean
language sql
immutable
as $$
  select
    jsonb_typeof(coalesce(candidate_history, '[]'::jsonb)) = 'array'
    and not exists (
      select 1
      from jsonb_array_elements(coalesce(candidate_history, '[]'::jsonb)) as history_event(value)
      where not public.orders_history_event_is_valid(history_event.value)
    );
$$;

create or replace function public.orders_history_event_payload(
  candidate_id text,
  candidate_title text,
  candidate_description text,
  candidate_occurred_at timestamptz,
  candidate_field text default null,
  candidate_previous_value text default null,
  candidate_new_value text default null
)
returns jsonb
language sql
immutable
as $$
  select jsonb_strip_nulls(
    jsonb_build_object(
      'id', candidate_id,
      'title', candidate_title,
      'description', candidate_description,
      'occurredAt', public.orders_history_timestamp_text(candidate_occurred_at),
      'field', candidate_field,
      'previousValue', candidate_previous_value,
      'newValue', candidate_new_value
    )
  );
$$;

create or replace function public.orders_prepend_history_event(
  existing_history jsonb,
  next_event jsonb
)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_array(next_event) || coalesce(existing_history, '[]'::jsonb);
$$;

create or replace function public.orders_history_value_text(
  candidate_field text,
  candidate_value jsonb
)
returns text
language sql
immutable
as $$
  select case
    when candidate_value is null or candidate_value = 'null'::jsonb then 'Sin dato'
    when candidate_field in (
      'customerName',
      'customerWhatsApp',
      'deliveryAddress',
      'paymentMethod',
      'status',
      'paymentStatus',
      'deliveryType',
      'notes',
      'fiadoObservation'
    ) then
      nullif(trim(both '"' from candidate_value::text), '')
    when candidate_field = 'isFiado' then
      case
        when candidate_value = 'true'::jsonb then 'Si'
        else 'No'
      end
    when candidate_field = 'fiadoStatus' then
      case trim(both '"' from candidate_value::text)
        when 'pending' then 'Pendiente'
        when 'paid' then 'Pagado'
        else 'No aplica'
      end
    when candidate_field = 'total' then
      trim(both '"' from candidate_value::text)
    else
      candidate_value::text
  end;
$$;

create or replace function public.orders_history_event_intent_is_valid(candidate_event_intent text)
returns boolean
language sql
immutable
as $$
  select candidate_event_intent in (
    'mark_reviewed_from_operation',
    'mark_reviewed_from_new_orders',
    'request_payment_proof_whatsapp'
  );
$$;

create or replace function public.orders_resolve_insert_origin()
returns text
language sql
stable
as $$
  select case
    when auth.role() = 'authenticated' then 'workspace_manual'
    else 'public_form'
  end;
$$;

create or replace function public.orders_business_slug(candidate_business_id uuid)
returns text
language sql
stable
as $$
  select businesses.slug
  from public.businesses
  where businesses.id = candidate_business_id;
$$;

create or replace function public.orders_build_initial_history(
  candidate_order_id uuid,
  candidate_business_id uuid,
  candidate_created_at timestamptz,
  candidate_origin text
)
returns jsonb
language plpgsql
stable
as $$
declare
  current_business_slug text := public.orders_business_slug(candidate_business_id);
begin
  if current_business_slug is null then
    raise exception using
      errcode = '23503',
      message = 'Invalid order payload. business_id no corresponde a un negocio real.';
  end if;

  if candidate_origin = 'workspace_manual' then
    return jsonb_build_array(
      public.orders_history_event_payload(
        current_business_slug || '-' || public.orders_history_timestamp_text(candidate_created_at) || '-workspace-manual-created',
        'Pedido creado manualmente',
        'El equipo del negocio registro el pedido manualmente desde el workspace privado.',
        candidate_created_at
      ),
      public.orders_history_event_payload(
        candidate_order_id::text || '-created',
        'Pedido registrado',
        'El pedido manual quedo persistido en la base principal del MVP.',
        candidate_created_at
      )
    );
  end if;

  return jsonb_build_array(
    public.orders_history_event_payload(
      current_business_slug || '-' || public.orders_history_timestamp_text(candidate_created_at) || '-public-form-created',
      'Pedido creado desde formulario publico',
      'El cliente confirmo el pedido desde el formulario publico compartido del negocio.',
      candidate_created_at
    ),
    public.orders_history_event_payload(
      candidate_order_id::text || '-created',
      'Pedido registrado',
      'El pedido publico quedo persistido en la base principal del MVP.',
      candidate_created_at
    )
  );
end;
$$;

create or replace function public.orders_tracked_fields_changed(
  previous_order public.orders,
  next_order public.orders
)
returns boolean
language sql
stable
as $$
  select
    previous_order.customer_name is distinct from next_order.customer_name
    or previous_order.customer_whatsapp is distinct from next_order.customer_whatsapp
    or previous_order.delivery_type is distinct from next_order.delivery_type
    or previous_order.delivery_address is distinct from next_order.delivery_address
    or previous_order.payment_method is distinct from next_order.payment_method
    or previous_order.payment_status is distinct from next_order.payment_status
    or previous_order.status is distinct from next_order.status
    or previous_order.products is distinct from next_order.products
    or previous_order.notes is distinct from next_order.notes
    or previous_order.total is distinct from next_order.total
    or previous_order.is_reviewed is distinct from next_order.is_reviewed
    or previous_order.is_fiado is distinct from next_order.is_fiado
    or previous_order.fiado_status is distinct from next_order.fiado_status
    or previous_order.fiado_observation is distinct from next_order.fiado_observation;
$$;

create or replace function public.orders_enforce_server_generated_history_insert()
returns trigger
language plpgsql
as $$
begin
  if new.history is not null and new.history <> '[]'::jsonb then
    raise exception using
      errcode = '23514',
      message = 'Invalid order payload. history es server-generated y no acepta eventos iniciales enviados por cliente.';
  end if;

  new.history := public.orders_build_initial_history(
    new.id,
    new.business_id,
    coalesce(new.created_at, now()),
    public.orders_resolve_insert_origin()
  );

  if not public.orders_history_is_valid(new.history) then
    raise exception using
      errcode = '23514',
      message = 'Invalid order payload. El historial inicial persistido en DB no es valido.';
  end if;

  return new;
end;
$$;

create or replace function public.orders_block_direct_history_update()
returns trigger
language plpgsql
as $$
declare
  allow_history_write text := coalesce(
    current_setting('tecpify.allow_order_history_write', true),
    ''
  );
begin
  if allow_history_write <> 'on' then
    if new.history is distinct from old.history then
      raise exception using
        errcode = '23514',
        message = 'Invalid order update payload. history es append-only y solo puede mutarse desde public.update_order_with_server_history.';
    end if;

    if public.orders_tracked_fields_changed(old, new) then
      raise exception using
        errcode = '23514',
        message = 'Invalid order update payload. Los campos trazables del pedido solo pueden mutarse desde public.update_order_with_server_history.';
    end if;
  end if;

  if not public.orders_history_is_valid(coalesce(new.history, '[]'::jsonb)) then
    raise exception using
      errcode = '23514',
      message = 'Invalid order update payload. history debe conservar el contrato estructural de eventos.';
  end if;

  return new;
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

  if not public.business_payment_method_is_enabled(new.business_id, new.payment_method) then
    raise exception using
      errcode = '23514',
      message = 'Invalid order payload. Este negocio no tiene habilitado el metodo de pago "' || new.payment_method || '".';
  end if;

  if new.payment_method = 'Contra entrega' and new.delivery_type <> 'domicilio' then
    raise exception using
      errcode = '23514',
      message = 'Invalid order payload. Contra entrega solo se permite en pedidos a domicilio.';
  end if;

  if coalesce(new.is_fiado, false)
    or new.fiado_status is not null
    or nullif(trim(coalesce(new.fiado_observation, '')), '') is not null then
    raise exception using
      errcode = '23514',
      message = 'Invalid order payload. El fiado interno solo puede activarse sobre pedidos existentes desde la operacion privada.';
  end if;

  new.is_fiado := false;
  new.fiado_status := null;
  new.fiado_observation := null;

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
  next_is_fiado boolean := coalesce(old.is_fiado, false);
  next_fiado_status text := old.fiado_status;
  next_fiado_observation text := old.fiado_observation;
  requested_payment_status boolean := false;
  requested_status boolean := false;
  order_status_sequence text[] := array[
    'pendiente de pago',
    'pago por verificar',
    'confirmado',
    'en preparación',
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

  if new.is_fiado is distinct from old.is_fiado then
    next_is_fiado := coalesce(new.is_fiado, false);
  end if;

  if new.fiado_status is distinct from old.fiado_status then
    next_fiado_status := new.fiado_status;
  end if;

  if new.fiado_observation is distinct from old.fiado_observation then
    next_fiado_observation := nullif(trim(coalesce(new.fiado_observation, '')), '');
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

  if not public.business_payment_method_is_enabled(new.business_id, next_payment_method) then
    raise exception using
      errcode = '23514',
      message = 'Invalid order update payload. Este negocio no tiene habilitado el metodo de pago "' || next_payment_method || '".';
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
    elsif next_status in ('confirmado', 'en preparación', 'listo', 'entregado')
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

  if not public.orders_fiado_write_is_valid(
    next_is_fiado,
    next_fiado_status,
    next_fiado_observation
  ) then
    if not next_is_fiado then
      raise exception using
        errcode = '23514',
        message = 'Invalid order update payload. Cuando el pedido no esta marcado como fiado, fiadoStatus y fiadoObservation deben quedar en null.';
    elsif not public.orders_fiado_status_is_valid(next_fiado_status) then
      raise exception using
        errcode = '23514',
        message = 'Invalid order update payload. Los pedidos fiados deben tener fiadoStatus en pending o paid.';
    else
      raise exception using
        errcode = '23514',
        message = 'Invalid order update payload. La observacion de fiado es obligatoria.';
    end if;
  end if;

  if not coalesce(old.is_fiado, false) and next_is_fiado and not public.business_allows_fiado(new.business_id) then
    raise exception using
      errcode = '23514',
      message = 'Invalid order update payload. Este negocio no tiene habilitado el fiado interno.';
  end if;

  if coalesce(old.is_fiado, false) and not next_is_fiado then
    raise exception using
      errcode = '23514',
      message = 'Invalid order update payload. Un pedido fiado no puede desmarcarse; debes marcarlo como pagado.';
  end if;

  if not coalesce(old.is_fiado, false) and next_is_fiado and next_fiado_status <> 'pending' then
    raise exception using
      errcode = '23514',
      message = 'Invalid order update payload. Un fiado nuevo solo puede activarse con fiadoStatus pending.';
  end if;

  if coalesce(old.is_fiado, false) and old.fiado_status = 'pending'
    and next_fiado_status not in ('pending', 'paid') then
    raise exception using
      errcode = '23514',
      message = 'Invalid order update payload. Un fiado pendiente solo puede mantenerse pendiente o marcarse como paid.';
  end if;

  if coalesce(old.is_fiado, false) and old.fiado_status = 'paid' and next_fiado_status <> 'paid' then
    raise exception using
      errcode = '23514',
      message = 'Invalid order update payload. Un fiado pagado no puede volver a estado pendiente ni desactivarse.';
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
  new.is_fiado := next_is_fiado;
  new.fiado_status := next_fiado_status;
  new.fiado_observation := next_fiado_observation;

  return new;
end;
$$;

create or replace function public.update_order_with_server_history(
  target_order_id uuid,
  patch jsonb
)
returns public.orders
language plpgsql
security invoker
as $$
declare
  current_order public.orders%rowtype;
  updated_order public.orders%rowtype;
  next_customer_name text;
  next_customer_whatsapp text;
  next_delivery_type text;
  next_delivery_address text;
  next_payment_method text;
  next_payment_status text;
  next_status text;
  next_products jsonb;
  next_notes text;
  next_total numeric;
  next_is_reviewed boolean;
  next_is_fiado boolean;
  next_fiado_status text;
  next_fiado_observation text;
  next_history jsonb;
  next_event_intent text;
  occurred_at timestamptz := now();
  invalid_patch_keys text[];
begin
  if patch is null or jsonb_typeof(patch) <> 'object' then
    raise exception using
      errcode = '23514',
      message = 'Invalid order update payload. El patch debe ser un objeto JSON valido.';
  end if;

  select array_agg(patch_key.key order by patch_key.key)
  into invalid_patch_keys
  from jsonb_object_keys(patch) as patch_key(key)
  where patch_key.key not in (
    'status',
    'paymentStatus',
    'payment_status',
    'customerName',
    'customerWhatsApp',
    'deliveryType',
    'deliveryAddress',
    'paymentMethod',
    'products',
    'notes',
    'total',
    'isReviewed',
    'isFiado',
    'fiadoStatus',
    'fiadoObservation',
    'eventIntent'
  );

  if invalid_patch_keys is not null then
    raise exception using
      errcode = '23514',
      message = 'Invalid order update payload. El patch contiene campos no permitidos: ' || array_to_string(invalid_patch_keys, ', ') || '.';
  end if;

  select *
  into current_order
  from public.orders
  where id = target_order_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Order not found for id "' || target_order_id::text || '".';
  end if;

  next_customer_name := current_order.customer_name;
  next_customer_whatsapp := current_order.customer_whatsapp;
  next_delivery_type := current_order.delivery_type;
  next_delivery_address := current_order.delivery_address;
  next_payment_method := current_order.payment_method;
  next_payment_status := current_order.payment_status;
  next_status := current_order.status;
  next_products := current_order.products;
  next_notes := current_order.notes;
  next_total := current_order.total;
  next_is_reviewed := current_order.is_reviewed;
  next_is_fiado := coalesce(current_order.is_fiado, false);
  next_fiado_status := current_order.fiado_status;
  next_fiado_observation := current_order.fiado_observation;
  next_event_intent := null;

  if patch ? 'customerName' then
    next_customer_name := nullif(trim(patch ->> 'customerName'), '');
  end if;

  if patch ? 'customerWhatsApp' then
    next_customer_whatsapp := nullif(trim(patch ->> 'customerWhatsApp'), '');
  end if;

  if patch ? 'deliveryType' then
    next_delivery_type := nullif(trim(patch ->> 'deliveryType'), '');
  end if;

  if patch ? 'deliveryAddress' then
    next_delivery_address := nullif(trim(patch ->> 'deliveryAddress'), '');
  end if;

  if patch ? 'paymentMethod' then
    next_payment_method := nullif(trim(patch ->> 'paymentMethod'), '');
  end if;

  if patch ? 'paymentStatus' then
    next_payment_status := nullif(trim(patch ->> 'paymentStatus'), '');
  elsif patch ? 'payment_status' then
    next_payment_status := nullif(trim(patch ->> 'payment_status'), '');
  end if;

  if patch ? 'status' then
    next_status := nullif(trim(patch ->> 'status'), '');
  end if;

  if patch ? 'products' then
    if jsonb_typeof(patch -> 'products') <> 'array' then
      raise exception using
        errcode = '23514',
        message = 'Invalid order update payload. products debe ser un arreglo JSON valido.';
    end if;

    next_products := patch -> 'products';
  end if;

  if patch ? 'notes' then
    next_notes := nullif(trim(patch ->> 'notes'), '');
  end if;

  if patch ? 'total' then
    next_total := (patch ->> 'total')::numeric;
  end if;

  if patch ? 'isReviewed' then
    if jsonb_typeof(patch -> 'isReviewed') <> 'boolean' then
      raise exception using
        errcode = '23514',
        message = 'Invalid order update payload. isReviewed debe ser booleano.';
    end if;

    next_is_reviewed := (patch ->> 'isReviewed')::boolean;
  end if;

  if patch ? 'isFiado' then
    if jsonb_typeof(patch -> 'isFiado') <> 'boolean' then
      raise exception using
        errcode = '23514',
        message = 'Invalid order update payload. isFiado debe ser booleano.';
    end if;

    next_is_fiado := (patch ->> 'isFiado')::boolean;
  end if;

  if patch ? 'fiadoStatus' then
    if jsonb_typeof(patch -> 'fiadoStatus') not in ('string', 'null') then
      raise exception using
        errcode = '23514',
        message = 'Invalid order update payload. fiadoStatus debe ser "pending", "paid" o null.';
    end if;

    next_fiado_status := nullif(trim(patch ->> 'fiadoStatus'), '');
  end if;

  if patch ? 'fiadoObservation' then
    if jsonb_typeof(patch -> 'fiadoObservation') not in ('string', 'null') then
      raise exception using
        errcode = '23514',
        message = 'Invalid order update payload. fiadoObservation debe ser texto o null.';
    end if;

    next_fiado_observation := nullif(trim(patch ->> 'fiadoObservation'), '');
  end if;

  if patch ? 'eventIntent' then
    next_event_intent := nullif(trim(patch ->> 'eventIntent'), '');

    if next_event_intent is not null
      and not public.orders_history_event_intent_is_valid(next_event_intent) then
      raise exception using
        errcode = '23514',
        message = 'Invalid order update payload. eventIntent no es valido para public.orders.';
    end if;
  end if;

  if next_payment_method in ('Efectivo', 'Contra entrega') then
    next_payment_status := 'verificado';
  end if;

  if not (patch ? 'status') then
    if current_order.status = 'pendiente de pago' and next_payment_status = 'verificado' then
      if next_payment_method in ('Efectivo', 'Contra entrega') then
        next_status := 'confirmado';
      else
        next_status := 'pago por verificar';
      end if;
    elsif current_order.status = 'pago por verificar'
      and next_payment_status in ('pendiente', 'con novedad', 'no verificado') then
      next_status := 'pendiente de pago';
    end if;
  end if;

  next_history := coalesce(current_order.history, '[]'::jsonb);

  if current_order.customer_name is distinct from next_customer_name then
    next_history := public.orders_prepend_history_event(
      next_history,
      public.orders_history_event_payload(
        target_order_id::text || '-' || public.orders_history_timestamp_text(occurred_at) || '-customer-name',
        'Dato principal del pedido actualizado',
        'Nombre del cliente: "' ||
          public.orders_history_value_text('customerName', to_jsonb(current_order.customer_name)) ||
          '" -> "' ||
          public.orders_history_value_text('customerName', to_jsonb(next_customer_name)) ||
          '"',
        occurred_at,
        'customerName',
        public.orders_history_value_text('customerName', to_jsonb(current_order.customer_name)),
        public.orders_history_value_text('customerName', to_jsonb(next_customer_name))
      )
    );
  end if;

  if current_order.customer_whatsapp is distinct from next_customer_whatsapp then
    next_history := public.orders_prepend_history_event(
      next_history,
      public.orders_history_event_payload(
        target_order_id::text || '-' || public.orders_history_timestamp_text(occurred_at) || '-customer-whatsapp',
        'Dato principal del pedido actualizado',
        'WhatsApp del cliente: "' ||
          public.orders_history_value_text('customerWhatsApp', to_jsonb(current_order.customer_whatsapp)) ||
          '" -> "' ||
          public.orders_history_value_text('customerWhatsApp', to_jsonb(next_customer_whatsapp)) ||
          '"',
        occurred_at,
        'customerWhatsApp',
        public.orders_history_value_text('customerWhatsApp', to_jsonb(current_order.customer_whatsapp)),
        public.orders_history_value_text('customerWhatsApp', to_jsonb(next_customer_whatsapp))
      )
    );
  end if;

  if current_order.delivery_type is distinct from next_delivery_type then
    next_history := public.orders_prepend_history_event(
      next_history,
      public.orders_history_event_payload(
        target_order_id::text || '-' || public.orders_history_timestamp_text(occurred_at) || '-delivery-type',
        'Dato principal del pedido actualizado',
        'Tipo de entrega: "' ||
          public.orders_history_value_text('deliveryType', to_jsonb(current_order.delivery_type)) ||
          '" -> "' ||
          public.orders_history_value_text('deliveryType', to_jsonb(next_delivery_type)) ||
          '"',
        occurred_at,
        'deliveryType',
        public.orders_history_value_text('deliveryType', to_jsonb(current_order.delivery_type)),
        public.orders_history_value_text('deliveryType', to_jsonb(next_delivery_type))
      )
    );
  end if;

  if current_order.delivery_address is distinct from next_delivery_address then
    next_history := public.orders_prepend_history_event(
      next_history,
      public.orders_history_event_payload(
        target_order_id::text || '-' || public.orders_history_timestamp_text(occurred_at) || '-delivery-address',
        'Dato principal del pedido actualizado',
        'Direccion de entrega: "' ||
          public.orders_history_value_text('deliveryAddress', to_jsonb(current_order.delivery_address)) ||
          '" -> "' ||
          public.orders_history_value_text('deliveryAddress', to_jsonb(next_delivery_address)) ||
          '"',
        occurred_at,
        'deliveryAddress',
        public.orders_history_value_text('deliveryAddress', to_jsonb(current_order.delivery_address)),
        public.orders_history_value_text('deliveryAddress', to_jsonb(next_delivery_address))
      )
    );
  end if;

  if current_order.payment_method is distinct from next_payment_method then
    next_history := public.orders_prepend_history_event(
      next_history,
      public.orders_history_event_payload(
        target_order_id::text || '-' || public.orders_history_timestamp_text(occurred_at) || '-payment-method',
        'Dato principal del pedido actualizado',
        'Metodo de pago: "' ||
          public.orders_history_value_text('paymentMethod', to_jsonb(current_order.payment_method)) ||
          '" -> "' ||
          public.orders_history_value_text('paymentMethod', to_jsonb(next_payment_method)) ||
          '"',
        occurred_at,
        'paymentMethod',
        public.orders_history_value_text('paymentMethod', to_jsonb(current_order.payment_method)),
        public.orders_history_value_text('paymentMethod', to_jsonb(next_payment_method))
      )
    );
  end if;

  if current_order.payment_status is distinct from next_payment_status then
    next_history := public.orders_prepend_history_event(
      next_history,
      public.orders_history_event_payload(
        target_order_id::text || '-' || public.orders_history_timestamp_text(occurred_at) || '-payment-status',
        'Estado del pago actualizado',
        'Estado del pago: "' ||
          public.orders_history_value_text('paymentStatus', to_jsonb(current_order.payment_status)) ||
          '" -> "' ||
          public.orders_history_value_text('paymentStatus', to_jsonb(next_payment_status)) ||
          '"',
        occurred_at,
        'paymentStatus',
        public.orders_history_value_text('paymentStatus', to_jsonb(current_order.payment_status)),
        public.orders_history_value_text('paymentStatus', to_jsonb(next_payment_status))
      )
    );
  end if;

  if current_order.status is distinct from next_status then
    next_history := public.orders_prepend_history_event(
      next_history,
      public.orders_history_event_payload(
        target_order_id::text || '-' || public.orders_history_timestamp_text(occurred_at) || '-status',
        'Estado del pedido actualizado',
        'Estado del pedido: "' ||
          public.orders_history_value_text('status', to_jsonb(current_order.status)) ||
          '" -> "' ||
          public.orders_history_value_text('status', to_jsonb(next_status)) ||
          '"',
        occurred_at,
        'status',
        public.orders_history_value_text('status', to_jsonb(current_order.status)),
        public.orders_history_value_text('status', to_jsonb(next_status))
      )
    );
  end if;

  if current_order.products is distinct from next_products then
    next_history := public.orders_prepend_history_event(
      next_history,
      public.orders_history_event_payload(
        target_order_id::text || '-' || public.orders_history_timestamp_text(occurred_at) || '-products',
        'Dato principal del pedido actualizado',
        'Articulos: "' ||
          public.orders_history_value_text('products', current_order.products) ||
          '" -> "' ||
          public.orders_history_value_text('products', next_products) ||
          '"',
        occurred_at,
        'products',
        public.orders_history_value_text('products', current_order.products),
        public.orders_history_value_text('products', next_products)
      )
    );
  end if;

  if current_order.notes is distinct from next_notes then
    next_history := public.orders_prepend_history_event(
      next_history,
      public.orders_history_event_payload(
        target_order_id::text || '-' || public.orders_history_timestamp_text(occurred_at) || '-notes',
        'Dato principal del pedido actualizado',
        'Notas: "' ||
          public.orders_history_value_text('notes', to_jsonb(current_order.notes)) ||
          '" -> "' ||
          public.orders_history_value_text('notes', to_jsonb(next_notes)) ||
          '"',
        occurred_at,
        'notes',
        public.orders_history_value_text('notes', to_jsonb(current_order.notes)),
        public.orders_history_value_text('notes', to_jsonb(next_notes))
      )
    );
  end if;

  if current_order.total is distinct from next_total then
    next_history := public.orders_prepend_history_event(
      next_history,
      public.orders_history_event_payload(
        target_order_id::text || '-' || public.orders_history_timestamp_text(occurred_at) || '-total',
        'Dato principal del pedido actualizado',
        'Total: "' ||
          public.orders_history_value_text('total', to_jsonb(current_order.total)) ||
          '" -> "' ||
          public.orders_history_value_text('total', to_jsonb(next_total)) ||
          '"',
        occurred_at,
        'total',
        public.orders_history_value_text('total', to_jsonb(current_order.total)),
        public.orders_history_value_text('total', to_jsonb(next_total))
      )
    );
  end if;

  if coalesce(current_order.is_fiado, false) is distinct from next_is_fiado then
    next_history := public.orders_prepend_history_event(
      next_history,
      public.orders_history_event_payload(
        target_order_id::text || '-' || public.orders_history_timestamp_text(occurred_at) || '-is-fiado',
        'Estado interno de fiado actualizado',
        'Fiado: "' ||
          public.orders_history_value_text('isFiado', to_jsonb(coalesce(current_order.is_fiado, false))) ||
          '" -> "' ||
          public.orders_history_value_text('isFiado', to_jsonb(next_is_fiado)) ||
          '"',
        occurred_at,
        'isFiado',
        public.orders_history_value_text('isFiado', to_jsonb(coalesce(current_order.is_fiado, false))),
        public.orders_history_value_text('isFiado', to_jsonb(next_is_fiado))
      )
    );
  end if;

  if current_order.fiado_status is distinct from next_fiado_status then
    next_history := public.orders_prepend_history_event(
      next_history,
      public.orders_history_event_payload(
        target_order_id::text || '-' || public.orders_history_timestamp_text(occurred_at) || '-fiado-status',
        'Estado interno de fiado actualizado',
        'Estado de fiado: "' ||
          public.orders_history_value_text('fiadoStatus', to_jsonb(current_order.fiado_status)) ||
          '" -> "' ||
          public.orders_history_value_text('fiadoStatus', to_jsonb(next_fiado_status)) ||
          '"',
        occurred_at,
        'fiadoStatus',
        public.orders_history_value_text('fiadoStatus', to_jsonb(current_order.fiado_status)),
        public.orders_history_value_text('fiadoStatus', to_jsonb(next_fiado_status))
      )
    );
  end if;

  if current_order.fiado_observation is distinct from next_fiado_observation then
    next_history := public.orders_prepend_history_event(
      next_history,
      public.orders_history_event_payload(
        target_order_id::text || '-' || public.orders_history_timestamp_text(occurred_at) || '-fiado-observation',
        'Estado interno de fiado actualizado',
        'Observacion de fiado: "' ||
          public.orders_history_value_text('fiadoObservation', to_jsonb(current_order.fiado_observation)) ||
          '" -> "' ||
          public.orders_history_value_text('fiadoObservation', to_jsonb(next_fiado_observation)) ||
          '"',
        occurred_at,
        'fiadoObservation',
        public.orders_history_value_text('fiadoObservation', to_jsonb(current_order.fiado_observation)),
        public.orders_history_value_text('fiadoObservation', to_jsonb(next_fiado_observation))
      )
    );
  end if;

  if not current_order.is_reviewed and next_is_reviewed then
    if next_event_intent = 'mark_reviewed_from_new_orders' then
      next_history := public.orders_prepend_history_event(
        next_history,
        public.orders_history_event_payload(
          target_order_id::text || '-' || public.orders_history_timestamp_text(occurred_at) || '-reviewed-new-orders',
          'Pedido revisado',
          'El negocio reviso manualmente este pedido desde la bandeja de nuevos.',
          occurred_at
        )
      );
    elsif next_event_intent = 'mark_reviewed_from_operation' then
      next_history := public.orders_prepend_history_event(
        next_history,
        public.orders_history_event_payload(
          target_order_id::text || '-' || public.orders_history_timestamp_text(occurred_at) || '-reviewed-operation',
          'Pedido revisado',
          'El negocio reviso manualmente este pedido desde la operacion.',
          occurred_at
        )
      );
    else
      next_history := public.orders_prepend_history_event(
        next_history,
        public.orders_history_event_payload(
          target_order_id::text || '-' || public.orders_history_timestamp_text(occurred_at) || '-reviewed',
          'Pedido revisado',
          'El pedido quedo marcado como revisado desde el workspace privado.',
          occurred_at
        )
      );
    end if;
  end if;

  if next_event_intent = 'request_payment_proof_whatsapp' then
    next_history := public.orders_prepend_history_event(
      next_history,
      public.orders_history_event_payload(
        target_order_id::text || '-' || public.orders_history_timestamp_text(occurred_at) || '-request-payment-proof',
        'Mensaje de comprobante preparado para WhatsApp',
        'Se preparo un mensaje manual para solicitar el comprobante de pago al cliente.',
        occurred_at
      )
    );
  end if;

  if not public.orders_history_is_valid(next_history) then
    raise exception using
      errcode = '23514',
      message = 'Invalid order update payload. El historial append-only generado en DB no es valido.';
  end if;

  perform set_config('tecpify.allow_order_history_write', 'on', true);

  update public.orders
  set
    customer_name = next_customer_name,
    customer_whatsapp = next_customer_whatsapp,
    delivery_type = next_delivery_type,
    delivery_address = next_delivery_address,
    payment_method = next_payment_method,
    payment_status = next_payment_status,
    status = next_status,
    products = next_products,
    notes = next_notes,
    total = next_total,
    is_reviewed = next_is_reviewed,
    is_fiado = next_is_fiado,
    fiado_status = next_fiado_status,
    fiado_observation = next_fiado_observation,
    history = next_history,
    updated_at = occurred_at
  where id = target_order_id
  returning * into updated_order;

  return updated_order;
end;
$$;

drop trigger if exists orders_enforce_server_generated_history_before_insert on public.orders;
create trigger orders_enforce_server_generated_history_before_insert
  before insert on public.orders
  for each row
  execute function public.orders_enforce_server_generated_history_insert();

drop trigger if exists orders_block_direct_history_before_update on public.orders;
create trigger orders_block_direct_history_before_update
  before update on public.orders
  for each row
  execute function public.orders_block_direct_history_update();

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

revoke all on function public.update_order_with_server_history(uuid, jsonb) from public;
grant execute on function public.update_order_with_server_history(uuid, jsonb) to authenticated;
