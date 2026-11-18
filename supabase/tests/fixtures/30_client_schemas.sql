-- Test-only model of the client schemas as hosted before 1.6: one object of each kind the lockdown
-- has to handle, with the hosted names where known and the hosted grants and policies. Structure
-- only; rows are made up in 90_test_accounts.sql. Not a migration. The full hosted inventory is
-- in the catalog snapshot (client-portal-pm docs/schema-snapshot/2026-11-18).

create schema command;
create schema canvas_private;
create schema ledlenser;
create schema ledlenser_private;
grant usage on schema command, ledlenser to anon, authenticated, service_role;
grant usage on schema canvas_private, ledlenser_private to service_role;

-- Dashboard sign-in table (not client data; left alone by 1.6).
create table command.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  is_platform_org boolean not null default false
);
alter table command.organizations enable row level security;
create policy organizations_select on command.organizations for select to authenticated using (true);
grant select on command.organizations to authenticated;

-- Dashboard staff check (hosted: command.organization_memberships in the platform org).
create table command.user_profiles (id uuid primary key, full_name text);
create table command.test_platform_admins (user_id uuid primary key);
create function command.is_intofocus_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from command.test_platform_admins where user_id = auth.uid())
$$;
grant execute on function command.is_intofocus_admin() to authenticated;

-- FMIC AI Search prompt tables (columns the prompt functions read).
create table command.fmic_ai_prompts (
  prompt_key text primary key, prompt_text text not null, category text not null,
  prompt_kind text not null default 'commercial', active boolean not null default true,
  created_at timestamptz not null default now());
create table command.fmic_audit_runs (
  id uuid primary key default gen_random_uuid(), run_kind text not null, collector_version text,
  is_published boolean not null default false, run_state text, started_at timestamptz default now(),
  metadata jsonb);
create table command.fmic_ai_simulations (id uuid primary key default gen_random_uuid(), prompt_key text);
alter table command.fmic_ai_prompts enable row level security;
create policy fmic_ai_prompts_read on command.fmic_ai_prompts for select to authenticated using (true);
grant select on command.fmic_ai_prompts, command.fmic_audit_runs to anon, authenticated;

-- FMIC: RLS on with a read-all policy for signed-in users, SELECT granted to anon too.
create table command.fmic_catalog (asin text primary key, title text not null, price numeric);
alter table command.fmic_catalog enable row level security;
create policy fmic_catalog_read on command.fmic_catalog for select to authenticated using (true);
grant select on command.fmic_catalog to anon, authenticated;

-- FMIC: a policy that lets anon read and a write policy that is literal true.
create table command.fmic_retail_buybox_map (asin text primary key, map_price numeric);
alter table command.fmic_retail_buybox_map enable row level security;
create policy map_read_anon on command.fmic_retail_buybox_map for select to anon, authenticated using (true);
create policy map_write_all on command.fmic_retail_buybox_map for update to authenticated using (true) with check (true);
grant select, update on command.fmic_retail_buybox_map to anon, authenticated;

-- FMIC: RLS off, not granted (read only through owner-rights views today).
create table command.fmic_ai_api_runs (run_id uuid primary key, engine text not null);

create materialized view command.mv_listing_sales_loss as
  select asin, price * 2 as lost_sales from command.fmic_catalog;
grant select on command.mv_listing_sales_loss to anon, authenticated;

create view canvas_private.ai_api_runs as select run_id, engine from command.fmic_ai_api_runs;

create view public.canvas_retail_listings with (security_invoker = false) as
  select asin, title, price from command.fmic_catalog;
create view public.canvas_retail_summary as
  select count(*) as listings from public.canvas_retail_listings;
create view public.canvas_listing_sales_loss as
  select m.asin, m.lost_sales from command.mv_listing_sales_loss m order by m.lost_sales desc;
create view public.canvas_listing_sales_loss_ids as
  select mv_listing_sales_loss.asin from command.mv_listing_sales_loss where mv_listing_sales_loss.lost_sales > 0;
create view public.canvas_ai_api_runs as select run_id, engine from canvas_private.ai_api_runs;
grant select on public.canvas_retail_listings, public.canvas_retail_summary,
  public.canvas_listing_sales_loss, public.canvas_listing_sales_loss_ids,
  public.canvas_ai_api_runs to anon, authenticated;

-- Ledlenser: RLS off, everything granted to anon (as hosted).
create table ledlenser.catalog (asin text primary key, title text not null);
create table ledlenser.ai_citations (id int primary key, url text not null);
create materialized view ledlenser.mv_listing_offer_state_v2 as select asin from ledlenser.catalog;
create view ledlenser_private.spec_latest as select asin, title from ledlenser.catalog;
create view ledlenser.canvas_catalog with (security_invoker = false) as select asin, title from ledlenser.catalog;
create view ledlenser.canvas_spec with (security_invoker = false) as select asin from ledlenser_private.spec_latest;
create view ledlenser.canvas_offer_state with (security_invoker = false) as
  select o.asin, c.title from ledlenser.mv_listing_offer_state_v2 o join ledlenser.catalog c on c.asin = o.asin;
grant select on all tables in schema ledlenser to anon, authenticated;

create function ledlenser.touch_updated_at() returns trigger language plpgsql security definer as $$
begin return new; end $$;
