-- Changes: pauses the pg_cron job refresh_stock_loss (v1 Out of Stock). The job stays defined;
-- command.mv_listing_sales_loss and command.mv_listing_stock_episodes and their public views
-- (canvas_listing_sales_loss, canvas_listing_stock_episodes) stay as they are and stop refreshing.
--
-- Why: the dashboard reads the v2 views (sales_loss_v2, offer_state_v2) since pull request 100.
-- No code on main reads the v1 views, and no other view or function in the database depends on them.
--
-- Undo:
--   select cron.alter_job((select jobid from cron.job where jobname = 'refresh_stock_loss'), active := true);
--
-- Approved: Brian Watson, 4 Nov 2026 (dashboard sign-off from Brian Magazu).
-- Applied: prod, 4 Nov 2026, recorded in migration history as version 20261104153254.
-- Verified on prod after apply: cron.job refresh_stock_loss active = false.

select cron.alter_job(j.jobid, active := false)
from cron.job j where j.jobname = 'refresh_stock_loss';
