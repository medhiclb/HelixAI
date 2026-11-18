begin;
alter table public.crm_connections add column if not exists refresh_lock_id uuid;
alter table public.crm_connections add column if not exists refresh_locked_until timestamptz;
create or replace function public.crm_claim_token_refresh(c uuid,lock_id uuid) returns boolean language plpgsql security definer set search_path=public as $$
begin
 update crm_connections set refresh_lock_id=lock_id,refresh_locked_until=now()+interval '45 seconds'
 where id=c and (refresh_locked_until is null or refresh_locked_until<now());
 return found;
end$$;
create or replace function public.crm_release_token_refresh(c uuid,lock_id uuid) returns void language sql security definer set search_path=public as $$
 update crm_connections set refresh_lock_id=null,refresh_locked_until=null where id=c and refresh_lock_id=lock_id;
$$;
revoke all on function public.crm_claim_token_refresh(uuid,uuid),public.crm_release_token_refresh(uuid,uuid) from public,anon,authenticated;
grant execute on function public.crm_claim_token_refresh(uuid,uuid),public.crm_release_token_refresh(uuid,uuid) to service_role;
commit;
