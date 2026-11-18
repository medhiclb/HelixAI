begin;
create table public.crm_ai_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  requested_at timestamptz not null
);
alter table public.crm_ai_limits enable row level security;
revoke all on public.crm_ai_limits from public, anon, authenticated;
create function public.crm_claim_ai(actor uuid) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into crm_ai_limits as limits (user_id, requested_at) values (actor, now())
  on conflict (user_id) do update set requested_at = excluded.requested_at
  where limits.requested_at <= now() - interval '10 seconds';
  return found;
end $$;
revoke all on function public.crm_claim_ai(uuid) from public, anon, authenticated;
grant execute on function public.crm_claim_ai(uuid) to service_role;
commit;
