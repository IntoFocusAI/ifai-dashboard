/**
 * SC-03 Actuation expiry reminders (decision 77). Once a day, for every in-place P1 or P2 program,
 * post one Slack message to #operations at 30, 14 and 3 days before its expiry. For E2 and E3
 * (decision 103), the same for the day each client's newest verified item stops counting. Run by
 * .github/workflows/actuation-reminders.yml; nobody runs it by hand.
 *
 *   node --experimental-strip-types --import ./scripts/register-alias.mjs \
 *     --import ./scripts/register-ts-extensions.mjs scripts/send-actuation-reminders.ts [--dry-run]
 *
 * Reads and claims go through psql on ACTUATION_REMINDER_DB_URL. Posts go to the Slack incoming
 * webhook in SLACK_OPERATIONS_WEBHOOK_URL. Without either the script prints why and ends cleanly.
 * Each reminder is claimed in the sent-log before it is posted; if Slack refuses the post the claim
 * is given back, so the next run tries again. --dry-run prints what is due and sends nothing.
 */
import { spawnSync } from "node:child_process";
import {
  CANDIDATES_SQL,
  claimSql,
  DEFAULT_DASHBOARD_URL,
  dueLapseReminders,
  dueReminders,
  LAPSE_CANDIDATES_SQL,
  lapseSlackPayload,
  releaseSql,
  slackPayload,
  type LapseCandidate,
  type ReminderCandidate,
} from "../lib/fender-canvas/actuation-reminders.ts";
import { isoDay } from "../lib/fender-canvas/actuation-score.ts";

const dryRun = process.argv.includes("--dry-run");
const dbUrl = process.env.ACTUATION_REMINDER_DB_URL?.trim() ?? "";
const webhook = process.env.SLACK_OPERATIONS_WEBHOOK_URL?.trim() ?? "";
const baseUrl = process.env.DASHBOARD_URL?.trim() || DEFAULT_DASHBOARD_URL;

if (!dbUrl) {
  console.log("ACTUATION_REMINDER_DB_URL is not set, so no Actuation records were read and no reminders were sent.");
  process.exit(0);
}
if (!dryRun && !webhook) {
  console.log("SLACK_OPERATIONS_WEBHOOK_URL is not set, so no Actuation reminders were sent.");
  process.exit(0);
}

function psql(sql: string): string {
  const result = spawnSync("psql", [dbUrl, "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1"], {
    input: sql,
    encoding: "utf8",
  });
  if (result.error || result.status !== 0) {
    throw new Error(result.error?.message ?? (result.stderr?.trim() || `psql exited ${result.status}`));
  }
  return result.stdout.trim();
}

const asOf = isoDay(new Date());
let candidates: ReminderCandidate[];
let lapseCandidates: LapseCandidate[];
try {
  candidates = JSON.parse(psql(CANDIDATES_SQL) || "[]") as ReminderCandidate[];
  lapseCandidates = JSON.parse(psql(LAPSE_CANDIDATES_SQL) || "[]") as LapseCandidate[];
} catch (error) {
  console.error(`The Actuation records could not be read: ${(error as Error).message}`);
  process.exit(1);
}

const due = [
  ...dueReminders(candidates, asOf).map((reminder) => ({
    reminder,
    label: `${reminder.brandName} ${reminder.factor}, expires ${reminder.expiresOn}, ${reminder.daysLeft} days left (${reminder.threshold}-day reminder)`,
    payload: slackPayload(reminder, baseUrl),
  })),
  ...dueLapseReminders(lapseCandidates, asOf).map((reminder) => ({
    reminder,
    label: `${reminder.brandName} ${reminder.factor}, newest item stops counting ${reminder.expiresOn}, ${reminder.daysLeft} days left (${reminder.threshold}-day reminder)`,
    payload: lapseSlackPayload(reminder, baseUrl),
  })),
];
console.log(
  `${asOf}: ${candidates.length} in-place programs, ${lapseCandidates.length} E2/E3 factors with a counting item, ${due.length} reminders due.`,
);

let failed = 0;
for (const { reminder, label, payload } of due) {
  if (dryRun) {
    console.log(`Would send: ${label}\n${payload.text}\n`);
    continue;
  }
  try {
    if (psql(claimSql(reminder)) !== "t") {
      console.log(`Already sent: ${label}`);
      continue;
    }
  } catch (error) {
    console.error(`Could not record ${label}: ${(error as Error).message}`);
    failed += 1;
    continue;
  }
  let posted = false;
  let reason = "";
  try {
    const response = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    posted = response.ok;
    reason = posted ? "" : `Slack answered ${response.status}`;
  } catch (error) {
    reason = (error as Error).message;
  }
  if (posted) {
    console.log(`Sent: ${label}`);
    continue;
  }
  failed += 1;
  console.error(`Not sent (${reason}): ${label}`);
  try {
    psql(releaseSql(reminder));
  } catch (error) {
    console.error(`The claim could not be given back, so this reminder will not be retried: ${(error as Error).message}`);
  }
}

// A reminder that could not be sent fails the run, so it shows in Actions.
process.exit(failed > 0 ? 1 : 0);
