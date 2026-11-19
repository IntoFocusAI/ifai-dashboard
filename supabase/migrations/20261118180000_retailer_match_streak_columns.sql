-- Retailer price drop-off rule (Brian Magazu, DM 18 Nov 2026 12:00 ET).
--
-- A matched Walmart or Musician's Friend price is dropped after 2 straight passes in which the
-- search returned results but none matched. Empty or failed searches don't count. The checkers
-- need to remember the last match and how many such misses have happened in a row.
--
-- Additive only: four new columns on command.fmic_retail_buybox_map, two on
-- ledlenser.retail_buybox_map. Existing rows get NULL / 0; no data changes. No view changes.
-- Needs Brian Magazu's approval (AGENTS.md). Apply to production, then the same statements to the
-- three Fender copies (sandbox, mirror, claude), because the Fender checkers mirror every write.
--
-- Writers (Toolbelt wrenches, new versions activated only after this is applied):
--   fender_retail_buybox_map_audit v15 (Walmart), fender_map_checker_musiciansfriend v18,
--   ledlenser_walmart_price_audit v7.
--
-- Undo:
--   alter table command.fmic_retail_buybox_map drop column wmt_last_matched_at, drop column wmt_miss_streak,
--     drop column mf_last_matched_at, drop column mf_miss_streak;
--   alter table ledlenser.retail_buybox_map drop column wmt_last_matched_at, drop column wmt_miss_streak;
--   (first re-activate the previous wrench versions: Walmart v14, MF v17, Ledlenser v6)

alter table command.fmic_retail_buybox_map
  add column if not exists wmt_last_matched_at timestamptz,
  add column if not exists wmt_miss_streak smallint not null default 0,
  add column if not exists mf_last_matched_at timestamptz,
  add column if not exists mf_miss_streak smallint not null default 0;

comment on column command.fmic_retail_buybox_map.wmt_last_matched_at is 'Last time the Walmart checker matched this listing. NULL = no match since 18 Nov 2026.';
comment on column command.fmic_retail_buybox_map.wmt_miss_streak is 'Walmart passes in a row with results but no match. At 2 the stored Walmart price is cleared. Empty or failed searches do not count.';
comment on column command.fmic_retail_buybox_map.mf_last_matched_at is 'Last time the Musician''s Friend checker matched this listing. NULL = no match since 18 Nov 2026.';
comment on column command.fmic_retail_buybox_map.mf_miss_streak is 'Musician''s Friend passes in a row with results but no match. At 2 the stored MF price is cleared. Empty or failed searches do not count.';

alter table ledlenser.retail_buybox_map
  add column if not exists wmt_last_matched_at timestamptz,
  add column if not exists wmt_miss_streak smallint not null default 0;

comment on column ledlenser.retail_buybox_map.wmt_last_matched_at is 'Last time the Walmart checker matched this listing. NULL = no match since 18 Nov 2026.';
comment on column ledlenser.retail_buybox_map.wmt_miss_streak is 'Walmart passes in a row with results but no match. At 2 the stored Walmart price is cleared. Empty or failed searches do not count.';
