-- History trigger fixes (2026-10-27).
-- 1. fmic_keepa_stats keeps no change history: its values change on nearly every 2-hourly refresh,
--    and fmic_keepa_daily is the time series for them. The history table was created empty by
--    20261027160519 and is dropped only if it is still empty.
-- 2. fmic_listing_content history ignores bookkeeping columns, so a row is recorded only when the
--    listing itself changes. Before this, checked_at changed on every refresh and every listing
--    got a new history row every 2 hours (589 MB in the first week on prod).

DROP TRIGGER IF EXISTS trg_fmic_keepa_stats_history ON command.fmic_keepa_stats;

DO $$
BEGIN
  IF to_regclass('command.fmic_keepa_stats_history') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM command.fmic_keepa_stats_history) THEN
      RAISE EXCEPTION 'command.fmic_keepa_stats_history is not empty; not dropping it';
    END IF;
    DROP TABLE command.fmic_keepa_stats_history;
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_fmic_listing_content_history ON command.fmic_listing_content;
CREATE TRIGGER trg_fmic_listing_content_history AFTER INSERT OR UPDATE ON command.fmic_listing_content
  FOR EACH ROW EXECUTE FUNCTION command.fmic_capture_history('asin', 'updated_at', 'checked_at', 'keepa_last_update', 'raw_payload_ref', 'collector_version', 'content_checked_at', 'content_payload_ref');
