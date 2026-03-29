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
  add column if not exists fiado_observation text,
  add column if not exists previous_status_before_cancellation text,
  add column if not exists cancellation_reason text,
  add column if not exists cancellation_detail text,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by_user_id uuid,
  add column if not exists cancelled_by_user_email text,
  add column if not exists reactivated_at timestamptz,
  add column if not exists reactivated_by_user_id uuid,
  add column if not exists reactivated_by_user_email text;

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
    'nuevo',
    'confirmado',
    'en preparación',
    'listo',
    'entregado',
    'cancelado'
  );
$$;

create or replace function public.orders_cancellation_reason_is_valid(candidate_reason text)
returns boolean
language sql
immutable
as $$
  select candidate_reason in (
    'cliente_canceló',
    'error_de_captura',
    'pago_rechazado',
    'sin_respuesta_del_cliente',
    'producto_no_disponible',
    'pedido_duplicado',
    'otro'
  );
$$;

create or replace function public.orders_cancellable_status_is_valid(candidate_status text)
returns boolean
language sql
immutable
as $$
  select candidate_status in (
    'nuevo',
    'confirmado',
    'en preparación',
    'listo'
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
  candidate_status text,
  candidate_is_fiado boolean default false,
  candidate_fiado_status text default null
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

      when candidate_status in ('confirmado', 'en preparación', 'listo', 'entregado') then
        candidate_payment_status = 'verificado'
        or candidate_payment_method = 'Contra entrega'
        or (
          coalesce(candidate_is_fiado, false)
          and candidate_fiado_status in ('pending', 'paid')
        )

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
    when candidate_field in ('customerName', 'customerWhatsApp', 'deliveryAddress', 'paymentMethod', 'notes', 'fiadoObservation') then
      nullif(trim(both '"' from candidate_value::text), '')
    when candidate_field = 'status' then
      case trim(both '"' from candidate_value::text)
        when 'nuevo' then 'Nuevo'
        when 'confirmado' then 'Confirmado'
        when 'en preparación' then 'Preparación'
        when 'listo' then 'Listo'
        when 'entregado' then 'Entregado'
        when 'cancelado' then 'Cancelado'
        else nullif(trim(both '"' from candidate_value::text), '')
      end
    when candidate_field = 'paymentStatus' then
      case trim(both '"' from candidate_value::text)
        when 'pendiente' then 'Pendiente'
        when 'verificado' then 'Verificado'
        when 'con novedad' then 'Con novedad'
        when 'no verificado' then 'Por verificar'
        else nullif(trim(both '"' from candidate_value::text), '')
      end
    when candidate_field = 'deliveryType' then
      case trim(both '"' from candidate_value::text)
        when 'domicilio' then 'Domicilio'
        when 'recogida en tienda' then 'Recogida en tienda'
        else nullif(trim(both '"' from candidate_value::text), '')
      end
    when candidate_field = 'cancellationReason' then
      case trim(both '"' from candidate_value::text)
        when 'cliente_canceló' then 'Cliente canceló'
        when 'error_de_captura' then 'Error de captura'
        when 'pago_rechazado' then 'Pago rechazado'
        when 'sin_respuesta_del_cliente' then 'Sin respuesta del cliente'
        when 'producto_no_disponible' then 'Producto no disponible'
        when 'pedido_duplicado' then 'Pedido duplicado'
        when 'otro' then 'Otro'
        else nullif(trim(both '"' from candidate_value::text), '')
      end
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
    or previous_order.fiado_observation is distinct from next_order.fiado_observation
    or previous_order.previous_status_before_cancellation is distinct from next_order.previous_status_before_cancellation
    or previous_order.cancellation_reason is distinct from next_order.cancellation_reason
    or previous_order.cancellation_detail is distinct from next_order.cancellation_detail
    or previous_order.cancelled_at is distinct from next_order.cancelled_at
    or previous_order.cancelled_by_user_id is distinct from next_order.cancelled_by_user_id
    or previous_order.cancelled_by_user_email is distinct from next_order.cancelled_by_user_email
    or previous_order.reactivated_at is distinct from next_order.reactivated_at
    or previous_order.reactivated_by_user_id is distinct from next_order.reactivated_by_user_id
    or previous_order.reactivated_by_user_email is distinct from next_order.reactivated_by_user_email;
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
  new.previous_status_before_cancellation := null;
  new.cancellation_reason := null;
  new.cancellation_detail := null;
  new.cancelled_at := null;
  new.cancelled_by_user_id := null;
  new.cancelled_by_user_email := null;
  new.reactivated_at := null;
  new.reactivated_by_user_id := null;
  new.reactivated_by_user_email := null;

  if public.orders_payment_method_is_cash(new.payment_method) then
    new.payment_status := 'verificado';
    new.status := 'nuevo';
  else
    new.payment_status := 'pendiente';
    new.status := 'nuevo';
  end if;

  if not public.orders_payment_write_is_valid(
    new.delivery_type,
    new.payment_method,
    new.payment_status,
    new.status,
    new.is_fiado,
    new.fiado_status
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
  next_previous_status_before_cancellation text := old.previous_status_before_cancellation;
  next_cancellation_reason text := old.cancellation_reason;
  next_cancellation_detail text := nullif(trim(coalesce(old.cancellation_detail, '')), '');
  next_cancelled_at timestamptz := old.cancelled_at;
  next_cancelled_by_user_id uuid := old.cancelled_by_user_id;
  next_cancelled_by_user_email text := old.cancelled_by_user_email;
  next_reactivated_at timestamptz := old.reactivated_at;
  next_reactivated_by_user_id uuid := old.reactivated_by_user_id;
  next_reactivated_by_user_email text := old.reactivated_by_user_email;
  requested_payment_status boolean := false;
  requested_status boolean := false;
  order_status_sequence text[] := array[
    'nuevo',
    'confirmado',
    'en preparación',
    'listo',
    'entregado'
  ];
  current_index integer;
  next_index integer;
  cancellation_requested boolean := false;
  reactivation_requested boolean := false;
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

  if new.previous_status_before_cancellation is distinct from old.previous_status_before_cancellation then
    next_previous_status_before_cancellation := nullif(trim(coalesce(new.previous_status_before_cancellation, '')), '');
  end if;

  if new.cancellation_reason is distinct from old.cancellation_reason then
    next_cancellation_reason := nullif(trim(coalesce(new.cancellation_reason, '')), '');
  end if;

  if new.cancellation_detail is distinct from old.cancellation_detail then
    next_cancellation_detail := nullif(trim(coalesce(new.cancellation_detail, '')), '');
  end if;

  if new.cancelled_at is distinct from old.cancelled_at then
    next_cancelled_at := new.cancelled_at;
  end if;

  if new.cancelled_by_user_id is distinct from old.cancelled_by_user_id then
    next_cancelled_by_user_id := new.cancelled_by_user_id;
  end if;

  if new.cancelled_by_user_email is distinct from old.cancelled_by_user_email then
    next_cancelled_by_user_email := nullif(trim(coalesce(new.cancelled_by_user_email, '')), '');
  end if;

  if new.reactivated_at is distinct from old.reactivated_at then
    next_reactivated_at := new.reactivated_at;
  end if;

  if new.reactivated_by_user_id is distinct from old.reactivated_by_user_id then
    next_reactivated_by_user_id := new.reactivated_by_user_id;
  end if;

  if new.reactivated_by_user_email is distinct from old.reactivated_by_user_email then
    next_reactivated_by_user_email := nullif(trim(coalesce(new.reactivated_by_user_email, '')), '');
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

  if not public.orders_status_is_valid(next_status) then
    raise exception using
      errcode = '23514',
      message = 'Invalid order update payload. status no es valido para public.orders.';
  end if;

  cancellation_requested := old.status <> 'cancelado' and next_status = 'cancelado';
  reactivation_requested := old.status = 'cancelado' and next_status <> 'cancelado';

  if old.status = 'cancelado'
    and not reactivation_requested
    and (
      new.status is distinct from old.status
      or new.payment_status is distinct from old.payment_status
      or new.payment_method is distinct from old.payment_method
      or new.delivery_type is distinct from old.delivery_type
      or new.products is distinct from old.products
      or new.total is distinct from old.total
      or new.is_fiado is distinct from old.is_fiado
      or new.fiado_status is distinct from old.fiado_status
      or new.fiado_observation is distinct from old.fiado_observation
    ) then
    raise exception using
      errcode = '23514',
      message = 'Invalid order update payload. Un pedido cancelado debe reactivarse antes de volver a mutar su frente operativo.';
  end if;

  if not public.orders_payment_write_is_valid(
    next_delivery_type,
    next_payment_method,
    next_payment_status,
    next_status,
    next_is_fiado,
    next_fiado_status
  ) then
    if next_payment_method in ('Efectivo', 'Contra entrega') then
      raise exception using
        errcode = '23514',
        message = 'Invalid order update payload. Los pagos en efectivo o contra entrega solo pueden persistirse como verificados.';
    elsif next_status in ('confirmado', 'en preparación', 'listo', 'entregado') then
      raise exception using
        errcode = '23514',
        message = 'Invalid order update payload. No puedes avanzar el pedido mientras la condicion financiera siga bloqueando la compuerta de Nuevo.';
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

  if cancellation_requested then
    if not public.orders_cancellable_status_is_valid(old.status) then
      if old.status = 'entregado' then
        raise exception using
          errcode = '23514',
          message = 'Invalid order update payload. No puedes cancelar un pedido que ya fue entregado.';
      end if;

      raise exception using
        errcode = '23514',
        message = 'Invalid order update payload. Solo puedes cancelar pedidos en Nuevo, Confirmado, Preparación o Listo.';
    end if;

    if next_previous_status_before_cancellation is distinct from old.status then
      raise exception using
        errcode = '23514',
        message = 'Invalid order update payload. La cancelacion debe guardar el estado operativo previo exacto.';
    end if;

    if not public.orders_cancellation_reason_is_valid(next_cancellation_reason) then
      raise exception using
        errcode = '23514',
        message = 'Invalid order update payload. Debes seleccionar un motivo de cancelacion valido.';
    end if;

    if next_cancellation_reason = 'otro' and next_cancellation_detail is null then
      raise exception using
        errcode = '23514',
        message = 'Invalid order update payload. Debes detallar la cancelacion cuando el motivo es "Otro".';
    end if;

    if next_cancellation_reason <> 'otro' and next_cancellation_detail is not null then
      raise exception using
        errcode = '23514',
        message = 'Invalid order update payload. El detalle libre solo se admite cuando el motivo es "Otro".';
    end if;

    if next_cancelled_at is null then
      raise exception using
        errcode = '23514',
        message = 'Invalid order update payload. La cancelacion debe registrar fecha y hora.';
    end if;

    if next_reactivated_at is not null
      or next_reactivated_by_user_id is not null
      or next_reactivated_by_user_email is not null then
      raise exception using
        errcode = '23514',
        message = 'Invalid order update payload. Un pedido cancelado activo no puede conservar metadatos de reactivacion.';
    end if;
  elsif reactivation_requested then
    if not public.orders_cancellable_status_is_valid(old.previous_status_before_cancellation) then
      raise exception using
        errcode = '23514',
        message = 'Invalid order update payload. No fue posible reactivar este pedido porque no tiene un estado previo valido.';
    end if;

    if next_status is distinct from old.previous_status_before_cancellation then
      raise exception using
        errcode = '23514',
        message = 'Invalid order update payload. La reactivacion debe volver exactamente al estado previo guardado.';
    end if;

    if next_previous_status_before_cancellation is not null
      or next_cancellation_reason is not null
      or next_cancellation_detail is not null
      or next_cancelled_at is not null
      or next_cancelled_by_user_id is not null
      or next_cancelled_by_user_email is not null then
      raise exception using
        errcode = '23514',
        message = 'Invalid order update payload. La reactivacion debe limpiar el estado excepcional de cancelacion.';
    end if;

    if next_reactivated_at is null then
      raise exception using
        errcode = '23514',
        message = 'Invalid order update payload. La reactivacion debe registrar fecha y hora.';
    end if;
  else
    if next_status = 'cancelado' then
      if not public.orders_cancellable_status_is_valid(next_previous_status_before_cancellation) then
        raise exception using
          errcode = '23514',
          message = 'Invalid order update payload. Un pedido cancelado debe conservar un estado previo valido.';
      end if;

      if not public.orders_cancellation_reason_is_valid(next_cancellation_reason) then
        raise exception using
          errcode = '23514',
          message = 'Invalid order update payload. Un pedido cancelado debe conservar un motivo de cancelacion valido.';
      end if;

      if next_cancellation_reason = 'otro' and next_cancellation_detail is null then
        raise exception using
          errcode = '23514',
          message = 'Invalid order update payload. Debes detallar la cancelacion cuando el motivo es "Otro".';
      end if;

      if next_cancellation_reason <> 'otro' and next_cancellation_detail is not null then
        raise exception using
          errcode = '23514',
          message = 'Invalid order update payload. El detalle libre solo se admite cuando el motivo es "Otro".';
      end if;

      if next_cancelled_at is null then
        raise exception using
          errcode = '23514',
          message = 'Invalid order update payload. Un pedido cancelado debe conservar fecha y hora de cancelacion.';
      end if;

      if next_reactivated_at is not null
        or next_reactivated_by_user_id is not null
        or next_reactivated_by_user_email is not null then
        raise exception using
          errcode = '23514',
          message = 'Invalid order update payload. Un pedido cancelado activo no puede conservar metadatos de reactivacion.';
      end if;
    elsif next_previous_status_before_cancellation is not null
      or next_cancellation_reason is not null
      or next_cancellation_detail is not null
      or next_cancelled_at is not null
      or next_cancelled_by_user_id is not null
      or next_cancelled_by_user_email is not null then
      raise exception using
        errcode = '23514',
        message = 'Invalid order update payload. Los metadatos de cancelacion solo pueden existir mientras el pedido siga cancelado.';
    end if;

    if next_status <> old.status then
      if old.status = 'entregado' then
        raise exception using
          errcode = '23514',
          message = 'Invalid order update payload. Este pedido ya termino su flujo y no puede seguir avanzando desde aqui.';
      end if;

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
  new.previous_status_before_cancellation := next_previous_status_before_cancellation;
  new.cancellation_reason := next_cancellation_reason;
  new.cancellation_detail := next_cancellation_detail;
  new.cancelled_at := next_cancelled_at;
  new.cancelled_by_user_id := next_cancelled_by_user_id;
  new.cancelled_by_user_email := next_cancelled_by_user_email;
  new.reactivated_at := next_reactivated_at;
  new.reactivated_by_user_id := next_reactivated_by_user_id;
  new.reactivated_by_user_email := next_reactivated_by_user_email;

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
  next_previous_status_before_cancellation text;
  next_cancellation_reason text;
  next_cancellation_detail text;
  next_cancelled_at timestamptz;
  next_cancelled_by_user_id uuid;
  next_cancelled_by_user_email text;
  next_reactivated_at timestamptz;
  next_reactivated_by_user_id uuid;
  next_reactivated_by_user_email text;
  next_history jsonb;
  next_event_intent text;
  next_actor_user_id uuid := auth.uid();
  next_actor_email text := null;
  actor_label text;
  cancellation_reason_label text;
  reactivation_status_label text;
  occurred_at timestamptz := now();
  invalid_patch_keys text[];
  invalid_exceptional_patch_keys text[];
  cancellation_requested boolean := false;
  reactivation_requested boolean := false;
  normalized_actor_user_id_text text;
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
    'eventIntent',
    'cancellationReason',
    'cancellationDetail',
    'reactivateCancelledOrder',
    'actorUserId',
    'actorEmail'
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
  next_previous_status_before_cancellation := current_order.previous_status_before_cancellation;
  next_cancellation_reason := current_order.cancellation_reason;
  next_cancellation_detail := nullif(trim(coalesce(current_order.cancellation_detail, '')), '');
  next_cancelled_at := current_order.cancelled_at;
  next_cancelled_by_user_id := current_order.cancelled_by_user_id;
  next_cancelled_by_user_email := current_order.cancelled_by_user_email;
  next_reactivated_at := current_order.reactivated_at;
  next_reactivated_by_user_id := current_order.reactivated_by_user_id;
  next_reactivated_by_user_email := current_order.reactivated_by_user_email;
  next_event_intent := null;

  if patch ? 'actorUserId' then
    if jsonb_typeof(patch -> 'actorUserId') not in ('string', 'null') then
      raise exception using
        errcode = '23514',
        message = 'Invalid order update payload. actorUserId debe ser texto o null.';
    end if;

    normalized_actor_user_id_text := nullif(trim(coalesce(patch ->> 'actorUserId', '')), '');

    if normalized_actor_user_id_text is not null then
      next_actor_user_id := normalized_actor_user_id_text::uuid;
    end if;
  end if;

  if patch ? 'actorEmail' then
    if jsonb_typeof(patch -> 'actorEmail') not in ('string', 'null') then
      raise exception using
        errcode = '23514',
        message = 'Invalid order update payload. actorEmail debe ser texto o null.';
    end if;

    next_actor_email := nullif(trim(coalesce(patch ->> 'actorEmail', '')), '');
  end if;

  actor_label := coalesce(next_actor_email, next_actor_user_id::text, 'usuario autenticado');

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

  if patch ? 'reactivateCancelledOrder' then
    if jsonb_typeof(patch -> 'reactivateCancelledOrder') <> 'boolean' then
      raise exception using
        errcode = '23514',
        message = 'Invalid order update payload. reactivateCancelledOrder debe ser booleano.';
    end if;

    reactivation_requested := coalesce((patch ->> 'reactivateCancelledOrder')::boolean, false);
  end if;

  cancellation_requested := patch ? 'status' and next_status = 'cancelado';

  if cancellation_requested and reactivation_requested then
    raise exception using
      errcode = '23514',
      message = 'Invalid order update payload. No puedes cancelar y reactivar el pedido en la misma operacion.';
  end if;

  if current_order.status = 'cancelado'
    and not reactivation_requested
    and (
      patch ? 'status'
      or patch ? 'paymentStatus'
      or patch ? 'payment_status'
      or patch ? 'paymentMethod'
      or patch ? 'deliveryType'
      or patch ? 'products'
      or patch ? 'total'
      or patch ? 'isFiado'
      or patch ? 'fiadoStatus'
      or patch ? 'fiadoObservation'
    ) then
    raise exception using
      errcode = '23514',
      message = 'Invalid order update payload. Un pedido cancelado debe reactivarse antes de volver a mutar su frente operativo.';
  end if;

  if cancellation_requested then
    select array_agg(patch_key.key order by patch_key.key)
    into invalid_exceptional_patch_keys
    from jsonb_object_keys(patch) as patch_key(key)
    where patch_key.key not in (
      'status',
      'cancellationReason',
      'cancellationDetail',
      'actorUserId',
      'actorEmail'
    );

    if invalid_exceptional_patch_keys is not null then
      raise exception using
        errcode = '23514',
        message = 'Invalid order update payload. La cancelacion debe enviarse sola junto con su motivo obligatorio.';
    end if;

    next_previous_status_before_cancellation := current_order.status;
    next_cancellation_reason := nullif(trim(coalesce(patch ->> 'cancellationReason', '')), '');
    next_cancellation_detail := nullif(trim(coalesce(patch ->> 'cancellationDetail', '')), '');
    next_cancelled_at := occurred_at;
    next_cancelled_by_user_id := next_actor_user_id;
    next_cancelled_by_user_email := next_actor_email;
    next_reactivated_at := null;
    next_reactivated_by_user_id := null;
    next_reactivated_by_user_email := null;
  elsif reactivation_requested then
    select array_agg(patch_key.key order by patch_key.key)
    into invalid_exceptional_patch_keys
    from jsonb_object_keys(patch) as patch_key(key)
    where patch_key.key not in (
      'reactivateCancelledOrder',
      'actorUserId',
      'actorEmail'
    );

    if invalid_exceptional_patch_keys is not null then
      raise exception using
        errcode = '23514',
        message = 'Invalid order update payload. La reactivacion debe enviarse sola y volver exactamente al estado previo guardado.';
    end if;

    next_status := coalesce(current_order.previous_status_before_cancellation, '');
    next_previous_status_before_cancellation := null;
    next_cancellation_reason := null;
    next_cancellation_detail := null;
    next_cancelled_at := null;
    next_cancelled_by_user_id := null;
    next_cancelled_by_user_email := null;
    next_reactivated_at := occurred_at;
    next_reactivated_by_user_id := next_actor_user_id;
    next_reactivated_by_user_email := next_actor_email;
  elsif patch ? 'cancellationReason'
    or patch ? 'cancellationDetail'
    or patch ? 'reactivateCancelledOrder' then
    raise exception using
      errcode = '23514',
      message = 'Invalid order update payload. cancellationReason, cancellationDetail y reactivateCancelledOrder solo se admiten en los flujos excepcionales.';
  end if;

  if next_payment_method in ('Efectivo', 'Contra entrega') then
    next_payment_status := 'verificado';
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

  if not cancellation_requested
    and not reactivation_requested
    and current_order.status is distinct from next_status then
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

  if cancellation_requested then
    cancellation_reason_label := public.orders_history_value_text(
      'cancellationReason',
      to_jsonb(next_cancellation_reason)
    );

    next_history := public.orders_prepend_history_event(
      next_history,
      public.orders_history_event_payload(
        target_order_id::text || '-' || public.orders_history_timestamp_text(occurred_at) || '-cancelled',
        'Pedido cancelado',
        'Pedido cancelado por ' ||
          actor_label ||
          '. Salio de "' ||
          public.orders_history_value_text('status', to_jsonb(current_order.status)) ||
          '" por motivo "' ||
          cancellation_reason_label ||
          '"' ||
          case
            when next_cancellation_detail is not null then '. Detalle: "' || next_cancellation_detail || '"'
            else ''
          end ||
          '.',
        occurred_at,
        'status',
        public.orders_history_value_text('status', to_jsonb(current_order.status)),
        public.orders_history_value_text('status', to_jsonb(next_status))
      )
    );
  elsif reactivation_requested then
    reactivation_status_label := public.orders_history_value_text(
      'status',
      to_jsonb(next_status)
    );

    next_history := public.orders_prepend_history_event(
      next_history,
      public.orders_history_event_payload(
        target_order_id::text || '-' || public.orders_history_timestamp_text(occurred_at) || '-reactivated',
        'Pedido reactivado',
        'Pedido reactivado por ' ||
          actor_label ||
          '. Volvio a "' ||
          reactivation_status_label ||
          '".',
        occurred_at,
        'status',
        public.orders_history_value_text('status', to_jsonb(current_order.status)),
        reactivation_status_label
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
    previous_status_before_cancellation = next_previous_status_before_cancellation,
    cancellation_reason = next_cancellation_reason,
    cancellation_detail = next_cancellation_detail,
    cancelled_at = next_cancelled_at,
    cancelled_by_user_id = next_cancelled_by_user_id,
    cancelled_by_user_email = next_cancelled_by_user_email,
    reactivated_at = next_reactivated_at,
    reactivated_by_user_id = next_reactivated_by_user_id,
    reactivated_by_user_email = next_reactivated_by_user_email,
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
      orders.status,
      orders.is_fiado,
      orders.fiado_status
    )
  );

revoke all on function public.update_order_with_server_history(uuid, jsonb) from public;
grant execute on function public.update_order_with_server_history(uuid, jsonb) to authenticated;
