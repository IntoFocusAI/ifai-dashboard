/**
 * One listing to land on when the Findability tab opens (FDD D-08). Brand-Site Specs
 * links a not-found row's Findability result here, matched by ASIN.
 * Kept in the spoke's `evidence` query parameter as `asin:<ASIN>`, so a copied link
 * reopens the same row. The AI Search evidence fields do not include `asin`, so those
 * tabs ignore it.
 */

import { EVIDENCE_PARAM } from "@/lib/ai-search/evidence-focus";
import type { FindabilityRead } from "@/lib/findability/copy";
import { findabilityOutcome, type FindabilityBucket } from "@/lib/findability/outcomes";

export const FINDABILITY_SPOKE_ID = "specs";
export const FINDABILITY_TAB = "Findability";

const PREFIX = "asin:";
const ASIN = /^[A-Za-z0-9]{1,20}$/;

export type FindabilityRowLink = {
  spokeId: typeof FINDABILITY_SPOKE_ID;
  tab: typeof FINDABILITY_TAB;
  asin: string;
  evidence: string;
};

export type FindabilityRowTarget = { asin: string; bucket: FindabilityBucket };

export function formatFindabilityRowFocus(asin: string): string {
  return `${PREFIX}${asin}`;
}

export function parseFindabilityRowFocus(raw: string | null | undefined): string | null {
  if (!raw?.startsWith(PREFIX)) return null;
  const asin = raw.slice(PREFIX.length).trim();
  return ASIN.test(asin) ? asin : null;
}

/** Where a listing's Findability result links. Null when the Findability read has no row for it. */
export function findabilityRowLink(asin: string, hasRow: boolean): FindabilityRowLink | null {
  const trimmed = asin.trim();
  if (!hasRow || !ASIN.test(trimmed)) return null;
  return {
    spokeId: FINDABILITY_SPOKE_ID,
    tab: FINDABILITY_TAB,
    asin: trimmed,
    evidence: formatFindabilityRowFocus(trimmed),
  };
}

/** The listing's row and the outcome table that holds it. Null when the read has no such row. */
export function findabilityRowTarget(read: FindabilityRead, asin: string | null): FindabilityRowTarget | null {
  if (!asin || read.phase !== "ready") return null;
  const row = read.rows.find((candidate) => candidate.asin === asin);
  return row ? { asin: row.asin, bucket: findabilityOutcome(row) } : null;
}

/** Undefined until the first read, which takes a copied link's row from the URL. */
let pending: string | null | undefined;

function readUrl(): string | null {
  if (typeof window === "undefined") return null;
  return parseFindabilityRowFocus(new URLSearchParams(window.location.search).get(EVIDENCE_PARAM));
}

function writeUrl(asin: string | null): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (asin) url.searchParams.set(EVIDENCE_PARAM, formatFindabilityRowFocus(asin));
  else if (parseFindabilityRowFocus(url.searchParams.get(EVIDENCE_PARAM))) url.searchParams.delete(EVIDENCE_PARAM);
  else return;
  window.history.replaceState(window.history.state, "", url);
}

/** Set on the click that opens the Findability tab, before the shell switches tabs. */
export function setFindabilityRowFocus(asin: string): void {
  pending = asin;
  writeUrl(asin);
}

/** The row the next Findability mount lands on, without taking it. */
export function peekFindabilityRowFocus(): string | null {
  if (pending === undefined) pending = readUrl();
  return pending;
}

/** Marks the landing done, so a later visit to the tab opens as usual. */
export function consumeFindabilityRowFocus(): void {
  pending = null;
}

/** A choice on the Findability tab replaces the landing. The URL stops naming that row. */
export function clearFindabilityRowFocus(): void {
  pending = null;
  writeUrl(null);
}
