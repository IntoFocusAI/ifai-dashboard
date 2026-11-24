-- #status-alerts bot: state tables and the every-minute schedule for the `status-alerts` Edge Function.
--
-- Not dashboard work. It replaces the RSS app and Statuspage integrations in Slack #status-alerts
-- (C0BUN7UV2F7) with one bot ("Status Bot") that posts one message per vendor incident, threads
-- every update under it, and edits the first message when the incident is resolved. The dashboard
-- never reads these objects. Brian Watson applies it; no Brian Magazu approval is needed.
--
-- ADDITIVE: enables the pg_net extension, creates schema `ops` with four new tables, and adds one
-- pg_cron job. No existing object, row or permission is changed.
--
--   ops.status_feeds      one row per status page polled (seeded below; set enabled=false to mute)
--   ops.status_incidents  one row per incident; slack_ts = the top-level Slack message
--   ops.status_updates    one row per incident update already threaded (unique per update, so a
--                         retry can never post the same update twice)
--   ops.status_runs       one row per poll, for debugging (the function keeps 14 days)
--
-- `ops` is closed to the API roles (anon, authenticated) and has RLS on with no policies. The
-- function connects with its built-in SUPABASE_DB_URL, so `ops` never needs to be exposed in the
-- API settings.
--
-- Before applying, create two Vault secrets (SQL editor):
--   select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/status-alerts',
--                              'status_alerts_url');
--   select vault.create_secret('<long random string, same as the CRON_SECRET function secret>',
--                              'status_alerts_cron_secret');
-- and deploy the function first (supabase/functions/status-alerts/README.md). Until the secrets
-- exist the cron job runs but posts nothing (net.http_post gets a null URL and errors quietly).
--
-- Check after applying:
--   select key, enabled, seeded, last_ok_at, last_error from ops.status_feeds order by key;
--     -- 6 rows; after the first minute every row seeded = true, last_ok_at set, last_error null
--   select * from ops.status_runs order by id desc limit 5;   -- one row per minute, errors = []
--   select jobname, schedule, active from cron.job where jobname = 'status_alerts_poll';
--   select status_code, content from net._http_response order by id desc limit 3;  -- 200
--
-- Undo:
--   select cron.unschedule('status_alerts_poll');
--   drop schema ops cascade;
--   -- pg_net can stay (other features may use it later); to remove: drop extension pg_net;
--   -- Vault secrets: delete from vault.secrets where name in ('status_alerts_url','status_alerts_cron_secret');

begin;

create extension if not exists pg_net;

create schema if not exists ops;
revoke all on schema ops from public, anon, authenticated;

create table ops.status_feeds (
  key            text primary key,
  display_name   text not null,
  url            text not null,
  page_url       text not null,
  kind           text not null check (kind in ('statuspage', 'rss_xai')),
  enabled        boolean not null default true,
  seeded         boolean not null default false,
  etag           text,
  last_modified  text,
  last_ok_at     timestamptz,
  last_error     text,
  last_error_at  timestamptz
);
comment on table ops.status_feeds is
  'Status pages polled by the status-alerts Edge Function. seeded=false: next poll records existing incidents without posting.';

create table ops.status_incidents (
  id               bigint generated always as identity primary key,
  source           text not null references ops.status_feeds (key),
  incident_id      text not null,
  title            text not null,
  url              text not null,
  status           text not null,
  impact           text,
  opened_at        timestamptz not null,
  resolved_at      timestamptz,
  slack_ts         text,
  post_claimed_at  timestamptz,
  resolved_posted  boolean not null default false,
  first_seen_at    timestamptz not null default now(),
  last_seen_at     timestamptz not null default now(),
  unique (source, incident_id)
);
comment on column ops.status_incidents.slack_ts is
  'ts of the top-level Slack message; null when the incident was recorded quietly (seeding, or first seen already resolved).';
comment on column ops.status_incidents.resolved_posted is
  'true once the Resolved reply and parent edit were posted (or the incident was recorded already resolved).';

create table ops.status_updates (
  id              bigint generated always as identity primary key,
  source          text not null,
  incident_id     text not null,
  update_id       text not null,
  status          text,
  posted_at       timestamptz,
  slack_reply_ts  text,
  created_at      timestamptz not null default now(),
  unique (source, incident_id, update_id),
  foreign key (source, incident_id) references ops.status_incidents (source, incident_id) on delete cascade
);

create table ops.status_runs (
  id                bigint generated always as identity primary key,
  started_at        timestamptz not null default now(),
  finished_at       timestamptz,
  feeds_checked     int,
  feeds_unchanged   int,
  incidents_posted  int,
  updates_posted    int,
  resolved_posted   int,
  errors            jsonb
);
create index status_runs_started_at_idx on ops.status_runs (started_at);

alter table ops.status_feeds     enable row level security;
alter table ops.status_incidents enable row level security;
alter table ops.status_updates   enable row level security;
alter table ops.status_runs      enable row level security;
revoke all on all tables in schema ops from public, anon, authenticated;

insert into ops.status_feeds (key, display_name, url, page_url, kind) values
  ('cloudflare', 'Cloudflare', 'https://www.cloudflarestatus.com/api/v2/incidents.json', 'https://www.cloudflarestatus.com', 'statuspage'),
  ('claude',     'Claude',     'https://status.claude.com/api/v2/incidents.json',        'https://status.claude.com',        'statuspage'),
  ('github',     'GitHub',     'https://www.githubstatus.com/api/v2/incidents.json',     'https://www.githubstatus.com',     'statuspage'),
  ('cursor',     'Cursor',     'https://status.cursor.com/api/v2/incidents.json',        'https://status.cursor.com',        'statuspage'),
  ('openai',     'OpenAI',     'https://status.openai.com/api/v2/incidents.json',        'https://status.openai.com',        'statuspage'),
  ('xai',        'xAI',        'https://status.x.ai/feed.xml',                           'https://status.x.ai',              'rss_xai');

select cron.schedule(
  'status_alerts_poll',
  '* * * * *',
  $job$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'status_alerts_url'),
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets
                                                 where name = 'status_alerts_cron_secret')),
    body    := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
  $job$
);

commit;
