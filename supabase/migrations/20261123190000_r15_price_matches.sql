-- R-15: price matches for suppressed listings. Plan: docs/r15-price-match-plan.md, approved by
-- Brian Magazu on 23 Nov 2026 with changes (Slack DM D0BTDQQDVJB, reply 1795459311.475879):
-- withheld listings with a benchmark only; exact landed or item price; search on benchmark change
-- plus once a week; next step by the client's selling model; an ignore per listing through the
-- existing set-aside functions; "price match", never "cause"; unsure same-product checks under
-- their own heading.
--
-- ADDITIVE ONLY. Creates new tables and views and adds one row to each of two lookup tables.
-- Nothing existing is altered, dropped or re-granted. Builds on R-10 step 1
-- (20261123170000_r10_retailer_rows.sql): search results are rows in retail_price_observations
-- with source = 'price_search'. Brian Magazu approved; an agent applies.
--
-- New objects
--   Fender (client_key fender):
--     command.price_match_checks        one row per search of one listing (the benchmark searched,
--                                       how many offers, how many exact, kept and dropped)
--     command.price_match_results       one row per kept match: links a search to its observation
--                                       row, with the match kind and the same-product check
--     public.canvas_price_match_checks  latest search per listing, with today's benchmark
--     public.canvas_price_matches       the kept matches of each listing's latest search
--   Ledlenser (client_key ledlenser):
--     ledlenser_private.price_match_checks, ledlenser_private.price_match_results
--     ledlenser.canvas_price_match_checks, ledlenser.canvas_price_matches
--   Rows:
--     public.set_aside_checks  'price_match'        (the ignore: set aside / reopen on this check)
--     public.set_aside_reasons 'keep_amazon_price'  (offered on price_match only)
--
-- Access, the same rules as the 1.6 lockdown and R-10 step 1:
--   * Tables: RLS on, one SELECT policy client_read for authenticated using
--     (select command.can_read_client_key('fender' | 'ledlenser')). No policy or grant for anon or
--     PUBLIC. Each object first has ALL revoked from PUBLIC, anon, authenticated and service_role.
--   * Tables: SELECT to authenticated; SELECT, INSERT to service_role (the search job). No UPDATE,
--     DELETE or TRUNCATE for any non-owner role, and private.reject_retail_observation_change()
--     (from R-10 step 1) refuses UPDATE and DELETE from anyone but the table owner.
--   * Views: security_invoker = true; SELECT to authenticated and service_role only.
--
-- Checks after applying:
--   1. Nothing new is readable by anon; tables have RLS; views run as the caller (no rows):
--        select c.oid::regclass from pg_class c where c.oid in (
--          'command.price_match_checks'::regclass, 'command.price_match_results'::regclass,
--          'ledlenser_private.price_match_checks'::regclass, 'ledlenser_private.price_match_results'::regclass,
--          'public.canvas_price_match_checks'::regclass, 'public.canvas_price_matches'::regclass,
--          'ledlenser.canvas_price_match_checks'::regclass, 'ledlenser.canvas_price_matches'::regclass)
--          and (has_table_privilege('anon', c.oid, 'select') or c.relkind = 'r' and not c.relrowsecurity
--               or c.relkind = 'v' and not coalesce(c.reloptions @> array['security_invoker=true'], false));
--   2. No non-owner role can change the tables (all false):
--        select r, t, has_table_privilege(r, t, 'update,delete,truncate')
--        from unnest(array['anon','authenticated','service_role']) r,
--             unnest(array['command.price_match_checks','command.price_match_results',
--                          'ledlenser_private.price_match_checks','ledlenser_private.price_match_results']) t;
--   3. The ignore is wired: one row each.
--        select * from public.set_aside_checks where check_key = 'price_match';
--        select * from public.set_aside_reasons where reason_code = 'keep_amazon_price';
--   4. The views read (empty until the search job writes):
--        select count(*) from public.canvas_price_matches; select count(*) from ledlenser.canvas_price_matches;
--
-- Undo (drops only what this file created; search rows in retail_price_observations stay, since
-- that table is append-only history; delete them as the owner if wanted:
-- delete from command.retail_price_observations where source = 'price_search'):
--   begin;
--   drop view if exists public.canvas_price_matches, public.canvas_price_match_checks,
--     ledlenser.canvas_price_matches, ledlenser.canvas_price_match_checks;
--   drop table if exists command.price_match_results, command.price_match_checks,
--     ledlenser_private.price_match_results, ledlenser_private.price_match_checks;
--   -- Only if nothing was set aside on the check (issue_set_asides references it):
--   delete from public.set_aside_reasons where reason_code = 'keep_amazon_price';
--   delete from public.set_aside_checks where check_key = 'price_match';
--   delete from supabase_migrations.schema_migrations where version = '20261123190000';
--   commit;
--   notify pgrst, 'reload schema';

begin;

-- Fender: command ------------------------------------------------------------------------------

create table command.price_match_checks (
  id bigint generated always as identity primary key,
  asin varchar(12) not null,
  searched_at timestamptz not null default now(),
  run_id text,
  collector text,
  benchmark_cents integer not null check (benchmark_cents > 0),
  provider text not null check (btrim(provider) <> ''),
  query_type text not null check (query_type in ('title', 'upc')),
  query text,
  status text not null check (status in ('searched', 'failed')),
  result_count integer check (result_count >= 0),
  exact_count integer check (exact_count >= 0),
  kept_count integer check (kept_count >= 0),
  different_count integer check (different_count >= 0),
  error text
);
comment on table command.price_match_checks is
  'R-15: one row per price-match search of one withheld Fender listing at Amazon''s benchmark. Lets the screen say "searched, nothing at $X" rather than nothing. Append-only.';
comment on column command.price_match_checks.benchmark_cents is 'Amazon''s benchmark (competitive_price_threshold_cents) when the search ran.';
comment on column command.price_match_checks.provider is 'Where the offers came from, e.g. bing_shopping.';
comment on column command.price_match_checks.result_count is 'Offers read from the search.';
comment on column command.price_match_checks.exact_count is 'New-condition offers, other than Amazon, at exactly the benchmark (landed or item price).';
comment on column command.price_match_checks.kept_count is 'Exact offers kept after the same-product check (same or unsure), each a price_match_results row.';
comment on column command.price_match_checks.different_count is 'Exact offers dropped because the same-product check said they are a different product.';
create index price_match_checks_asin_idx on command.price_match_checks (asin, searched_at desc);

create table command.price_match_results (
  id bigint generated always as identity primary key,
  check_id bigint not null references command.price_match_checks (id),
  observation_id bigint not null references command.retail_price_observations (id),
  match_kind text not null check (match_kind in ('landed', 'item')),
  verdict text not null check (verdict in ('same', 'unsure')),
  verdict_reason text,
  verdict_by text not null check (btrim(verdict_by) <> ''),
  confidence numeric(4,3) check (confidence between 0 and 1),
  created_at timestamptz not null default now(),
  unique (check_id, observation_id)
);
comment on table command.price_match_results is
  'R-15: one row per offer that matched the benchmark exactly and passed the same-product check. The price, page and seller are on the observation row (source price_search). Append-only.';
comment on column command.price_match_results.match_kind is 'landed: item plus shipping equals the benchmark (Amazon compares landed prices). item: the item price alone does.';
comment on column command.price_match_results.verdict is 'Same-product check against the Amazon listing: same or unsure. Different is dropped, not stored.';
comment on column command.price_match_results.verdict_by is 'upc when a UPC on the offer settled it, otherwise the model that checked.';
create index price_match_results_check_idx on command.price_match_results (check_id);

create trigger price_match_checks_append_only
  before update or delete on command.price_match_checks
  for each row execute function private.reject_retail_observation_change();
create trigger price_match_results_append_only
  before update or delete on command.price_match_results
  for each row execute function private.reject_retail_observation_change();

-- Ledlenser: ledlenser_private ---------------------------------------------------------------------

create table ledlenser_private.price_match_checks (
  like command.price_match_checks including defaults including constraints including identity including comments,
  primary key (id)
);
comment on table ledlenser_private.price_match_checks is
  'R-15: one row per price-match search of one withheld Ledlenser listing at Amazon''s benchmark. Append-only.';
create index price_match_checks_asin_idx on ledlenser_private.price_match_checks (asin, searched_at desc);

create table ledlenser_private.price_match_results (
  like command.price_match_results including defaults including constraints including identity including comments,
  primary key (id),
  unique (check_id, observation_id),
  foreign key (check_id) references ledlenser_private.price_match_checks (id),
  foreign key (observation_id) references ledlenser_private.retail_price_observations (id)
);
comment on table ledlenser_private.price_match_results is
  'R-15: one row per Ledlenser offer that matched the benchmark exactly and passed the same-product check. Append-only.';
create index price_match_results_check_idx on ledlenser_private.price_match_results (check_id);

create trigger price_match_checks_append_only
  before update or delete on ledlenser_private.price_match_checks
  for each row execute function private.reject_retail_observation_change();
create trigger price_match_results_append_only
  before update or delete on ledlenser_private.price_match_results
  for each row execute function private.reject_retail_observation_change();

-- Table access ---------------------------------------------------------------------------------

do $$
declare r record;
begin
  for r in select * from (values
      ('command.price_match_checks', 'fender'),
      ('command.price_match_results', 'fender'),
      ('ledlenser_private.price_match_checks', 'ledlenser'),
      ('ledlenser_private.price_match_results', 'ledlenser')) v(rel, client_key)
  loop
    execute format('revoke all on table %s from public, anon, authenticated, service_role', r.rel);
    execute format('alter table %s enable row level security', r.rel);
    execute format('create policy client_read on %s for select to authenticated using ((select command.can_read_client_key(%L)))',
      r.rel, r.client_key);
    execute format('grant select on table %s to authenticated', r.rel);
    execute format('grant select, insert on table %s to service_role', r.rel);
  end loop;
end $$;

revoke all on sequence command.price_match_checks_id_seq from public, anon, authenticated, service_role;
revoke all on sequence command.price_match_results_id_seq from public, anon, authenticated, service_role;
revoke all on sequence ledlenser_private.price_match_checks_id_seq from public, anon, authenticated, service_role;
revoke all on sequence ledlenser_private.price_match_results_id_seq from public, anon, authenticated, service_role;

-- Read views (run as the caller) -----------------------------------------------------------------

-- Latest completed search per listing, the latest attempt of any kind, and today's benchmark.
-- A failed search says nothing about prices, so it does not hide the last good one.
create view public.canvas_price_match_checks with (security_invoker = true) as
with latest as (
  select distinct on (asin) *
  from command.price_match_checks where status = 'searched'
  order by asin, searched_at desc, id desc
), attempts as (
  select distinct on (asin) asin, searched_at as last_attempt_at, status as last_attempt_status
  from command.price_match_checks
  order by asin, searched_at desc, id desc
)
select a.asin, l.id as check_id, l.searched_at, a.last_attempt_at, a.last_attempt_status,
       l.benchmark_cents as search_benchmark_cents, b.competitive_price_threshold_cents as current_benchmark_cents,
       coalesce(l.benchmark_cents is distinct from b.competitive_price_threshold_cents, false) and l.id is not null
         as benchmark_changed,
       l.provider, l.query_type, l.result_count, l.exact_count, l.kept_count, l.different_count
from attempts a
left join latest l on l.asin = a.asin
left join lateral (
  select m.competitive_price_threshold_cents from command.fmic_retail_buybox_map m
  where m.asin = a.asin order by m.updated_at desc limit 1
) b on true;

-- The kept matches of each listing's latest completed search, one row per offer.
create view public.canvas_price_matches with (security_invoker = true) as
select c.asin, c.check_id, c.searched_at, c.search_benchmark_cents, c.current_benchmark_cents, c.benchmark_changed,
       o.retailer, r.display_name as retailer_name, o.domain, o.url, o.title, o.seller,
       o.item_cents, o.shipping_cents,
       case when o.shipping_cents is not null then o.item_cents + o.shipping_cents end as landed_cents,
       x.match_kind, x.verdict, x.verdict_reason, x.verdict_by, x.confidence, o.observed_at
from public.canvas_price_match_checks c
join command.price_match_results x on x.check_id = c.check_id
join command.retail_price_observations o on o.id = x.observation_id
left join command.retailers r on r.slug = o.retailer;

create view ledlenser.canvas_price_match_checks with (security_invoker = true) as
with latest as (
  select distinct on (asin) *
  from ledlenser_private.price_match_checks where status = 'searched'
  order by asin, searched_at desc, id desc
), attempts as (
  select distinct on (asin) asin, searched_at as last_attempt_at, status as last_attempt_status
  from ledlenser_private.price_match_checks
  order by asin, searched_at desc, id desc
)
select a.asin, l.id as check_id, l.searched_at, a.last_attempt_at, a.last_attempt_status,
       l.benchmark_cents as search_benchmark_cents, b.competitive_price_threshold_cents as current_benchmark_cents,
       coalesce(l.benchmark_cents is distinct from b.competitive_price_threshold_cents, false) and l.id is not null
         as benchmark_changed,
       l.provider, l.query_type, l.result_count, l.exact_count, l.kept_count, l.different_count
from attempts a
left join latest l on l.asin = a.asin
left join lateral (
  select m.competitive_price_threshold_cents from ledlenser.retail_buybox_map m
  where m.asin = a.asin order by m.updated_at desc limit 1
) b on true;

create view ledlenser.canvas_price_matches with (security_invoker = true) as
select c.asin, c.check_id, c.searched_at, c.search_benchmark_cents, c.current_benchmark_cents, c.benchmark_changed,
       o.retailer, r.display_name as retailer_name, o.domain, o.url, o.title, o.seller,
       o.item_cents, o.shipping_cents,
       case when o.shipping_cents is not null then o.item_cents + o.shipping_cents end as landed_cents,
       x.match_kind, x.verdict, x.verdict_reason, x.verdict_by, x.confidence, o.observed_at
from ledlenser.canvas_price_match_checks c
join ledlenser_private.price_match_results x on x.check_id = c.check_id
join ledlenser_private.retail_price_observations o on o.id = x.observation_id
left join ledlenser.retailers r on r.slug = o.retailer;

comment on view public.canvas_price_match_checks is 'R-15: latest price-match search per Fender listing, with the benchmark searched and today''s.';
comment on view public.canvas_price_matches is 'R-15: offers at exactly Amazon''s benchmark from each Fender listing''s latest search, after the same-product check. Price matches, not confirmed causes.';
comment on view ledlenser.canvas_price_match_checks is 'R-15: latest price-match search per Ledlenser listing, with the benchmark searched and today''s.';
comment on view ledlenser.canvas_price_matches is 'R-15: offers at exactly Amazon''s benchmark from each Ledlenser listing''s latest search, after the same-product check. Price matches, not confirmed causes.';

do $$
declare v text;
begin
  foreach v in array array[
    'public.canvas_price_match_checks', 'public.canvas_price_matches',
    'ledlenser.canvas_price_match_checks', 'ledlenser.canvas_price_matches']
  loop
    execute format('revoke all on table %s from public, anon, authenticated, service_role', v);
    execute format('grant select on table %s to authenticated, service_role', v);
  end loop;
end $$;

-- Ignore: a new check on the existing set-aside tables (set_aside_issue / reopen_set_aside) ------

insert into public.set_aside_checks (check_key, label, entity_type, surface, sort_order)
values ('price_match', 'Price match: keep the Amazon price', 'asin', 'Ecommerce · Suppressed · Price matches', 55);

insert into public.set_aside_reasons (reason_code, label, description, check_keys, requires_note, sort_order)
values ('keep_amazon_price', 'Brand keeps the Amazon price',
        'The brand chose not to lower the Amazon offer to the benchmark.', array['price_match'], false, 1);

notify pgrst, 'reload schema';

commit;
