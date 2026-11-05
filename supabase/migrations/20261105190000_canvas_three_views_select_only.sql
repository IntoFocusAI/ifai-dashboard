-- Changes: permissions on three existing views, public.canvas_issue_set_asides,
-- public.canvas_listing_offer_state_v2 and public.canvas_listing_sales_loss_v2. anon and
-- authenticated keep SELECT and lose every other right (INSERT, UPDATE, DELETE, TRUNCATE,
-- REFERENCES, TRIGGER, MAINTAIN). postgres and service_role keep what they have. The view
-- definitions and all data stay as they are. No screen change.
--
-- Why: 20261102170000_listing_sales_loss_v2 and 20261102190000_issue_set_asides created these views
-- and granted SELECT without a revoke first, so they kept Supabase's default grants for new public
-- views (anon=arwdDxtm, authenticated=arwdDxtm). Read on prod 5 Nov 2026: all three are
-- security_invoker=false, owned by postgres, and not updatable (pg_relation_is_updatable = 0), so
-- they cannot take a write today. A later change that made one of them a simple single-table view
-- would make it writable with the public key alone, running as the owner and skipping row-level
-- security. The dashboard only reads these views (lib/set-aside/set-aside.ts,
-- lib/fender-canvas/stock-loss.ts), so SELECT is all these roles need. Same pattern as
-- 20261104215427_canvas_set_aside_views_select_only (#125). After this, no view in public or
-- ledlenser gives anon more than SELECT.
--
-- Each DO block skips a database where that view does not exist, so the same file is safe on the
-- copies.
--
-- Undo (restores the previous grants):
--   GRANT ALL ON public.canvas_issue_set_asides TO anon, authenticated;
--   GRANT ALL ON public.canvas_listing_offer_state_v2 TO anon, authenticated;
--   GRANT ALL ON public.canvas_listing_sales_loss_v2 TO anon, authenticated;
--
-- Alters permissions on existing views: waits for Brian Watson to apply (AGENTS.md).
-- Applied: not yet.
--
-- How to verify after apply:
--   select c.relname, c.relacl::text from pg_class c join pg_namespace n on n.oid = c.relnamespace
--    where n.nspname = 'public'
--      and c.relname in ('canvas_issue_set_asides', 'canvas_listing_offer_state_v2', 'canvas_listing_sales_loss_v2');
--   Expect anon=r/postgres and authenticated=r/postgres; postgres and service_role unchanged.

DO $$
BEGIN
  IF to_regclass('public.canvas_issue_set_asides') IS NOT NULL THEN
    REVOKE ALL ON public.canvas_issue_set_asides FROM anon, authenticated;
    GRANT SELECT ON public.canvas_issue_set_asides TO anon, authenticated;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.canvas_listing_offer_state_v2') IS NOT NULL THEN
    REVOKE ALL ON public.canvas_listing_offer_state_v2 FROM anon, authenticated;
    GRANT SELECT ON public.canvas_listing_offer_state_v2 TO anon, authenticated;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.canvas_listing_sales_loss_v2') IS NOT NULL THEN
    REVOKE ALL ON public.canvas_listing_sales_loss_v2 FROM anon, authenticated;
    GRANT SELECT ON public.canvas_listing_sales_loss_v2 TO anon, authenticated;
  END IF;
END $$;
