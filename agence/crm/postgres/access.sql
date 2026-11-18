create role crm_app nologin;
grant usage on schema public to crm_app;

create table public.crm_native_links (
  digest text primary key,
  email text not null,
  expires_at timestamptz not null
);
create table public.crm_native_sessions (
  digest text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null
);
alter table public.crm_native_links enable row level security;
alter table public.crm_native_sessions enable row level security;

create function public.crm_native_request(addr text, link_digest text) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  addr := lower(trim(addr));
  if not crm_claim_login(addr) then return false; end if;
  delete from crm_native_links where expires_at <= now() or email = addr;
  insert into crm_native_links values (link_digest, addr, now() + interval '15 minutes');
  return true;
end $$;

create function public.crm_native_exchange(link_digest text, session_digest text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare addr text; identity_id uuid;
begin
  delete from crm_native_links where digest = link_digest and expires_at > now()
    returning email into addr;
  if addr is null or not crm_email_allowed(addr) then return null; end if;
  insert into auth.users(email,email_confirmed_at) values(addr,now())
    on conflict(email) do update set email_confirmed_at = coalesce(auth.users.email_confirmed_at, excluded.email_confirmed_at)
    returning id into identity_id;
  perform set_config('request.jwt.claim.sub', identity_id::text, true);
  perform crm_join_invitations();
  delete from crm_native_sessions where expires_at <= now();
  insert into crm_native_sessions values (session_digest, identity_id, now() + interval '7 days');
  return jsonb_build_object('id',identity_id,'email',addr);
end $$;

create function public.crm_native_user(session_digest text) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
  select jsonb_build_object('id',u.id,'email',u.email)
    from crm_native_sessions s join auth.users u on u.id=s.user_id
    where s.digest=session_digest and s.expires_at>now()
      and u.email_confirmed_at is not null and crm_email_allowed(u.email)
$$;

create function public.crm_native_signout(session_digest text) returns void
language sql security definer set search_path=public,pg_temp as $$
  delete from crm_native_sessions where digest=session_digest
$$;

revoke all on function public.crm_native_request(text,text), public.crm_native_exchange(text,text),
  public.crm_native_user(text), public.crm_native_signout(text) from public,anon,authenticated;
grant execute on function public.crm_native_request(text,text), public.crm_native_exchange(text,text),
  public.crm_native_user(text), public.crm_native_signout(text) to crm_app;

-- Types PostgreSQL et règles de visibilité du CRM restent les mêmes côté API.
grant authenticated to crm_app;
grant select on public.crm_workspaces, public.crm_members, public.crm_records,
  public.crm_messages, public.crm_busy_slots to authenticated;
