-- R-10 step 1: retailer list and retailer price checks as rows, per client. Plan:
-- docs/r10-retailer-rows-plan.md, approved as written by Brian Magazu on 23 Nov 2026 (Slack DM
-- D0BTDQQDVJB, thread 1795439336.677669, reply 1795459311.475879).
--
-- ADDITIVE ONLY. Creates new objects and fills only the new tables. Nothing existing is altered,
-- dropped or re-granted: the wmt_* / mf_* columns (including PR 244's *_last_matched_at and
-- *_miss_streak), canvas_retail_listings, canvas_metrics, listing_channel_price and the Ledlenser
-- trigger are untouched. Nothing on screen changes. Brian Magazu approved; an agent applies.
--
-- New objects
--   Fender (client_key fender):
--     command.retailers                     retailer list, staff-edited (migration only)
--     command.retail_price_observations     one row per check of one listing at one retailer
--     public.canvas_retailers               the list, for the screen
--     public.canvas_retail_prices           latest usable check per (asin, retailer), with MAP
--     public.canvas_retail_price_history    every check, newest first per listing
--     public.canvas_retailer_metrics        per retailer: checked, priced, below MAP
--   Ledlenser (client_key ledlenser):
--     ledlenser.retailers
--     ledlenser_private.retail_price_observations
--     ledlenser.canvas_retailers, canvas_retail_prices, canvas_retail_price_history,
--       canvas_retailer_metrics
--   private.reject_retail_observation_change()   trigger function: observations are append-only
--
-- Access, the same rules as the 1.6 lockdown (20261123130100):
--   * Tables: RLS on, one SELECT policy client_read for authenticated using
--     (select command.can_read_client_key('fender' | 'ledlenser')): staff
--     (command.is_intofocus_admin()) read both clients, an active member of the mapped command
--     org reads only their client. No policy and no grant for anon or PUBLIC.
--   * Grants are explicit; default privileges are not relied on (command's default ACL gives
--     service_role ALL, public's gives anon ALL). Each object first has ALL revoked from PUBLIC,
--     anon, authenticated and service_role, then:
--       retailers:     SELECT to authenticated and service_role. Edited by migration (owner) only.
--       observations:  SELECT to authenticated; SELECT, INSERT to service_role (step 2 writers).
--                      No UPDATE, DELETE or TRUNCATE for any non-owner role, and a trigger rejects
--                      UPDATE and DELETE from anyone but the table owner (postgres), so the history
--                      cannot be rewritten through the API or a writer login.
--       views:         security_invoker = true; SELECT to authenticated and service_role only.
--
-- Backfill: one observation per listing per retailer from today's columns, where the checker has
-- run (wmt_checked_at / mf_checked_at not null). source = 'backfill', collector =
-- 'r10_step1_backfill', observed_at = the stored check time, status 'priced' when the price is set,
-- else 'no_match'. Prices to cents; leakage is not stored (views compute price - MAP, which equals
-- today's wmt_leakage / mf_leakage on every row). The miss-streak columns are not copied: from
-- step 2 on, streaks can be derived from the observation rows, and the columns can go with the
-- step-4 column removal.
--
-- Checks after applying (expected values on 23 Nov 2026 in brackets; counts move as checkers run):
--   1. Retailer rows: command 4 (walmart, musicians-friend active MAP channels; sweetwater, reverb
--      inactive), ledlenser 1 (walmart).
--        select 'command', slug, active, map_channel from command.retailers
--        union all select 'ledlenser', slug, active, map_channel from ledlenser.retailers;
--   2. Backfill equals the columns (every diff 0):
--        select
--          (select count(*) from command.fmic_retail_buybox_map where wmt_checked_at is not null)
--          - (select count(*) from command.retail_price_observations where source='backfill' and retailer='walmart') f_wmt,
--          (select count(*) from command.fmic_retail_buybox_map where mf_checked_at is not null)
--          - (select count(*) from command.retail_price_observations where source='backfill' and retailer='musicians-friend') f_mf,
--          (select count(*) from ledlenser.retail_buybox_map where wmt_checked_at is not null)
--          - (select count(*) from ledlenser_private.retail_price_observations where source='backfill' and retailer='walmart') l_wmt;
--   3. Per-retailer metrics equal canvas_metrics' wmt_* / mf_* counts:
--        select * from public.canvas_retailer_metrics; select * from ledlenser.canvas_retailer_metrics;
--   4. Nothing new is readable by anon; views run as the caller (both must return no rows):
--        select c.oid::regclass from pg_class c where c.oid in (<the 12 new relations>)
--          and (has_table_privilege('anon', c.oid, 'select') or c.relkind = 'r' and not c.relrowsecurity
--               or c.relkind = 'v' and not coalesce(c.reloptions @> array['security_invoker=true'], false));
--   5. No non-owner role can change observations:
--        select r, has_table_privilege(r, 'command.retail_price_observations', 'update,delete,truncate')
--        from unnest(array['anon','authenticated','service_role']) r;   -- all false
--
-- Undo (drops only what this file created, backfilled rows included; nothing else depends on it):
--   begin;
--   drop view if exists public.canvas_retailer_metrics, public.canvas_retail_price_history,
--     public.canvas_retail_prices, public.canvas_retailers,
--     ledlenser.canvas_retailer_metrics, ledlenser.canvas_retail_price_history,
--     ledlenser.canvas_retail_prices, ledlenser.canvas_retailers;
--   drop table if exists command.retail_price_observations, ledlenser_private.retail_price_observations;
--   drop table if exists command.retailers, ledlenser.retailers;
--   drop function if exists private.reject_retail_observation_change();
--   delete from supabase_migrations.schema_migrations where version = '20261123170000';
--   commit;
--   notify pgrst, 'reload schema';

begin;

-- Append-only guard ---------------------------------------------------------------------------

create function private.reject_retail_observation_change() returns trigger
language plpgsql set search_path = '' as $$
begin
  -- The table owner (migrations, a deliberate thinning job) may still change rows.
  if current_user::regrole = (select c.relowner::regrole from pg_class c where c.oid = tg_relid) then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  raise exception 'retail price observations are append-only (% refused on %)', tg_op, tg_relid::regclass
    using errcode = '42501';
end $$;
comment on function private.reject_retail_observation_change() is
  'R-10: rejects UPDATE and DELETE on retail_price_observations unless run by the table owner.';
revoke all on function private.reject_retail_observation_change() from public, anon, authenticated, service_role;

-- Fender: command ------------------------------------------------------------------------------

create table command.retailers (
  slug text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  display_name text not null check (btrim(display_name) <> ''),
  domains text[] not null default '{}',
  map_channel boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table command.retailers is
  'R-10: Fender''s retailer list. Adding a retailer is one row, not a column. Staff edit it by migration; clients read it through public.canvas_retailers.';
comment on column command.retailers.slug is 'Lowercase with hyphens (walmart, musicians-friend). Observations reference it.';
comment on column command.retailers.domains is 'Hosts that belong to this retailer, used to place search results (R-15).';
comment on column command.retailers.map_channel is 'True when MAP is checked here and its prices count toward MAP violations.';
comment on column command.retailers.active is 'False hides the retailer without deleting its history.';
comment on column command.retailers.sort_order is 'Column order on screen.';

insert into command.retailers (slug, display_name, domains, map_channel, active, sort_order) values
  ('walmart', 'Walmart', array['walmart.com'], true, true, 10),
  ('musicians-friend', 'Musician''s Friend', array['musiciansfriend.com'], true, true, 20),
  ('sweetwater', 'Sweetwater', array['sweetwater.com'], false, false, 30),
  ('reverb', 'Reverb', array['reverb.com'], false, false, 40);

create table command.retail_price_observations (
  id bigint generated always as identity primary key,
  asin varchar(12) not null,
  retailer text references command.retailers (slug) on update cascade,
  domain text,
  observed_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  run_id text,
  collector text,
  status text not null check (status in ('priced', 'no_match', 'check_failed')),
  item_cents integer check (item_cents > 0),
  shipping_cents integer check (shipping_cents >= 0),
  msrp_cents integer check (msrp_cents > 0),
  url text,
  title text,
  seller text,
  condition text,
  match_confidence numeric(4,3) check (match_confidence between 0 and 1),
  source text not null check (source in ('retailer_checker', 'price_search', 'backfill')),
  constraint retail_price_observations_priced_has_price check ((status = 'priced') = (item_cents is not null)),
  constraint retail_price_observations_has_place check (retailer is not null or (source = 'price_search' and domain is not null))
);
comment on table command.retail_price_observations is
  'R-10: one row per check of one Fender listing at one retailer. Append-only: an unchanged price still gets a row, so the rows are the MAP history (R-09). Writers: retailer checkers (source retailer_checker), R-15 price search (price_search), and the 23 Nov 2026 backfill from the wmt_*/mf_* columns (backfill).';
comment on column command.retail_price_observations.retailer is 'command.retailers slug. Null only for an R-15 search result from a seller not on the list, which is kept under its domain.';
comment on column command.retail_price_observations.domain is 'Host of the matched page (R-15 places results by command.retailers.domains).';
comment on column command.retail_price_observations.observed_at is 'When the retailer page was checked.';
comment on column command.retail_price_observations.recorded_at is 'When the row was written.';
comment on column command.retail_price_observations.run_id is 'Id of the job run that wrote the row (workflow execution or audit run id).';
comment on column command.retail_price_observations.collector is 'Job and version that wrote the row.';
comment on column command.retail_price_observations.status is 'priced (a matched page with a price), no_match (searched, nothing matched), check_failed (the check did not complete; says nothing about the price).';
comment on column command.retail_price_observations.item_cents is 'Shelf price in cents. Set exactly when status = priced.';
comment on column command.retail_price_observations.shipping_cents is 'Shipping in cents; null when unknown.';
comment on column command.retail_price_observations.msrp_cents is 'The retailer''s struck-through price, when shown.';
comment on column command.retail_price_observations.match_confidence is '0 to 1, from the checker''s match.';
create index retail_price_observations_asin_retailer_idx
  on command.retail_price_observations (asin, retailer, observed_at desc);
create index retail_price_observations_retailer_idx
  on command.retail_price_observations (retailer, observed_at desc);

create trigger retail_price_observations_append_only
  before update or delete on command.retail_price_observations
  for each row execute function private.reject_retail_observation_change();

-- Ledlenser: ledlenser (list) and ledlenser_private (observations), as in the plan ------------------

create table ledlenser.retailers (like command.retailers including all);
comment on table ledlenser.retailers is
  'R-10: Ledlenser''s retailer list. Adding a retailer is one row, not a column. Staff edit it by migration; clients read it through ledlenser.canvas_retailers.';
comment on column ledlenser.retailers.slug is 'Lowercase with hyphens (walmart). Observations reference it.';
comment on column ledlenser.retailers.domains is 'Hosts that belong to this retailer, used to place search results (R-15).';
comment on column ledlenser.retailers.map_channel is 'True when MAP is checked here and its prices count toward MAP violations.';
comment on column ledlenser.retailers.active is 'False hides the retailer without deleting its history.';
comment on column ledlenser.retailers.sort_order is 'Column order on screen.';

-- Musician's Friend stays off for Ledlenser (decision 3): Walmart only.
insert into ledlenser.retailers (slug, display_name, domains, map_channel, active, sort_order) values
  ('walmart', 'Walmart', array['walmart.com'], true, true, 10);

create table ledlenser_private.retail_price_observations (
  like command.retail_price_observations including defaults including constraints including identity including comments,
  primary key (id),
  foreign key (retailer) references ledlenser.retailers (slug) on update cascade
);
comment on table ledlenser_private.retail_price_observations is
  'R-10: one row per check of one Ledlenser listing at one retailer. Append-only: an unchanged price still gets a row, so the rows are the MAP history (R-09). Writers: retailer checkers (source retailer_checker), R-15 price search (price_search), and the 23 Nov 2026 backfill from the wmt_* columns (backfill).';
comment on column ledlenser_private.retail_price_observations.retailer is 'ledlenser.retailers slug. Null only for an R-15 search result from a seller not on the list, which is kept under its domain.';
comment on column ledlenser_private.retail_price_observations.domain is 'Host of the matched page (R-15 places results by ledlenser.retailers.domains).';
create index retail_price_observations_asin_retailer_idx
  on ledlenser_private.retail_price_observations (asin, retailer, observed_at desc);
create index retail_price_observations_retailer_idx
  on ledlenser_private.retail_price_observations (retailer, observed_at desc);

create trigger retail_price_observations_append_only
  before update or delete on ledlenser_private.retail_price_observations
  for each row execute function private.reject_retail_observation_change();

-- Table access ---------------------------------------------------------------------------------

do $$
declare r record;
begin
  for r in select * from (values
      ('command.retailers', 'fender', false),
      ('command.retail_price_observations', 'fender', true),
      ('ledlenser.retailers', 'ledlenser', false),
      ('ledlenser_private.retail_price_observations', 'ledlenser', true)) v(rel, client_key, writable)
  loop
    execute format('revoke all on table %s from public, anon, authenticated, service_role', r.rel);
    execute format('alter table %s enable row level security', r.rel);
    execute format('create policy client_read on %s for select to authenticated using ((select command.can_read_client_key(%L)))',
      r.rel, r.client_key);
    execute format('grant select on table %s to authenticated', r.rel);
    if r.writable then
      execute format('grant select, insert on table %s to service_role', r.rel);
    else
      execute format('grant select on table %s to service_role', r.rel);
    end if;
  end loop;
end $$;

-- Identity sequences: nothing beyond the owner (INSERT into an identity column needs no grant).
revoke all on sequence command.retail_price_observations_id_seq from public, anon, authenticated, service_role;
revoke all on sequence ledlenser_private.retail_price_observations_id_seq from public, anon, authenticated, service_role;

-- Backfill from today's columns ----------------------------------------------------------------

insert into command.retail_price_observations
  (asin, retailer, domain, observed_at, collector, status, item_cents, url, title, seller, match_confidence, source)
select b.asin, 'walmart', 'walmart.com', b.wmt_checked_at, 'r10_step1_backfill',
       case when b.wmt_price is not null then 'priced' else 'no_match' end,
       round(b.wmt_price * 100)::integer, b.wmt_url, b.wmt_title, b.wmt_seller,
       round(b.wmt_match_conf, 3), 'backfill'
from command.fmic_retail_buybox_map b
where b.wmt_checked_at is not null;

insert into command.retail_price_observations
  (asin, retailer, domain, observed_at, collector, status, item_cents, msrp_cents, url, title, source)
select b.asin, 'musicians-friend', 'musiciansfriend.com', b.mf_checked_at, 'r10_step1_backfill',
       case when b.mf_price is not null then 'priced' else 'no_match' end,
       round(b.mf_price * 100)::integer, nullif(round(b.mf_msrp * 100)::integer, 0), b.mf_url, b.mf_title, 'backfill'
from command.fmic_retail_buybox_map b
where b.mf_checked_at is not null;

insert into ledlenser_private.retail_price_observations
  (asin, retailer, domain, observed_at, collector, status, item_cents, url, title, seller, match_confidence, source)
select b.asin, 'walmart', 'walmart.com', b.wmt_checked_at, 'r10_step1_backfill',
       case when b.wmt_price is not null then 'priced' else 'no_match' end,
       round(b.wmt_price * 100)::integer, b.wmt_url, b.wmt_title, b.wmt_seller,
       round(b.wmt_match_conf, 3), 'backfill'
from ledlenser.retail_buybox_map b
where b.wmt_checked_at is not null;

-- Read views (run as the caller) -----------------------------------------------------------------

create view public.canvas_retailers with (security_invoker = true) as
select slug, display_name, domains, map_channel, active, sort_order
from command.retailers;

-- Latest usable check per (asin, retailer). A check_failed row says nothing about the price, so
-- the latest priced or no_match row wins; last_attempt_at shows the latest attempt of any kind.
-- R-15 search rows (source price_search) are left out: they have their own view.
create view public.canvas_retail_prices with (security_invoker = true) as
with checks as (
  select o.* from command.retail_price_observations o
  where o.retailer is not null and o.source <> 'price_search'
), latest as (
  select distinct on (asin, retailer) *
  from checks where status in ('priced', 'no_match')
  order by asin, retailer, observed_at desc, id desc
), attempts as (
  select asin, retailer, max(observed_at) as last_attempt_at from checks group by asin, retailer
)
select l.asin, l.retailer, r.display_name, r.map_channel, r.active, r.sort_order,
       l.observed_at, a.last_attempt_at, l.status,
       l.item_cents, l.shipping_cents, l.msrp_cents,
       round(l.item_cents / 100.0, 2) as price,
       l.url, l.title, l.seller, l.condition, l.match_confidence, l.source,
       m.map_price,
       case when r.map_channel and l.status = 'priced' and m.map_price is not null
            then round(l.item_cents / 100.0, 2) - m.map_price end as leakage,
       coalesce(r.map_channel and l.status = 'priced' and m.map_price is not null
                and round(l.item_cents / 100.0, 2) < m.map_price, false) as is_below_map
from latest l
join command.retailers r on r.slug = l.retailer
join attempts a on a.asin = l.asin and a.retailer = l.retailer
left join lateral (
  select b.map_price from command.fmic_retail_buybox_map b
  where b.asin = l.asin order by b.updated_at desc limit 1
) m on true;

-- Every check, for the drill-down and R-09's violation duration. leakage is against the MAP
-- stored now (MAP itself has no history yet).
create view public.canvas_retail_price_history with (security_invoker = true) as
select o.id, o.asin, o.retailer, r.display_name, r.map_channel, o.domain,
       o.observed_at, o.status, o.item_cents, o.shipping_cents, o.msrp_cents,
       round(o.item_cents / 100.0, 2) as price,
       o.url, o.title, o.seller, o.condition, o.match_confidence,
       o.source, o.collector, o.run_id,
       m.map_price as current_map_price,
       case when r.map_channel and o.status = 'priced' and m.map_price is not null
            then round(o.item_cents / 100.0, 2) - m.map_price end as leakage_vs_current_map
from command.retail_price_observations o
left join command.retailers r on r.slug = o.retailer
left join lateral (
  select b.map_price from command.fmic_retail_buybox_map b
  where b.asin = o.asin order by b.updated_at desc limit 1
) m on true;

-- Per retailer: listings checked, priced and below MAP (the rows version of canvas_metrics'
-- wmt_checked / wmt_priced / wmt_leaks and mf_*).
create view public.canvas_retailer_metrics with (security_invoker = true) as
select r.slug as retailer, r.display_name, r.map_channel, r.active, r.sort_order,
       count(p.asin) as checked,
       count(p.asin) filter (where p.status = 'priced') as priced,
       count(p.asin) filter (where p.leakage < 0) as leaks,
       max(p.observed_at) as last_observed_at
from command.retailers r
left join public.canvas_retail_prices p on p.retailer = r.slug
group by r.slug, r.display_name, r.map_channel, r.active, r.sort_order;

create view ledlenser.canvas_retailers with (security_invoker = true) as
select slug, display_name, domains, map_channel, active, sort_order
from ledlenser.retailers;

create view ledlenser.canvas_retail_prices with (security_invoker = true) as
with checks as (
  select o.* from ledlenser_private.retail_price_observations o
  where o.retailer is not null and o.source <> 'price_search'
), latest as (
  select distinct on (asin, retailer) *
  from checks where status in ('priced', 'no_match')
  order by asin, retailer, observed_at desc, id desc
), attempts as (
  select asin, retailer, max(observed_at) as last_attempt_at from checks group by asin, retailer
)
select l.asin, l.retailer, r.display_name, r.map_channel, r.active, r.sort_order,
       l.observed_at, a.last_attempt_at, l.status,
       l.item_cents, l.shipping_cents, l.msrp_cents,
       round(l.item_cents / 100.0, 2) as price,
       l.url, l.title, l.seller, l.condition, l.match_confidence, l.source,
       m.map_price,
       case when r.map_channel and l.status = 'priced' and m.map_price is not null
            then round(l.item_cents / 100.0, 2) - m.map_price end as leakage,
       coalesce(r.map_channel and l.status = 'priced' and m.map_price is not null
                and round(l.item_cents / 100.0, 2) < m.map_price, false) as is_below_map
from latest l
join ledlenser.retailers r on r.slug = l.retailer
join attempts a on a.asin = l.asin and a.retailer = l.retailer
left join lateral (
  select b.map_price from ledlenser.retail_buybox_map b
  where b.asin = l.asin order by b.updated_at desc limit 1
) m on true;

create view ledlenser.canvas_retail_price_history with (security_invoker = true) as
select o.id, o.asin, o.retailer, r.display_name, r.map_channel, o.domain,
       o.observed_at, o.status, o.item_cents, o.shipping_cents, o.msrp_cents,
       round(o.item_cents / 100.0, 2) as price,
       o.url, o.title, o.seller, o.condition, o.match_confidence,
       o.source, o.collector, o.run_id,
       m.map_price as current_map_price,
       case when r.map_channel and o.status = 'priced' and m.map_price is not null
            then round(o.item_cents / 100.0, 2) - m.map_price end as leakage_vs_current_map
from ledlenser_private.retail_price_observations o
left join ledlenser.retailers r on r.slug = o.retailer
left join lateral (
  select b.map_price from ledlenser.retail_buybox_map b
  where b.asin = o.asin order by b.updated_at desc limit 1
) m on true;

create view ledlenser.canvas_retailer_metrics with (security_invoker = true) as
select r.slug as retailer, r.display_name, r.map_channel, r.active, r.sort_order,
       count(p.asin) as checked,
       count(p.asin) filter (where p.status = 'priced') as priced,
       count(p.asin) filter (where p.leakage < 0) as leaks,
       max(p.observed_at) as last_observed_at
from ledlenser.retailers r
left join ledlenser.canvas_retail_prices p on p.retailer = r.slug
group by r.slug, r.display_name, r.map_channel, r.active, r.sort_order;

comment on view public.canvas_retailers is 'R-10: Fender retailer list (command.retailers).';
comment on view public.canvas_retail_prices is 'R-10: latest priced or no_match check per Fender listing and retailer, with stored MAP and leakage = price - MAP on MAP channels. Excludes R-15 search rows.';
comment on view public.canvas_retail_price_history is 'R-10: every Fender retailer check. leakage_vs_current_map uses the MAP stored now.';
comment on view public.canvas_retailer_metrics is 'R-10: per Fender retailer, listings checked, priced and below MAP (latest check).';
comment on view ledlenser.canvas_retailers is 'R-10: Ledlenser retailer list (ledlenser.retailers).';
comment on view ledlenser.canvas_retail_prices is 'R-10: latest priced or no_match check per Ledlenser listing and retailer, with stored MAP and leakage = price - MAP on MAP channels. Excludes R-15 search rows.';
comment on view ledlenser.canvas_retail_price_history is 'R-10: every Ledlenser retailer check. leakage_vs_current_map uses the MAP stored now.';
comment on view ledlenser.canvas_retailer_metrics is 'R-10: per Ledlenser retailer, listings checked, priced and below MAP (latest check).';

do $$
declare v text;
begin
  foreach v in array array[
    'public.canvas_retailers', 'public.canvas_retail_prices', 'public.canvas_retail_price_history',
    'public.canvas_retailer_metrics', 'ledlenser.canvas_retailers', 'ledlenser.canvas_retail_prices',
    'ledlenser.canvas_retail_price_history', 'ledlenser.canvas_retailer_metrics']
  loop
    execute format('revoke all on table %s from public, anon, authenticated, service_role', v);
    execute format('grant select on table %s to authenticated, service_role', v);
  end loop;
end $$;

notify pgrst, 'reload schema';

commit;
