create or replace function public.enforce_business_owner_presence()
returns trigger
language plpgsql
as $$
begin
  if new.created_by_user_id is null then
    raise exception 'businesses.created_by_user_id is required for operative access'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists businesses_require_owner_presence on public.businesses;
create trigger businesses_require_owner_presence
before insert or update on public.businesses
for each row
execute function public.enforce_business_owner_presence();

do $$
declare
  current_constraint_name text;
begin
  select conname
  into current_constraint_name
  from pg_constraint
  where conrelid = 'public.businesses'::regclass
    and contype = 'f'
    and confrelid = 'auth.users'::regclass
    and conkey = array[
      (
        select attnum
        from pg_attribute
        where attrelid = 'public.businesses'::regclass
          and attname = 'created_by_user_id'
      )
    ];

  if current_constraint_name is not null then
    execute format(
      'alter table public.businesses drop constraint %I',
      current_constraint_name
    );
  end if;
end $$;

alter table public.businesses
  add constraint businesses_created_by_user_id_fkey
  foreign key (created_by_user_id)
  references auth.users (id)
  on delete restrict;
