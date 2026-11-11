-- Rebuild the sandbox schema daily at 14:00 UTC, as the SANDBOX project does.
-- Production has not used pg_cron before; this enables it.
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'sandbox_reload_readings',
  '0 14 * * *',
  $$select sandbox.reload_readings('cl_fender')$$
);
