// Worker 28.1: SC-03 Actuation expiry reminders to Slack #operations (decision 77). Threshold logic
// (30, 14, 3 days; once each per expiry date, even after a missed or repeated run) and message text.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  claimSql,
  dueReminders,
  dueThreshold,
  readableDate,
  recordsUrl,
  releaseSql,
  reminderText,
  slackPayload,
  type ReminderCandidate,
} from "../lib/fender-canvas/actuation-reminders.ts";

const row = (over: Partial<ReminderCandidate> = {}): ReminderCandidate => ({
  client_key: "fmic",
  factor: "P1",
  owner_name: "Jordan Lee",
  expires_on: "2026-12-16",
  sent_thresholds: [],
  ...over,
});

test("a reminder is due on the day each threshold is reached", () => {
  assert.equal(dueThreshold(30), 30);
  assert.equal(dueThreshold(14, [30]), 14);
  assert.equal(dueThreshold(3, [30, 14]), 3);
});

test("no reminder before 30 days left or once the program has expired", () => {
  assert.equal(dueThreshold(31), null);
  assert.equal(dueThreshold(90), null);
  assert.equal(dueThreshold(0), null);
  assert.equal(dueThreshold(-5), null);
});

test("a threshold already sent is not sent again on a re-run the same day or the days after", () => {
  assert.equal(dueThreshold(30, [30]), null);
  assert.equal(dueThreshold(29, [30]), null);
  assert.equal(dueThreshold(15, [30]), null);
  assert.equal(dueThreshold(13, [30, 14]), null);
  assert.equal(dueThreshold(2, [30, 14, 3]), null);
});

test("a missed run sends the nearest threshold reached, late, and never the wider one it passed", () => {
  // Missed the 30-day day: sent at 28.
  assert.equal(dueThreshold(28), 30);
  // Missed both 30 and 14: the 14-day reminder goes at 12 days left, not the 30-day one.
  assert.equal(dueThreshold(12), 14);
  assert.equal(dueThreshold(11, [14]), null);
  // Missed the 3-day day: sent at 1 day left.
  assert.equal(dueThreshold(1, [30, 14]), 3);
});

test("a program first seen inside a window gets one reminder, then the next threshold on time", () => {
  assert.equal(dueThreshold(10), 14);
  assert.equal(dueThreshold(3, [14]), 3);
});

test("dueReminders computes days left in UTC days and keeps only what is due, nearest first", () => {
  const due = dueReminders(
    [
      row({ factor: "P1", expires_on: "2026-12-16" }),
      row({ factor: "P2", expires_on: "2026-11-30", sent_thresholds: [30] }),
      row({ client_key: "ledlenser", factor: "P2", expires_on: "2026-11-19" }),
      row({ factor: "P2", expires_on: "2027-01-20" }),
      row({ client_key: "fmic", factor: "P1", expires_on: "2026-12-16", owner_name: "  " }),
      row({ client_key: "someone_else", factor: "P1" }),
    ],
    "2026-11-16",
  );
  assert.deepEqual(
    due.map((d) => [d.clientKey, d.factor, d.daysLeft, d.threshold]),
    [
      ["ledlenser", "P2", 3, 3],
      ["fmic", "P2", 14, 14],
      ["fmic", "P1", 30, 30],
    ],
  );
  assert.equal(due[0].brandName, "Ledlenser");
  assert.equal(due[0].client, "ledlenser");
});

test("a program verified again starts a fresh set of reminders for its new expiry date", () => {
  // The old expiry's thresholds were all sent; the new expiry date arrives with none.
  const renewed = row({ expires_on: "2027-02-14", sent_thresholds: [] });
  assert.deepEqual(
    dueReminders([renewed], "2027-01-15").map((d) => d.threshold),
    [30],
  );
});

test("the message names the client, factor, owner, expiry date and days left in plain words", () => {
  const [reminder] = dueReminders([row()], "2026-11-16");
  const text = reminderText(reminder);
  assert.match(text, /^Actuation reminder for Fender: 30 days left\./);
  assert.match(text, /Factor: Community response program \(P1\)/);
  assert.match(text, /Owner: Jordan Lee/);
  assert.match(text, /Expires: 16 Dec 2026/);
  assert.match(text, /points drop out of the Fender Actuation score/);
  assert.match(text, /https:\/\/ifai-dashboard\.netlify\.app\/dashboard\/actuation-records$/);
  assert.deepEqual(slackPayload(reminder), { text });
  // Brand voice: no contractions, em dashes or emojis.
  assert.doesNotMatch(text, /\b\w+'(t|s|re|ll|ve|d)\b|—|[\u{1F300}-\u{1FAFF}]/u);
});

test("one day left reads in the singular, and Ledlenser links to its own records page", () => {
  const [reminder] = dueReminders(
    [row({ client_key: "ledlenser", factor: "P2", owner_name: "Sam Ortiz", expires_on: "2026-11-17", sent_thresholds: [30, 14] })],
    "2026-11-16",
  );
  const text = reminderText(reminder, "https://example.test/");
  assert.match(text, /^Actuation reminder for Ledlenser: 1 day left\./);
  assert.match(text, /Factor: Publication and reviewer outreach program \(P2\)/);
  assert.match(text, /https:\/\/example\.test\/dashboard\/actuation-records\?client=ledlenser$/);
  assert.equal(recordsUrl("fender"), "https://ifai-dashboard.netlify.app/dashboard/actuation-records");
});

test("readableDate writes day, short month, year", () => {
  assert.equal(readableDate("2026-12-16"), "16 Dec 2026");
  assert.equal(readableDate("2027-01-05"), "5 Jan 2027");
});

test("claim and release SQL quote every value and name the threshold", () => {
  const [reminder] = dueReminders([row({ owner_name: "O'Brien" })], "2026-11-16");
  assert.equal(
    claimSql(reminder),
    "select public.actuation_expiry_reminder_claim('fmic', 'P1', date '2026-12-16', 30, 30);",
  );
  assert.equal(
    releaseSql(reminder),
    "select public.actuation_expiry_reminder_release('fmic', 'P1', date '2026-12-16', 30);",
  );
  assert.match(reminderText(reminder), /Owner: O'Brien/);
});

test("the workflow skips cleanly when the Slack webhook secret is missing", () => {
  const yml = readFileSync(new URL("../.github/workflows/actuation-reminders.yml", import.meta.url), "utf8");
  assert.match(yml, /SLACK_OPERATIONS_WEBHOOK_URL: \$\{\{ secrets\.SLACK_OPERATIONS_WEBHOOK_URL \}\}/);
  assert.match(yml, /::notice title=Actuation reminders skipped::SLACK_OPERATIONS_WEBHOOK_URL is not set/);
  assert.match(yml, /cron: "41 19 \* \* \*"/);
  // Every step after the check runs only when the secrets are there.
  const steps = yml.split("\n      - ").slice(2);
  for (const step of steps) assert.match(step, /if: steps\.secret\.outputs\.ready == 'true'/);
});
