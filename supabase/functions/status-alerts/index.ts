// status-alerts: polls vendor status pages and posts to Slack, one thread per incident.
//
// Called every minute by pg_cron (job `status_alerts_poll`, see
// supabase/migrations/20261124120000_ops_status_alerts.sql). State lives in the `ops` schema,
// reached over the function's built-in SUPABASE_DB_URL so `ops` never has to be exposed to the API.
//
// Env: SLACK_BOT_TOKEN, SLACK_CHANNEL_ID, CRON_SECRET (set as Edge Function secrets).
//
// Never double-posts: every Slack post is preceded by a database "claim" (an insert or a guarded
// update that only one run can win). If Slack refuses, the claim is released so the next run retries.

import postgres from "postgres";
import {
  type FeedKind,
  formatEt,
  openText,
  type ParsedIncident,
  parseFeed,
  reopenedReplyText,
  resolvedParentText,
  resolvedReplyText,
  updateText,
} from "./parse.ts";

const FETCH_TIMEOUT_MS = 10_000;
const MAX_AGE_DAYS = 7;
const USER_AGENT = "IntoFocus-status-alerts/1.0";

interface FeedRow {
  key: string;
  display_name: string;
  url: string;
  page_url: string;
  kind: FeedKind;
  etag: string | null;
  last_modified: string | null;
  seeded: boolean;
}

interface IncidentRow {
  id: number;
  slack_ts: string | null;
  post_claimed_at: Date | null;
  resolved_posted: boolean;
}

interface Counts {
  feeds_checked: number;
  feeds_unchanged: number;
  incidents_posted: number;
  updates_posted: number;
  resolved_posted: number;
}

function env(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}

// ---------- Slack ----------

async function slack(method: string, payload: Record<string, unknown>): Promise<{ ts: string }> {
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env("SLACK_BOT_TOKEN")}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({ unfurl_links: false, unfurl_media: false, ...payload }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (res.status === 429) throw new Error(`slack ${method}: rate limited`);
  const json = await res.json();
  if (!json.ok) throw new Error(`slack ${method}: ${json.error ?? res.status}`);
  return { ts: json.ts };
}

const post = (text: string, threadTs?: string) =>
  slack("chat.postMessage", { channel: env("SLACK_CHANNEL_ID"), text, thread_ts: threadTs });

const edit = (ts: string, text: string) => slack("chat.update", { channel: env("SLACK_CHANNEL_ID"), ts, text });

// ---------- Feed fetch ----------

async function fetchFeed(feed: FeedRow) {
  const headers: Record<string, string> = { "User-Agent": USER_AGENT };
  if (feed.etag) headers["If-None-Match"] = feed.etag;
  if (feed.last_modified) headers["If-Modified-Since"] = feed.last_modified;
  const res = await fetch(feed.url, { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (res.status === 304) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return {
    body: await res.text(),
    etag: res.headers.get("etag"),
    lastModified: res.headers.get("last-modified"),
  };
}

// ---------- Per-incident work ----------

type Sql = ReturnType<typeof postgres>;

/** Post the top-level message for an incident row we hold the claim on. */
async function postParent(sql: Sql, feed: FeedRow, rowId: number, inc: ParsedIncident, counts: Counts) {
  try {
    const { ts } = await post(openText(feed.display_name, inc));
    await sql`update ops.status_incidents set slack_ts = ${ts} where id = ${rowId}`;
    counts.incidents_posted++;
    return ts;
  } catch (e) {
    await sql`update ops.status_incidents set post_claimed_at = null where id = ${rowId}`;
    throw e;
  }
}

function isLive(inc: ParsedIncident): boolean {
  if (!inc.resolved) return true;
  const last = inc.resolvedAt ?? inc.updates.at(-1)?.at ?? inc.openedAt;
  return Date.now() - Date.parse(last) < MAX_AGE_DAYS * 86_400_000;
}

async function handleIncident(sql: Sql, feed: FeedRow, inc: ParsedIncident, counts: Counts) {
  const [existing] = await sql<IncidentRow[]>`
    select id, slack_ts, post_claimed_at, resolved_posted from ops.status_incidents
     where source = ${feed.key} and incident_id = ${inc.id}`;

  let row = existing;
  if (!row) {
    if (Date.now() - Date.parse(inc.openedAt) > MAX_AGE_DAYS * 86_400_000) return;
    // An incident first seen already resolved is recorded quietly.
    const silent = inc.resolved;
    [row] = await sql<IncidentRow[]>`
      insert into ops.status_incidents
        (source, incident_id, title, url, status, impact, opened_at, resolved_at, resolved_posted)
      values (${feed.key}, ${inc.id}, ${inc.title}, ${inc.url}, ${inc.status}, ${inc.impact},
              ${inc.openedAt}, ${inc.resolvedAt}, ${silent})
      on conflict (source, incident_id) do nothing
      returning id, slack_ts, post_claimed_at, resolved_posted`;
    if (!row) return; // another run inserted it this instant; it will handle it
    if (silent) {
      await recordUpdatesQuietly(sql, feed, inc);
      return;
    }
  } else {
    await sql`
      update ops.status_incidents
         set title = ${inc.title}, url = ${inc.url}, status = ${inc.status}, impact = ${inc.impact},
             resolved_at = ${inc.resolvedAt}, last_seen_at = now()
       where id = ${row.id}
         and (status is distinct from ${inc.status} or title is distinct from ${inc.title}
              or resolved_at is distinct from ${inc.resolvedAt})`;
  }

  // Which updates are new?
  const known = new Set(
    (await sql<{ update_id: string }[]>`
      select update_id from ops.status_updates where source = ${feed.key} and incident_id = ${inc.id}`)
      .map((r) => r.update_id),
  );
  const fresh = inc.updates.filter((u) => !known.has(u.id));
  const reopened = row.resolved_posted && !inc.resolved;
  const needsResolve = inc.resolved && !row.resolved_posted;
  if (fresh.length === 0 && !reopened && !needsResolve) return;

  // Make sure a thread exists. Claim the right to post it so two runs can't both post.
  let parentTs = row.slack_ts;
  if (!parentTs) {
    const [claimed] = await sql<{ id: number }[]>`
      update ops.status_incidents set post_claimed_at = now()
       where id = ${row.id} and slack_ts is null
         and (post_claimed_at is null or post_claimed_at < now() - interval '5 minutes')
      returning id`;
    if (!claimed) return; // another run is posting it
    parentTs = await postParent(sql, feed, row.id, inc, counts);
  }

  if (reopened) {
    const [won] = await sql<{ id: number }[]>`
      update ops.status_incidents set resolved_posted = false where id = ${row.id} and resolved_posted
      returning id`;
    if (won) {
      await post(reopenedReplyText(), parentTs);
      await edit(parentTs, openText(feed.display_name, inc));
    }
  }

  for (const u of fresh) {
    const [claimed] = await sql<{ id: number }[]>`
      insert into ops.status_updates (source, incident_id, update_id, status, posted_at)
      values (${feed.key}, ${inc.id}, ${u.id}, ${u.status}, ${u.at})
      on conflict (source, incident_id, update_id) do nothing
      returning id`;
    if (!claimed) continue;
    try {
      const { ts } = await post(updateText(u), parentTs);
      await sql`update ops.status_updates set slack_reply_ts = ${ts} where id = ${claimed.id}`;
      counts.updates_posted++;
    } catch (e) {
      await sql`delete from ops.status_updates where id = ${claimed.id}`;
      throw e;
    }
  }

  if (needsResolve) {
    const [won] = await sql<{ id: number }[]>`
      update ops.status_incidents set resolved_posted = true where id = ${row.id} and not resolved_posted
      returning id`;
    if (won) {
      const resolvedAt = inc.resolvedAt ?? inc.updates.at(-1)?.at ?? new Date().toISOString();
      try {
        await post(resolvedReplyText(resolvedAt), parentTs);
        await edit(parentTs, resolvedParentText(feed.display_name, inc, resolvedAt));
        counts.resolved_posted++;
      } catch (e) {
        await sql`update ops.status_incidents set resolved_posted = false where id = ${row.id}`;
        throw e;
      }
    }
  }
}

async function recordUpdatesQuietly(sql: Sql, feed: FeedRow, inc: ParsedIncident) {
  for (const u of inc.updates) {
    await sql`
      insert into ops.status_updates (source, incident_id, update_id, status, posted_at)
      values (${feed.key}, ${inc.id}, ${u.id}, ${u.status}, ${u.at})
      on conflict (source, incident_id, update_id) do nothing`;
  }
}

/** First run for a feed: remember what's already there without posting anything. */
async function seedFeed(sql: Sql, feed: FeedRow, incidents: ParsedIncident[]) {
  for (const inc of incidents) {
    await sql`
      insert into ops.status_incidents
        (source, incident_id, title, url, status, impact, opened_at, resolved_at, resolved_posted)
      values (${feed.key}, ${inc.id}, ${inc.title}, ${inc.url}, ${inc.status}, ${inc.impact},
              ${inc.openedAt}, ${inc.resolvedAt}, ${inc.resolved})
      on conflict (source, incident_id) do nothing`;
    await recordUpdatesQuietly(sql, feed, inc);
  }
  await sql`update ops.status_feeds set seeded = true where key = ${feed.key}`;
}

// ---------- Entry point ----------

Deno.serve(async (req) => {
  if (req.headers.get("authorization") !== `Bearer ${env("CRON_SECRET")}`) {
    return new Response("unauthorized", { status: 401 });
  }

  const sql = postgres(env("SUPABASE_DB_URL"), { prepare: false, max: 1 });
  const counts: Counts = {
    feeds_checked: 0,
    feeds_unchanged: 0,
    incidents_posted: 0,
    updates_posted: 0,
    resolved_posted: 0,
  };
  const errors: { feed: string; incident?: string; error: string }[] = [];
  const [{ id: runId }] = await sql<{ id: number }[]>`insert into ops.status_runs default values returning id`;

  try {
    const feeds = await sql<FeedRow[]>`
      select key, display_name, url, page_url, kind, etag, last_modified, seeded
        from ops.status_feeds where enabled order by key`;

    for (const feed of feeds) {
      counts.feeds_checked++;
      try {
        const fetched = await fetchFeed(feed);
        if (!fetched) {
          counts.feeds_unchanged++;
          continue;
        }
        const incidents = parseFeed(feed.kind, fetched.body, feed.page_url);
        if (!feed.seeded) {
          await seedFeed(sql, feed, incidents);
        } else {
          // Only incidents still open or active in the last week (feeds list up to ~200 old ones).
          // Oldest first, so the channel reads in order when several open at once.
          const live = incidents.filter(isLive).sort((a, b) => a.openedAt.localeCompare(b.openedAt));
          for (const inc of live) {
            try {
              await handleIncident(sql, feed, inc, counts);
            } catch (e) {
              errors.push({ feed: feed.key, incident: inc.id, error: String(e) });
            }
          }
        }
        // Save the cache headers only after the whole feed was processed cleanly,
        // so a failed incident is retried on the next run instead of hidden behind a 304.
        if (!errors.some((x) => x.feed === feed.key)) {
          await sql`
            update ops.status_feeds
               set etag = ${fetched.etag}, last_modified = ${fetched.lastModified},
                   last_ok_at = now(), last_error = null
             where key = ${feed.key}`;
        }
      } catch (e) {
        errors.push({ feed: feed.key, error: String(e) });
        await sql`update ops.status_feeds set last_error = ${String(e)}, last_error_at = now() where key = ${feed.key}`;
      }
    }
  } finally {
    await sql`
      update ops.status_runs
         set finished_at = now(), feeds_checked = ${counts.feeds_checked},
             feeds_unchanged = ${counts.feeds_unchanged}, incidents_posted = ${counts.incidents_posted},
             updates_posted = ${counts.updates_posted}, resolved_posted = ${counts.resolved_posted},
             errors = ${sql.json(errors)}
       where id = ${runId}`;
    await sql`delete from ops.status_runs where started_at < now() - interval '14 days'`;
    await sql.end();
  }

  console.log(`status-alerts ${formatEt(new Date().toISOString())}`, JSON.stringify({ ...counts, errors }));
  return Response.json({ ...counts, errors }, { status: errors.length ? 207 : 200 });
});
