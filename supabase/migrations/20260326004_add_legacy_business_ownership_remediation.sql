create table if not exists public.legacy_business_ownership_remediations (
  business_id uuid primary key references public.businesses (id) on delete cascade,
  remediation_status text not null check (
    remediation_status in (
      'ownerless_unassigned',
      'ownerless_requested',
      'ownerless_claimable',
      'remediated'
    )
  ),
  requested_by_user_id uuid references auth.users (id) on delete set null,
  requested_at timestamptz,
  claimable_user_id uuid references auth.users (id) on delete set null,
  claimable_at timestamptz,
  claimed_by_user_id uuid references auth.users (id) on delete set null,
  claimed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint legacy_business_ownership_remediations_state_consistency check (
    (
      remediation_status = 'ownerless_unassigned'
      and requested_by_user_id is null
      and requested_at is null
      and claimable_user_id is null
      and claimable_at is null
      and claimed_by_user_id is null
      and claimed_at is null
    )
    or (
      remediation_status = 'ownerless_requested'
      and requested_by_user_id is not null
      and requested_at is not null
      and claimable_user_id is null
      and claimable_at is null
      and claimed_by_user_id is null
      and claimed_at is null
    )
    or (
      remediation_status = 'ownerless_claimable'
      and requested_by_user_id is not null
      and requested_at is not null
      and claimable_user_id is not null
      and claimable_at is not null
      and claimable_user_id = requested_by_user_id
      and claimed_by_user_id is null
      and claimed_at is null
    )
    or (
      remediation_status = 'remediated'
      and requested_by_user_id is not null
      and requested_at is not null
      and claimable_user_id is not null
      and claimable_at is not null
      and claimable_user_id = requested_by_user_id
      and claimed_by_user_id is not null
      and claimed_at is not null
      and claimed_by_user_id = claimable_user_id
    )
  )
);

create index if not exists legacy_business_ownership_remediations_requested_by_user_id_idx
  on public.legacy_business_ownership_remediations (requested_by_user_id);

create index if not exists legacy_business_ownership_remediations_claimable_user_id_idx
  on public.legacy_business_ownership_remediations (claimable_user_id);

create index if not exists legacy_business_ownership_remediations_claimed_by_user_id_idx
  on public.legacy_business_ownership_remediations (claimed_by_user_id);

create table if not exists public.legacy_business_ownership_remediation_events (
  id bigint generated always as identity primary key,
  business_id uuid not null references public.businesses (id) on delete cascade,
  event_type text not null check (
    event_type in ('request_submitted', 'claim_granted', 'ownership_claimed')
  ),
  actor_user_id uuid references auth.users (id) on delete set null,
  actor_label text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists legacy_business_ownership_remediation_events_business_id_idx
  on public.legacy_business_ownership_remediation_events (business_id, created_at desc);

alter table public.legacy_business_ownership_remediations
  enable row level security;

alter table public.legacy_business_ownership_remediation_events
  enable row level security;

create or replace function public.set_legacy_business_ownership_remediations_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists legacy_business_ownership_remediations_set_updated_at
  on public.legacy_business_ownership_remediations;
create trigger legacy_business_ownership_remediations_set_updated_at
before update on public.legacy_business_ownership_remediations
for each row
execute function public.set_legacy_business_ownership_remediations_updated_at();

insert into public.legacy_business_ownership_remediations (business_id, remediation_status)
select businesses.id, 'ownerless_unassigned'
from public.businesses
where businesses.created_by_user_id is null
on conflict (business_id) do nothing;

create or replace function public.enforce_legacy_business_owner_assignment_via_remediation()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  remediation_row public.legacy_business_ownership_remediations%rowtype;
begin
  if new.created_by_user_id is not distinct from old.created_by_user_id then
    return new;
  end if;

  if old.created_by_user_id is not null then
    raise exception 'business owner reassignment is not supported for the MVP'
      using errcode = '23514';
  end if;

  if new.created_by_user_id is null then
    return new;
  end if;

  select *
  into remediation_row
  from public.legacy_business_ownership_remediations
  where business_id = new.id
  for update;

  if remediation_row.business_id is null then
    raise exception 'legacy businesses require an audited remediation record before assigning created_by_user_id'
      using errcode = '23514';
  end if;

  if remediation_row.remediation_status <> 'ownerless_claimable' then
    raise exception 'legacy businesses require a claimable remediation state before assigning created_by_user_id'
      using errcode = '23514';
  end if;

  if remediation_row.claimable_user_id is distinct from new.created_by_user_id then
    raise exception 'legacy businesses can only be assigned to the claimable remediation user'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists businesses_require_legacy_remediation_before_owner_assignment
  on public.businesses;
create trigger businesses_require_legacy_remediation_before_owner_assignment
before update of created_by_user_id on public.businesses
for each row
when (old.created_by_user_id is distinct from new.created_by_user_id)
execute function public.enforce_legacy_business_owner_assignment_via_remediation();

create or replace function public.sync_legacy_business_remediation_after_owner_assignment()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  ownership_claimed_at timestamptz := timezone('utc', now());
begin
  if old.created_by_user_id is not null or new.created_by_user_id is null then
    return new;
  end if;

  update public.legacy_business_ownership_remediations
  set remediation_status = 'remediated',
      claimed_by_user_id = new.created_by_user_id,
      claimed_at = ownership_claimed_at
  where business_id = new.id;

  insert into public.legacy_business_ownership_remediation_events (
    business_id,
    event_type,
    actor_user_id,
    details
  )
  values (
    new.id,
    'ownership_claimed',
    new.created_by_user_id,
    jsonb_build_object(
      'business_slug', new.slug,
      'created_by_user_id', new.created_by_user_id
    )
  );

  return new;
end;
$$;

drop trigger if exists businesses_sync_legacy_remediation_after_owner_assignment
  on public.businesses;
create trigger businesses_sync_legacy_remediation_after_owner_assignment
after update of created_by_user_id on public.businesses
for each row
when (
  old.created_by_user_id is distinct from new.created_by_user_id
  and old.created_by_user_id is null
  and new.created_by_user_id is not null
)
execute function public.sync_legacy_business_remediation_after_owner_assignment();

create or replace function public.request_legacy_business_ownership_remediation(
  requested_slug text
)
returns table (
  business_id uuid,
  business_slug text,
  business_name text,
  remediation_status text,
  access_status text,
  requested_at timestamptz,
  claimable_at timestamptz,
  claimed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_business public.businesses%rowtype;
  remediation_row public.legacy_business_ownership_remediations%rowtype;
  request_recorded_at timestamptz := timezone('utc', now());
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesion para solicitar remediacion legacy.'
      using errcode = '28000';
  end if;

  select *
  into current_business
  from public.businesses
  where slug = requested_slug
  limit 1;

  if current_business.id is null then
    raise exception 'El negocio solicitado no existe.'
      using errcode = 'P0002';
  end if;

  if current_business.created_by_user_id is not null then
    raise exception 'El negocio solicitado ya tiene owner real.'
      using errcode = '23514';
  end if;

  insert into public.legacy_business_ownership_remediations (business_id, remediation_status)
  values (current_business.id, 'ownerless_unassigned')
  on conflict (business_id) do nothing;

  select *
  into remediation_row
  from public.legacy_business_ownership_remediations
  where business_id = current_business.id
  for update;

  if remediation_row.remediation_status = 'ownerless_unassigned' then
    update public.legacy_business_ownership_remediations
    set remediation_status = 'ownerless_requested',
        requested_by_user_id = auth.uid(),
        requested_at = request_recorded_at
    where business_id = current_business.id
    returning *
    into remediation_row;

    insert into public.legacy_business_ownership_remediation_events (
      business_id,
      event_type,
      actor_user_id,
      details
    )
    values (
      current_business.id,
      'request_submitted',
      auth.uid(),
      jsonb_build_object('business_slug', current_business.slug)
    );
  elsif remediation_row.remediation_status = 'ownerless_requested' then
    if remediation_row.requested_by_user_id is distinct from auth.uid() then
      raise exception 'La remediacion legacy ya fue solicitada por otro operador.'
        using errcode = '23505';
    end if;
  elsif remediation_row.remediation_status = 'ownerless_claimable' then
    if remediation_row.claimable_user_id is distinct from auth.uid() then
      raise exception 'La remediacion legacy ya fue asignada a otro operador.'
        using errcode = '42501';
    end if;
  else
    raise exception 'El negocio solicitado ya tiene owner real.'
      using errcode = '23514';
  end if;

  return query
  select
    current_business.id as business_id,
    current_business.slug as business_slug,
    current_business.name as business_name,
    remediation_row.remediation_status,
    'inaccessible'::text as access_status,
    remediation_row.requested_at,
    remediation_row.claimable_at,
    remediation_row.claimed_at;
end;
$$;

create or replace function public.grant_legacy_business_owner_claim(
  requested_slug text,
  requested_user_email text
)
returns table (
  business_id uuid,
  business_slug text,
  business_name text,
  remediation_status text,
  access_status text,
  requested_at timestamptz,
  claimable_at timestamptz,
  claimed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_business public.businesses%rowtype;
  remediation_row public.legacy_business_ownership_remediations%rowtype;
  requested_operator_email text;
  claim_enabled_at timestamptz := timezone('utc', now());
begin
  select *
  into current_business
  from public.businesses
  where slug = requested_slug
  limit 1;

  if current_business.id is null then
    raise exception 'El negocio solicitado no existe.'
      using errcode = 'P0002';
  end if;

  if current_business.created_by_user_id is not null then
    raise exception 'El negocio solicitado ya tiene owner real.'
      using errcode = '23514';
  end if;

  select *
  into remediation_row
  from public.legacy_business_ownership_remediations
  where business_id = current_business.id
  for update;

  if remediation_row.business_id is null
     or remediation_row.remediation_status = 'ownerless_unassigned' then
    raise exception 'La remediacion legacy todavia no tiene una solicitud activa.'
      using errcode = '23514';
  end if;

  if remediation_row.remediation_status = 'remediated' then
    raise exception 'El negocio solicitado ya tiene owner real.'
      using errcode = '23514';
  end if;

  select email
  into requested_operator_email
  from auth.users
  where id = remediation_row.requested_by_user_id;

  if requested_operator_email is null then
    raise exception 'No fue posible resolver el email del operador solicitado.'
      using errcode = 'P0002';
  end if;

  if lower(btrim(requested_operator_email)) <> lower(btrim(requested_user_email)) then
    raise exception 'El email indicado no coincide con la solicitud vigente.'
      using errcode = '23514';
  end if;

  if remediation_row.remediation_status = 'ownerless_requested' then
    update public.legacy_business_ownership_remediations
    set remediation_status = 'ownerless_claimable',
        claimable_user_id = remediation_row.requested_by_user_id,
        claimable_at = claim_enabled_at
    where business_id = current_business.id
    returning *
    into remediation_row;

    insert into public.legacy_business_ownership_remediation_events (
      business_id,
      event_type,
      actor_label,
      details
    )
    values (
      current_business.id,
      'claim_granted',
      current_user,
      jsonb_build_object(
        'business_slug', current_business.slug,
        'requested_user_email', requested_operator_email
      )
    );
  end if;

  return query
  select
    current_business.id as business_id,
    current_business.slug as business_slug,
    current_business.name as business_name,
    remediation_row.remediation_status,
    'inaccessible'::text as access_status,
    remediation_row.requested_at,
    remediation_row.claimable_at,
    remediation_row.claimed_at;
end;
$$;

create or replace function public.claim_legacy_business_ownership(
  requested_slug text
)
returns table (
  id uuid,
  slug text,
  name text,
  created_at timestamptz,
  updated_at timestamptz,
  created_by_user_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_business public.businesses%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesion para reclamar ownership legacy.'
      using errcode = '28000';
  end if;

  select *
  into current_business
  from public.businesses
  where slug = requested_slug
  limit 1;

  if current_business.id is null then
    raise exception 'El negocio solicitado no existe.'
      using errcode = 'P0002';
  end if;

  if current_business.created_by_user_id is not null then
    raise exception 'El negocio solicitado ya tiene owner real.'
      using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.legacy_business_ownership_remediations
    where business_id = current_business.id
      and remediation_status = 'ownerless_claimable'
      and claimable_user_id = auth.uid()
  ) then
    if exists (
      select 1
      from public.legacy_business_ownership_remediations
      where business_id = current_business.id
        and remediation_status = 'ownerless_claimable'
        and claimable_user_id is distinct from auth.uid()
    ) then
      raise exception 'La remediacion legacy esta asignada a otro operador.'
        using errcode = '42501';
    end if;

    raise exception 'La remediacion legacy aun no esta lista para claim.'
      using errcode = '23514';
  end if;

  update public.businesses
  set created_by_user_id = auth.uid(),
      updated_at = timezone('utc', now())
  where id = current_business.id
    and created_by_user_id is null
  returning *
  into current_business;

  if current_business.id is null then
    raise exception 'No fue posible persistir el owner legacy.'
      using errcode = '23514';
  end if;

  return query
  select
    current_business.id,
    current_business.slug,
    current_business.name,
    current_business.created_at,
    current_business.updated_at,
    current_business.created_by_user_id;
end;
$$;

create or replace function public.list_current_user_legacy_business_ownership_remediations()
returns table (
  business_id uuid,
  business_slug text,
  business_name text,
  remediation_status text,
  access_status text,
  requested_at timestamptz,
  claimable_at timestamptz,
  claimed_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    businesses.id as business_id,
    businesses.slug as business_slug,
    businesses.name as business_name,
    remediations.remediation_status,
    case
      when businesses.created_by_user_id is null then 'inaccessible'
      else 'accessible'
    end as access_status,
    remediations.requested_at,
    remediations.claimable_at,
    remediations.claimed_at
  from public.legacy_business_ownership_remediations as remediations
  join public.businesses as businesses
    on businesses.id = remediations.business_id
  where auth.uid() is not null
    and (
      remediations.requested_by_user_id = auth.uid()
      or remediations.claimable_user_id = auth.uid()
      or remediations.claimed_by_user_id = auth.uid()
    )
  order by businesses.slug asc;
$$;

revoke all on function public.request_legacy_business_ownership_remediation(text)
  from public, anon, authenticated;
grant execute on function public.request_legacy_business_ownership_remediation(text)
  to authenticated;

revoke all on function public.claim_legacy_business_ownership(text)
  from public, anon, authenticated;
grant execute on function public.claim_legacy_business_ownership(text)
  to authenticated;

revoke all on function public.list_current_user_legacy_business_ownership_remediations()
  from public, anon, authenticated;
grant execute on function public.list_current_user_legacy_business_ownership_remediations()
  to authenticated;

revoke all on function public.grant_legacy_business_owner_claim(text, text)
  from public, anon, authenticated;
