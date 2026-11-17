/**
 * SC-03 Actuation expiry reminders to Slack #operations (decision 77). Pure: no reads, no clock, no
 * network. scripts/send-actuation-reminders.ts reads the candidates, claims each due reminder in
 * public.actuation_expiry_reminders_sent, and posts the text below. Staff only: clients never see
 * this (decision 78).
 *
 * Exactly once per threshold: the sent-log is keyed on (client, factor, expiry date, threshold), so a
 * re-run finds the claim and sends nothing, and a renewed program (new verification date, so a new
 * expiry date) starts a fresh set of reminders. A missed day does not lose a reminder: the due
 * threshold is the nearest one already reached, so a run at 12 days left sends the 14-day reminder.
 * A wider threshold passed over that way is not sent late (no "30 days" message at 12 days left).
 *
 * E2 and E3 lapse reminders (decision 103): each logged item counts for 90 days from its posted date.
 * For each client and each of E2 and E3 the job watches only the newest verified item, and reminds at
 * 30, 14 and 3 days before it stops counting, with the same thresholds and sent-log (keyed on the
 * lapse date, so a newer item logged later starts a fresh set). No owner: #operations owns them.
 *
 * Migration: supabase/migrations/20261116233000_actuation_expiry_reminders.sql.
 */

import { CLIENTS, clientHref, type ClientKey } from "@/lib/client/active-client";
import { ACTUATION_RECORDS_PATH, FACTOR_LABELS } from "@/lib/fender-canvas/actuation-records";
import {
  daysBetween,
  EXPIRY_REMINDER_DAYS,
  type ExpiryReminder,
  type ItemFactorId,
  type ProgramFactorId,
} from "@/lib/fender-canvas/actuation-score";

export const DEFAULT_DASHBOARD_URL = "https://ifai-dashboard.netlify.app";

/** One row of public.actuation_expiry_reminder_candidates(): an in-place P1 or P2 program. */
export type ReminderCandidate = {
  client_key: string;
  factor: ProgramFactorId;
  owner_name: string;
  expires_on: string;
  /** Thresholds already claimed for this client, factor and expiry date. */
  sent_thresholds: number[] | null;
};

export type DueReminder = {
  client: ClientKey;
  clientKey: string;
  brandName: string;
  factor: ProgramFactorId;
  ownerName: string;
  expiresOn: string;
  daysLeft: number;
  threshold: ExpiryReminder;
};

/** One row of public.actuation_lapse_reminder_candidates(): the newest verified E2 or E3 item. */
export type LapseCandidate = {
  client_key: string;
  factor: ItemFactorId;
  posted_on: string;
  /** The day that item stops counting: posted_on + 90. */
  lapses_on: string;
  /** Thresholds already claimed for this client, factor and lapse date. */
  sent_thresholds: number[] | null;
};

export type DueLapseReminder = {
  client: ClientKey;
  clientKey: string;
  brandName: string;
  factor: ItemFactorId;
  postedOn: string;
  /** The day the newest item stops counting; the sent-log keys on it as its expiry date. */
  expiresOn: string;
  daysLeft: number;
  threshold: ExpiryReminder;
};

/** What the sent-log needs to claim or release any reminder. */
type ClaimKey = { clientKey: string; factor: string; expiresOn: string; threshold: ExpiryReminder; daysLeft: number };

/**
 * The reminder due today for a program expiring in `daysLeft` days, or null. Due is the nearest
 * threshold already reached (daysLeft at or under it), while the program has not yet expired
 * (daysLeft at least 1), and only when neither that threshold nor a nearer one was sent.
 */
export function dueThreshold(daysLeft: number, sent: readonly number[] = []): ExpiryReminder | null {
  if (!Number.isInteger(daysLeft) || daysLeft < 1) return null;
  const reached = EXPIRY_REMINDER_DAYS.filter((band) => daysLeft <= band);
  if (reached.length === 0) return null;
  const nearest = Math.min(...reached) as ExpiryReminder;
  return sent.some((band) => band <= nearest) ? null : nearest;
}

function clientForKey(clientKey: string): ClientKey | null {
  const match = (Object.keys(CLIENTS) as ClientKey[]).find((key) => CLIENTS[key].setAsideKey === clientKey);
  return match ?? null;
}

/** The reminders due on `asOf` (UTC ISO date), nearest expiry first. Unknown clients are left out. */
export function dueReminders(candidates: readonly ReminderCandidate[], asOf: string): DueReminder[] {
  const due: DueReminder[] = [];
  for (const row of candidates) {
    const client = clientForKey(row.client_key);
    if (!client || (row.factor !== "P1" && row.factor !== "P2") || !row.owner_name?.trim()) continue;
    const daysLeft = daysBetween(asOf, row.expires_on);
    const threshold = dueThreshold(daysLeft, row.sent_thresholds ?? []);
    if (threshold == null) continue;
    due.push({
      client,
      clientKey: row.client_key,
      brandName: CLIENTS[client].brandName,
      factor: row.factor,
      ownerName: row.owner_name.trim(),
      expiresOn: row.expires_on,
      daysLeft,
      threshold,
    });
  }
  return due.sort(
    (a, b) => a.daysLeft - b.daysLeft || a.brandName.localeCompare(b.brandName) || a.factor.localeCompare(b.factor),
  );
}

/** The E2 and E3 lapse reminders due on `asOf`, nearest lapse first. Unknown clients are left out. */
export function dueLapseReminders(candidates: readonly LapseCandidate[], asOf: string): DueLapseReminder[] {
  const due: DueLapseReminder[] = [];
  for (const row of candidates) {
    const client = clientForKey(row.client_key);
    if (!client || (row.factor !== "E2" && row.factor !== "E3")) continue;
    const daysLeft = daysBetween(asOf, row.lapses_on);
    const threshold = dueThreshold(daysLeft, row.sent_thresholds ?? []);
    if (threshold == null) continue;
    due.push({
      client,
      clientKey: row.client_key,
      brandName: CLIENTS[client].brandName,
      factor: row.factor,
      postedOn: row.posted_on,
      expiresOn: row.lapses_on,
      daysLeft,
      threshold,
    });
  }
  return due.sort(
    (a, b) => a.daysLeft - b.daysLeft || a.brandName.localeCompare(b.brandName) || a.factor.localeCompare(b.factor),
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-12-16" to "16 Dec 2026". */
export function readableDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

function daysWord(n: number): string {
  return n === 1 ? "1 day" : `${n} days`;
}

/** The records page for the reminder's client, on the live dashboard. */
export function recordsUrl(client: ClientKey, baseUrl: string = DEFAULT_DASHBOARD_URL): string {
  return `${baseUrl.replace(/\/+$/, "")}${clientHref(client, ACTUATION_RECORDS_PATH)}`;
}

/** The Slack message: client, factor, owner, expiry date, days left, and what to do, in plain words. */
export function reminderText(reminder: DueReminder, baseUrl: string = DEFAULT_DASHBOARD_URL): string {
  const factor = `${FACTOR_LABELS[reminder.factor]} (${reminder.factor})`;
  return [
    `Actuation reminder for ${reminder.brandName}: ${daysWord(reminder.daysLeft)} left.`,
    `Factor: ${factor}`,
    `Owner: ${reminder.ownerName}`,
    `Expires: ${readableDate(reminder.expiresOn)}`,
    `The ${FACTOR_LABELS[reminder.factor].toLowerCase()} was last verified 90 days before that date. ` +
      `If nobody verifies it again by then, its points drop out of the ${reminder.brandName} Actuation score. ` +
      `To keep them, check that the program is still running and save a new evidence link and verification date: ` +
      recordsUrl(reminder.client, baseUrl),
  ].join("\n");
}

const ITEM_NOUN: Readonly<Record<ItemFactorId, { one: string; many: string }>> = {
  E2: { one: "response", many: "responses" },
  E3: { one: "placement", many: "placements" },
};

function titleCase(label: string): string {
  return label.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * The E2/E3 Slack message, for #operations with no named owner (decision 103), e.g. "Ledlenser:
 * Community Responses Posted. The newest logged response stops counting on 12 Feb (14 days). Log new
 * responses to keep these points." then the records page link.
 */
export function lapseReminderText(reminder: DueLapseReminder, baseUrl: string = DEFAULT_DASHBOARD_URL): string {
  const noun = ITEM_NOUN[reminder.factor];
  const day = readableDate(reminder.expiresOn).replace(/ \d{4}$/, "");
  return [
    `${reminder.brandName}: ${titleCase(FACTOR_LABELS[reminder.factor])}. ` +
      `The newest logged ${noun.one} stops counting on ${day} (${daysWord(reminder.daysLeft)}). ` +
      `Log new ${noun.many} to keep these points.`,
    recordsUrl(reminder.client, baseUrl),
  ].join("\n");
}

/** The Slack incoming-webhook body. */
export function slackPayload(reminder: DueReminder, baseUrl?: string): { text: string } {
  return { text: reminderText(reminder, baseUrl) };
}

export function lapseSlackPayload(reminder: DueLapseReminder, baseUrl?: string): { text: string } {
  return { text: lapseReminderText(reminder, baseUrl) };
}

function literal(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/** Reads every candidate as one JSON array. */
export const CANDIDATES_SQL =
  "select coalesce(json_agg(c), '[]'::json) from public.actuation_expiry_reminder_candidates() c;";

/** Reads the newest verified E2 and E3 item per client as one JSON array. */
export const LAPSE_CANDIDATES_SQL =
  "select coalesce(json_agg(c), '[]'::json) from public.actuation_lapse_reminder_candidates() c;";

/** Claims a reminder; prints t when this run claimed it, f when an earlier run already had. */
export function claimSql(reminder: ClaimKey): string {
  return (
    `select public.actuation_expiry_reminder_claim(${literal(reminder.clientKey)}, ${literal(reminder.factor)}, ` +
    `date ${literal(reminder.expiresOn)}, ${reminder.threshold}, ${reminder.daysLeft});`
  );
}

/** Gives a claim back after Slack refused the post, so the next run tries again. */
export function releaseSql(reminder: ClaimKey): string {
  return (
    `select public.actuation_expiry_reminder_release(${literal(reminder.clientKey)}, ${literal(reminder.factor)}, ` +
    `date ${literal(reminder.expiresOn)}, ${reminder.threshold});`
  );
}
