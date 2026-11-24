-- R-15 decision (a), Brian Magazu, 23 Nov 2026 (Slack DM D0BTDQQDVJB, p1795465123295929): capture
-- the seller holding a withheld Amazon offer in the Buy Box read, for every client, so the
-- partner-led next step can name who to ask ("Ask <seller>, the authorized seller holding this
-- Amazon offer, to price it at the benchmark").
--
-- Where the seller comes from: when Amazon withholds the Buy Box there is no Buy Box seller
-- (featured_offer_observed_seller is null by design). The offer Amazon is withholding is the
-- lowest-landed live New offer, the same price the Featured Offer read stores as
-- featured_offer_observed_price_cents. Keepa's live offers (Toolbelt get_product_offers) list each
-- offer's sellerId, condition and landed price, so the Buy Box seller harvester now reads them for
-- withheld listings and stores the seller id(s) at that lowest landed price. Names come from the
-- client's sellers table, which the same harvester fills through Keepa get_seller.
--
-- ADDITIVE ONLY. Same columns and the same view, by name, for every client:
--   Columns (nullable, no default, so no existing row changes):
--     command.fmic_electric_catalog  (Fender)     withheld_offer_seller_ids text[],
--     ledlenser.catalog              (Ledlenser)  withheld_offer_landed_cents integer,
--                                                 withheld_offer_checked_at timestamptz
--   Views (security_invoker, SELECT to authenticated and service_role only, nothing for anon):
--     public.canvas_withheld_offer_sellers     (Fender)
--     ledlenser.canvas_withheld_offer_sellers  (Ledlenser)
-- The new columns inherit the tables' existing grants and RLS policies (client_read through
-- command.can_read_client_key). No existing table, column, view, function, policy or grant is
-- altered. Brian Magazu approved additive changes for this; an agent applies.
--
-- Writer: Toolbelt wrenches fender_buybox_seller_harvester (v7) and ledlenser_buybox_seller_harvester
-- (v2), same code. The Fender wrench writes these columns to production only; its sandbox, mirror
-- and claude copies do not have them.
--
-- Checks after applying:
--   1. Columns exist on both tables (6 rows):
--        select table_schema, table_name, column_name, data_type from information_schema.columns
--        where column_name like 'withheld_offer_%' order by 1, 2, 3;
--   2. Views run as the caller, anon cannot read them (no rows):
--        select c.oid::regclass from pg_class c where c.oid in (
--          'public.canvas_withheld_offer_sellers'::regclass, 'ledlenser.canvas_withheld_offer_sellers'::regclass)
--          and (has_table_privilege('anon', c.oid, 'select')
--               or not coalesce(c.reloptions @> array['security_invoker=true'], false));
--   3. The views read (empty until the harvester runs):
--        select count(*) from public.canvas_withheld_offer_sellers;
--        select count(*) from ledlenser.canvas_withheld_offer_sellers;
--
-- Undo (as the owner; the column drop alters existing tables, so Brian Watson applies it):
--   begin;
--   drop view if exists public.canvas_withheld_offer_sellers, ledlenser.canvas_withheld_offer_sellers;
--   alter table command.fmic_electric_catalog drop column if exists withheld_offer_seller_ids,
--     drop column if exists withheld_offer_landed_cents, drop column if exists withheld_offer_checked_at;
--   alter table ledlenser.catalog drop column if exists withheld_offer_seller_ids,
--     drop column if exists withheld_offer_landed_cents, drop column if exists withheld_offer_checked_at;
--   delete from supabase_migrations.schema_migrations where version = '20261123210000';
--   commit;
--   notify pgrst, 'reload schema';
-- Roll the two harvester wrenches back to Fender v6 / Ledlenser v1 first (saved in
-- docs/toolbelt-wrenches/), or their next run fails on the missing columns.

begin;

set local lock_timeout = '5s';

alter table command.fmic_electric_catalog
  add column if not exists withheld_offer_seller_ids text[],
  add column if not exists withheld_offer_landed_cents integer,
  add column if not exists withheld_offer_checked_at timestamptz;

alter table ledlenser.catalog
  add column if not exists withheld_offer_seller_ids text[],
  add column if not exists withheld_offer_landed_cents integer,
  add column if not exists withheld_offer_checked_at timestamptz;

do $$
declare t text;
begin
  foreach t in array array['command.fmic_electric_catalog', 'ledlenser.catalog'] loop
    execute format($c$comment on column %s.withheld_offer_seller_ids is
      'Seller id(s) holding the lowest-landed live New offer while Amazon withholds the Buy Box, read from Keepa live offers by the Buy Box seller harvester. More than one when sellers tie at that price. Empty when the read found no live New offer. NULL when never read.'$c$, t);
    execute format($c$comment on column %s.withheld_offer_landed_cents is
      'Landed price (item plus shipping) in cents of the offer in withheld_offer_seller_ids, from the same Keepa read. Compare with featured_offer_observed_price_cents on the Buy Box map row.'$c$, t);
    execute format($c$comment on column %s.withheld_offer_checked_at is
      'When the harvester last read the live offers of this withheld listing. Not written when the read failed.'$c$, t);
  end loop;
end $$;

-- One row per listing whose withheld offer was read. seller_names follows seller_ids, with NULL
-- where the sellers table has no name yet. The Featured Offer state is today's, so a listing that
-- is no longer withheld shows that instead of a stale seller.
create view public.canvas_withheld_offer_sellers with (security_invoker = true) as
select c.asin::text as asin,
       c.withheld_offer_seller_ids as seller_ids,
       array(
         select nullif(btrim(s.seller_name), '')
         from unnest(c.withheld_offer_seller_ids) with ordinality u(seller_id, ord)
         left join command.fmic_sellers s on s.seller_id::text = u.seller_id
         order by u.ord
       ) as seller_names,
       c.withheld_offer_landed_cents as landed_cents,
       c.withheld_offer_checked_at as checked_at,
       m.featured_offer_state,
       m.featured_offer_observed_price_cents
from command.fmic_electric_catalog c
left join command.fmic_retail_buybox_map m on m.asin::text = c.asin::text
where c.withheld_offer_checked_at is not null;

create view ledlenser.canvas_withheld_offer_sellers with (security_invoker = true) as
select c.asin::text as asin,
       c.withheld_offer_seller_ids as seller_ids,
       array(
         select nullif(btrim(s.seller_name), '')
         from unnest(c.withheld_offer_seller_ids) with ordinality u(seller_id, ord)
         left join ledlenser.sellers s on s.seller_id::text = u.seller_id
         order by u.ord
       ) as seller_names,
       c.withheld_offer_landed_cents as landed_cents,
       c.withheld_offer_checked_at as checked_at,
       m.featured_offer_state,
       m.featured_offer_observed_price_cents
from ledlenser.catalog c
left join ledlenser.retail_buybox_map m on m.asin::text = c.asin::text
where c.withheld_offer_checked_at is not null;

comment on view public.canvas_withheld_offer_sellers is
  'R-15 (a): the seller(s) holding each Fender listing''s withheld Amazon offer (lowest-landed live New offer), from the Buy Box seller harvester.';
comment on view ledlenser.canvas_withheld_offer_sellers is
  'R-15 (a): the seller(s) holding each Ledlenser listing''s withheld Amazon offer (lowest-landed live New offer), from the Buy Box seller harvester.';

do $$
declare v text;
begin
  foreach v in array array['public.canvas_withheld_offer_sellers', 'ledlenser.canvas_withheld_offer_sellers'] loop
    execute format('revoke all on table %s from public, anon, authenticated, service_role', v);
    execute format('grant select on table %s to authenticated, service_role', v);
  end loop;
end $$;

notify pgrst, 'reload schema';

commit;
