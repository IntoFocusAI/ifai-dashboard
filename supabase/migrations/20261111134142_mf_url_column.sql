-- Musician's Friend page link on the retail map.
--
-- Changes:
--   Adds one nullable column, command.fmic_retail_buybox_map.mf_url (text). Existing columns,
--   rows, views, and permissions are unchanged. The Toolbelt wrench
--   fender_map_checker_musiciansfriend (v15) fills it with the Musician's Friend product page it
--   matched, next to mf_price, and clears it with the other mf_* columns when a check finds no
--   match. The same column is added to the sandbox, mirror, and claude copies that the wrench
--   writes to.
--
-- Why: the checker found the page but had nowhere to keep it, so an MF price could not be traced
-- back to its listing. Additive. Approved by Brian Magazu, 11 Nov 2026, in Slack.
--
-- lock_timeout: ADD COLUMN takes a brief exclusive lock. If a long read holds the table, this
-- gives up after 2s instead of queueing every dashboard read behind it. Rerun if it times out.
--
-- Undo:
--   ALTER TABLE command.fmic_retail_buybox_map DROP COLUMN IF EXISTS mf_url;
--   Roll the wrench back to v14 first, or its writes will fail.
--
-- Applied: 11 Nov 2026 13:47 UTC on production, sandbox, mirror, and claude by Claude Code for Brian Watson.
-- Record only; already applied.
-- Applied with execute_sql, so production's supabase_migrations has no row for it; the file keeps the
-- version it was written under. Checked 11 Nov 2026: the column exists on production.

SET lock_timeout = '2s';

ALTER TABLE command.fmic_retail_buybox_map ADD COLUMN IF NOT EXISTS mf_url text;

COMMENT ON COLUMN command.fmic_retail_buybox_map.mf_url IS
  'Musician''s Friend product page matched by fender_map_checker_musiciansfriend. NULL when no match.';
