begin;
create table if not exists public.crm_login_limits(email text primary key,next_allowed_at timestamptz not null);
alter table public.crm_login_limits enable row level security;
revoke all on public.crm_login_limits from public,anon,authenticated;
create or replace function public.crm_claim_login(addr text) returns boolean language plpgsql security definer set search_path=public as $$
begin
 if not crm_email_allowed(addr) then return false;end if;
 insert into crm_login_limits(email,next_allowed_at) values(lower(addr),now()+interval '2 minutes')
 on conflict(email) do update set next_allowed_at=excluded.next_allowed_at where crm_login_limits.next_allowed_at<=now();
 return found;
end$$;
revoke all on function public.crm_claim_login(text) from public,anon,authenticated;
grant execute on function public.crm_claim_login(text) to service_role;
commit;
