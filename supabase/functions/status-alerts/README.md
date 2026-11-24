# status-alerts

Posts vendor status incidents to Slack #status-alerts as one bot ("Status Bot"):

- a new incident gets one top-level message: `🔴 *GitHub* · <link|title> · impact: minor`
- every update from the status page becomes a reply in that thread
- when the incident is resolved, a `✅ Resolved` reply is added and the top message is edited to
  `✅ RESOLVED · *GitHub* · title · lasted 1h 12m`
- if the provider reopens it, a reply says so and the top message goes back to 🔴

Not dashboard code. Feeds: Cloudflare, Claude, GitHub, Cursor, Supabase, Netlify, OpenAI (Statuspage-style
`/api/v2/incidents.json`) and xAI (`status.x.ai/feed.xml`). The list lives in `ops.status_feeds`;
set `enabled = false` to mute one, or insert a row to add a Statuspage-style page.

pg_cron calls the function every minute (job `status_alerts_poll`). State is in the `ops` schema
(migration `supabase/migrations/20261124120000_ops_status_alerts.sql`).

## Logos

Each feed's `icon_url` (migration `20261124130000_ops_status_alerts_logos.sql`) points at
`status-logos/<key>.png` in a public Storage bucket. Posts then show as "<Provider> Status" with that
logo. This needs the Slack scope `chat:write.customize` (add it under OAuth & Permissions, then
reinstall the app). To change a logo, upload a new file with the same name.

## How it avoids double posts and missed updates

- `ops.status_incidents` has one row per incident with the Slack `ts` of its top message.
- `ops.status_updates` has one row per update already threaded, unique on (source, incident, update).
  The row is inserted *before* the Slack post. If Slack refuses, the row is deleted so the next run
  retries. Two overlapping runs can't both win the insert.
- The resolve step is guarded the same way (`resolved_posted`).
- The first poll of each feed (`seeded = false`) records what's already on the page without posting.
- An incident first seen already resolved is recorded without posting. With a one-minute poll, that
  only happens if the bot was down.
- A feed's ETag is saved only after all its incidents were handled cleanly, so a failure is retried
  instead of hidden behind a 304.
- Every run writes a row to `ops.status_runs` (counts + errors). Rows older than 14 days are deleted.

## Setup

1. **Slack app.** At api.slack.com/apps, choose Create New App → From a manifest → Intofocus AI:

   ```json
   {
     "display_information": {
       "name": "Status Bot",
       "description": "Vendor status incidents for #status-alerts, one thread per incident.",
       "background_color": "#1f2937"
     },
     "features": { "bot_user": { "display_name": "Status Bot", "always_online": true } },
     "oauth_config": { "scopes": { "bot": ["chat:write", "chat:write.public", "chat:write.customize"] } },
     "settings": { "org_deploy_enabled": false, "socket_mode_enabled": false, "token_rotation_enabled": false }
   }
   ```

   Upload an icon (Basic Information), install it, and copy the Bot User OAuth Token (`xoxb-…`).
   Keep token rotation off; a rotating token expires after 12 hours.

2. **Function secrets** (Supabase → Edge Functions → Secrets, or `supabase secrets set`):
   - `SLACK_BOT_TOKEN`: the `xoxb-…` token
   - `SLACK_CHANNEL_ID`: start with the test channel (`#status-alerts-test`), not #status-alerts
   - `CRON_SECRET`: a long random string, e.g. `openssl rand -hex 32`

   `SUPABASE_DB_URL` is provided to Edge Functions automatically.

3. **Deploy the function** (no JWT check; the function checks `CRON_SECRET` itself):

   ```sh
   supabase functions deploy status-alerts --no-verify-jwt --project-ref <project-ref>
   ```

4. **Vault secrets** for the cron job (SQL editor):

   ```sql
   select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/status-alerts', 'status_alerts_url');
   select vault.create_secret('<same value as CRON_SECRET>', 'status_alerts_cron_secret');
   ```

5. **Apply the migration** `20261124120000_ops_status_alerts.sql`. Within a minute every feed in
   `ops.status_feeds` shows `seeded = true` and `last_ok_at` set. Nothing is posted on that first
   run. The checks are at the top of the migration file.

6. **Test.** In the test channel, wait for a live incident, or replay one:

   ```sql
   -- mark one recent, resolved incident as never posted, so the next poll posts all of it.
   -- (Deleting the row doesn't work: an incident first seen already resolved is recorded quietly.)
   update ops.status_incidents set slack_ts = null, post_claimed_at = null, resolved_posted = false
    where source = 'github' and incident_id = '<id>';
   delete from ops.status_updates where source = 'github' and incident_id = '<id>';
   -- and forget the page's ETag, or an unchanged page is skipped (304) without reading it
   update ops.status_feeds set etag = null, last_modified = null where key = 'github';
   ```

   The next minute posts the top message, its updates in a thread, `✅ Resolved`, and the edit.

7. **Switch over.** Set `SLACK_CHANNEL_ID` to #status-alerts (`C0BUN7UV2F7`). Function secrets are
   read on every request, so no redeploy is needed. Then remove the RSS app feeds and the Statuspage
   subscriptions from #status-alerts.

## Local checks

```sh
cd supabase/functions/status-alerts
deno test --no-lock      # parsing + message text
deno check --no-lock index.ts
deno lint
```

## Rollback

- Pause: `select cron.alter_job((select jobid from cron.job where jobname = 'status_alerts_poll'), active := false);`
- Remove: see the Undo block in the migration, then `supabase functions delete status-alerts`.
- Re-enable the old RSS / Statuspage integrations in Slack if wanted.
