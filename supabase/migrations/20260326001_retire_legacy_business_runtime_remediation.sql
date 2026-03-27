drop trigger if exists businesses_sync_legacy_remediation_after_owner_assignment
  on public.businesses;

drop trigger if exists businesses_require_legacy_remediation_before_owner_assignment
  on public.businesses;

drop trigger if exists businesses_block_unsupported_legacy_owner_assignment
  on public.businesses;

drop function if exists public.sync_legacy_business_remediation_after_owner_assignment() cascade;
drop function if exists public.request_legacy_business_ownership_remediation(text) cascade;
drop function if exists public.grant_legacy_business_owner_claim(text, text) cascade;
drop function if exists public.claim_legacy_business_ownership(text) cascade;
drop function if exists public.list_current_user_legacy_business_ownership_remediations() cascade;
drop function if exists public.set_legacy_business_ownership_remediations_updated_at() cascade;
drop function if exists public.enforce_legacy_business_owner_assignment_via_remediation() cascade;

drop table if exists public.legacy_business_ownership_remediation_events cascade;
drop table if exists public.legacy_business_ownership_remediations cascade;

create or replace function public.prevent_unsupported_legacy_business_owner_assignment()
returns trigger
language plpgsql
as $$
begin
  if new.created_by_user_id is not distinct from old.created_by_user_id then
    return new;
  end if;

  if old.created_by_user_id is not null then
    raise exception 'business owner reassignment is not supported for the MVP'
      using errcode = '23514';
  end if;

  if new.created_by_user_id is not null then
    raise exception 'legacy businesses without owner are unsupported in the MVP and cannot be claimed or reassigned in runtime'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger businesses_block_unsupported_legacy_owner_assignment
before update of created_by_user_id on public.businesses
for each row
when (old.created_by_user_id is distinct from new.created_by_user_id)
execute function public.prevent_unsupported_legacy_business_owner_assignment();
