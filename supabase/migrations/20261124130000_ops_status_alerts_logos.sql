-- #status-alerts bot: per-provider logos, plus Supabase and Netlify feeds.
--
-- Not dashboard work. Brian Watson applies it; no Brian Magazu approval is needed.
--
-- ADDITIVE:
--   * ops.status_feeds gets icon_url. When set, the bot posts as "<Provider> Status" with that
--     logo (Slack scope chat:write.customize; without the scope Slack ignores it).
--   * Two new feeds, supabase and netlify (Statuspage format). They start seeded = false, so
--     their first poll records what's already on the page without posting.
--   * A public Storage bucket status-logos (images only, 1 MB max) for the logo files.
--     Upload <key>.png for each feed: cloudflare, claude, github, cursor, openai, xai,
--     supabase, netlify. A missing file just shows Slack's default image.
--
-- Order: apply this BEFORE deploying the function version that reads icon_url
-- (the deployed function selects the column and would error without it).
--
-- Check after applying:
--   select key, display_name, seeded, icon_url from ops.status_feeds order by key;  -- 8 rows
--   select id, public from storage.buckets where id = 'status-logos';              -- true
--
-- Undo:
--   delete from ops.status_incidents where source in ('supabase', 'netlify');  -- cascades updates
--   delete from ops.status_feeds where key in ('supabase', 'netlify');
--   alter table ops.status_feeds drop column icon_url;
--   -- bucket: empty it in the Storage UI, then delete from storage.buckets where id = 'status-logos';

begin;

alter table ops.status_feeds add column icon_url text;
comment on column ops.status_feeds.icon_url is
  'Public image URL for this provider''s Slack posts (username "<display_name> Status"). Null = the app''s own icon.';

insert into ops.status_feeds (key, display_name, url, page_url, kind) values
  ('supabase', 'Supabase', 'https://status.supabase.com/api/v2/incidents.json',  'https://status.supabase.com',  'statuspage'),
  ('netlify',  'Netlify',  'https://www.netlifystatus.com/api/v2/incidents.json', 'https://www.netlifystatus.com', 'statuspage');

update ops.status_feeds
   set icon_url = 'https://qftczrlksczfimnzfiov.supabase.co/storage/v1/object/public/status-logos/' || key || '.png';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('status-logos', 'status-logos', true, 1048576, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

commit;
