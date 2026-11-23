/**
 * Weekly score save (decision 94). For every client, read what Summary → Performance reads, score it
 * with consensusFromLive (the cards' own function), and call public.canvas_score_snapshot_save once
 * per client through psql. Run by .github/workflows/score-snapshots.yml; nobody runs it by hand.
 *
 *   node --experimental-strip-types --import ./scripts/register-alias.mjs \
 *     --import ./scripts/register-ts-extensions.mjs scripts/save-score-snapshots.ts [--dry-run]
 *
 * Reads use NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, signed in as the read-only
 * review-bot (IFAI_REVIEW_EMAIL / IFAI_REVIEW_PASSWORD, PR 273), so row-level security treats the save
 * exactly like an Org User on each client's dashboard. Since the 23 Nov login lockdown a read without
 * that login returns no client data.
 * A client is saved only when every read loaded; a partial read would save a wrong score.
 * The save uses SCORE_SNAPSHOT_DB_URL. Without it the script prints why and ends without saving.
 * --dry-run prints each client's scores and the SQL, and writes nothing.
 */
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { clientProfile, listClientKeys } from "../lib/client/active-client.ts";
import { runWithClient } from "../lib/client/server-client.ts";
import { scoreSnapshotFromReads, snapshotSaveSql, weekStartUtc } from "../lib/fender-canvas/score-snapshot.ts";
import { loadScoreSnapshotReads } from "../lib/fender-canvas/score-snapshot-reads.ts";
import { runWithViewerToken } from "../lib/supabase/server-viewer-token.ts";

const dryRun = process.argv.includes("--dry-run");
const dbUrl = process.env.SCORE_SNAPSHOT_DB_URL?.trim() ?? "";

if (!dryRun && !dbUrl) {
  console.log("SCORE_SNAPSHOT_DB_URL is not set, so no scores were saved this week. Add the repository secret to turn the weekly save on.");
  process.exit(0);
}
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)) {
  console.log("NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is not set, so the scores could not be read. No scores were saved.");
  process.exit(dryRun ? 0 : 1);
}

const reviewEmail = process.env.IFAI_REVIEW_EMAIL?.trim() ?? "";
const reviewPassword = process.env.IFAI_REVIEW_PASSWORD ?? "";
if (!reviewEmail || !reviewPassword) {
  console.log("IFAI_REVIEW_EMAIL or IFAI_REVIEW_PASSWORD is not set. Since the login lockdown the reads need the review-bot login, so no scores were saved.");
  process.exit(dryRun ? 0 : 1);
}
const authClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const { data: signIn, error: signInError } = await authClient.auth.signInWithPassword({
  email: reviewEmail,
  password: reviewPassword,
});
const viewerToken = signIn.session?.access_token ?? null;
if (signInError || !viewerToken) {
  console.log(`The review-bot sign-in failed (${signInError?.message ?? "no session"}), so no scores were saved.`);
  process.exit(1);
}

const weekStart = weekStartUtc(new Date());
const commit = process.env.GITHUB_SHA ?? null;
const statements: string[] = [];
const skipped: string[] = [];

for (const key of listClientKeys()) {
  const client = clientProfile(key);
  // Read and score inside the client's scope: the brand name and the required spec fields the
  // formula uses come from the active client, as on that client's dashboard.
  const snapshot = await runWithViewerToken(viewerToken, () =>
    runWithClient(key, async () =>
      scoreSnapshotFromReads(client, weekStart, await loadScoreSnapshotReads(), { commit }),
    ),
  );
  if (!snapshot) {
    skipped.push(`${client.brandName}: the retail read did not load, so there is no score to save.`);
    continue;
  }
  const notLoaded = Object.entries(snapshot.inputs.reads as Record<string, string>).filter(([, phase]) => phase !== "ready");
  if (notLoaded.length > 0) {
    skipped.push(
      `${client.brandName}: ${notLoaded.map(([name, phase]) => `${name} ${phase}`).join(", ")}, so nothing was saved (a partial read would save a wrong score).`,
    );
    continue;
  }
  console.log(
    `${client.brandName} (${snapshot.clientKey}), week of ${weekStart}: consensus ${snapshot.consensus ?? "none"}, foundation ${snapshot.foundation ?? "none"}, commerce ${snapshot.commerce ?? "none"}, actuation ${snapshot.actuation ?? "not included"}. Reads: ${JSON.stringify(snapshot.inputs.reads)}`,
  );
  statements.push(snapshotSaveSql(snapshot));
}

for (const line of skipped) console.log(line);

if (dryRun) {
  console.log(statements.join("\n"));
  process.exit(0);
}

if (statements.length > 0) {
  const sql = ["\\set ON_ERROR_STOP on", "begin;", ...statements, "commit;"].join("\n");
  const result = spawnSync("psql", [dbUrl, "-X", "-q", "-v", "ON_ERROR_STOP=1"], { input: sql, encoding: "utf8" });
  if (result.error || result.status !== 0) {
    console.error(`The save failed: ${result.error?.message ?? result.stderr?.trim() ?? `psql exited ${result.status}`}`);
    process.exit(1);
  }
  console.log(`Saved ${statements.length} of ${listClientKeys().length} clients for the week of ${weekStart}.`);
}

// A client whose scores could not be read fails the run, so the missed week shows in Actions.
process.exit(skipped.length > 0 ? 1 : 0);
