import { readdir, readFile } from "node:fs/promises";

const root = new URL("../supabase/", import.meta.url);
const migrations = (await readdir(new URL("migrations/", root)))
  .filter(name => /^\d+_[a-z_]+\.sql$/.test(name)).sort();
const schema = await readFile(new URL("schema.sql", root), "utf8");

const bootstrap = `
begin;
select pg_advisory_xact_lock(3018061001);
do $$
begin
  if to_regnamespace('auth') is not null
    or to_regclass('public.crm_workspaces') is not null
    or exists (select 1 from pg_roles where rolname in ('anon', 'authenticated', 'service_role', 'crm_intake', 'crm_app'))
  then
    raise exception 'Utilisez une instance PostgreSQL dédiée et vierge pour Helix CRM.';
  end if;
end $$;

create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create role crm_intake nologin;
create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(trim(email))),
  email_confirmed_at timestamptz
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
revoke all on schema auth from public;
grant usage on schema auth to authenticated, service_role;
create publication supabase_realtime;
`;

const changes = await Promise.all(migrations.map(async name => {
  const sql = await readFile(new URL("migrations/" + name, root), "utf8");
  // Les migrations existantes restent utilisables individuellement dans Supabase.
  return "-- " + name + "\n" + sql.replace(/^(?:begin|commit);[ \t]*$/gim, "");
}));

const access = await readFile(new URL("../postgres/access.sql", import.meta.url), "utf8");

process.stdout.write([bootstrap, schema, ...changes, access, `
grant usage on schema public to crm_intake;
grant execute on function public.crm_receive_site_contact(text,jsonb) to crm_intake;
commit;
`].join("\n"));
