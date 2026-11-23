-- Guitar Center on Fender's retailer list, display only. Brian Magazu, 23 Nov 2026 (Slack DM
-- D0BTDQQDVJB, thread 1795465123.295929, answer c): "Guitar Center: yes, display only, and only on
-- Fender's list. Retailer lists are per client. Every client's list starts with Amazon and Walmart,
-- plus a placeholder for its own retailers. No client inherits another's."
--
-- ADDITIVE ONLY. Inserts one row into command.retailers (created by 20261123170000_r10_retailer_rows).
-- No table, column, view, function or grant is created, altered or dropped. ledlenser.retailers is
-- not touched: Guitar Center, Musician's Friend, Sweetwater and Reverb stay Fender-only.
--
-- Display only = map_channel false and active false, the same state as Sweetwater and Reverb:
--   * map_channel false: no MAP check runs there and its prices never count toward MAP violations.
--   * active false: no price column or checker on screen.
--   * domains: R-15's price search (Toolbelt wrench r15_price_match_search) places a result on
--     guitarcenter.com under this row, so the Price matches list shows "Guitar Center" instead of
--     the bare domain. canvas_price_matches joins retailers by slug without filtering on active.
-- No display-only column is needed: those two existing flags already say it.
--
-- Earlier R-15 rows for guitarcenter.com (written before this row existed) keep retailer null and
-- show under their domain until the listing's next weekly search writes new rows. Observations are
-- append-only, so they are not rewritten.
--
-- Starting set for a new client (no row here; written down so the next client schema copies it):
--   <client>.retailers gets exactly one row, walmart (display_name Walmart, domains {walmart.com},
--   map_channel true, active true, sort_order 10), like ledlenser.retailers. Amazon is not a row:
--   it is the home channel every client's MAP and Buy Box reads start from (settings `retailers`
--   lists "retailers other than Amazon"; the screen puts Amazon first). The client's own retailers
--   are added later as rows of its own (the placeholder), never copied from another client.
--
-- Checks after applying (expected on 23 Nov 2026):
--   select slug, display_name, domains, map_channel, active, sort_order from command.retailers order by sort_order;
--     -- walmart, musicians-friend (MAP channels), sweetwater, reverb, guitar-center (display only)
--   select slug from ledlenser.retailers;   -- walmart only
--
-- Undo (removes only this row; observations that reference it would block the delete, so first
-- check: select count(*) from command.retail_price_observations where retailer = 'guitar-center'):
--   begin;
--   delete from command.retailers where slug = 'guitar-center';
--   delete from supabase_migrations.schema_migrations where version = '20261123220000';
--   commit;

begin;

insert into command.retailers (slug, display_name, domains, map_channel, active, sort_order) values
  ('guitar-center', 'Guitar Center', array['guitarcenter.com'], false, false, 50);

commit;
