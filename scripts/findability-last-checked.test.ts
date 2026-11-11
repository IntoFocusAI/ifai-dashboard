// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/findability-last-checked.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  findabilityCoverage,
  findabilityLastCheckedSentence,
  findabilityLastCheckedTip,
  findabilityStale,
  newestCheckedAttemptAt,
} from "../lib/findability/last-checked.ts";
import type { FindabilityRow } from "../lib/findability/outcomes.ts";

function row(partial: Partial<FindabilityRow> & Pick<FindabilityRow, "asin" | "latest_state">): FindabilityRow {
  return {
    title: partial.title ?? "Listing",
    category: partial.category ?? "Solid Body",
    product_kind: partial.product_kind ?? "instrument",
    latest_canonical_url: partial.latest_canonical_url ?? null,
    latest_variant_sku: partial.latest_variant_sku ?? null,
    confidence: partial.confidence ?? null,
    explanation: partial.explanation ?? null,
    source_method: partial.source_method ?? null,
    http_status: partial.http_status ?? null,
    latest_attempt_at: partial.latest_attempt_at ?? null,
    jsonld_status: partial.jsonld_status ?? "not_checked",
    counts_as_confirmed: partial.counts_as_confirmed ?? false,
    counts_as_finished_search: partial.counts_as_finished_search ?? false,
    counts_as_ambiguous: partial.counts_as_ambiguous ?? false,
    counts_as_unchecked: partial.counts_as_unchecked ?? false,
    counts_as_completed_not_found: partial.counts_as_completed_not_found ?? false,
    counts_as_blocked: partial.counts_as_blocked ?? false,
    counts_as_timeout: partial.counts_as_timeout ?? false,
    counts_as_parse_failure: partial.counts_as_parse_failure ?? false,
    counts_as_unsupported: partial.counts_as_unsupported ?? false,
    ...partial,
  };
}

/** Same timestamps as e2e/findability.spec.ts; newest checked is the ambiguous row. */
const E2E_FIXTURE: FindabilityRow[] = [
  row({
    asin: "B00ZEBRA",
    latest_state: "exact_official_product",
    latest_attempt_at: "2026-10-12T20:27:42.000Z",
    counts_as_confirmed: true,
    counts_as_finished_search: true,
  }),
  row({
    asin: "B00ALPHA",
    latest_state: "exact_official_product",
    latest_attempt_at: "2026-10-12T20:27:43.000Z",
    counts_as_confirmed: true,
    counts_as_finished_search: true,
  }),
  row({
    asin: "B00FAMILY",
    latest_state: "official_family_page",
    latest_attempt_at: "2026-10-12T20:27:44.000Z",
    counts_as_confirmed: true,
    counts_as_finished_search: true,
  }),
  row({
    asin: "B00BUNDLE1",
    latest_state: "completed_not_found",
    latest_attempt_at: "2026-10-12T20:27:45.000Z",
    counts_as_completed_not_found: true,
    counts_as_finished_search: true,
  }),
  row({
    asin: "B00AMBIG",
    latest_state: "ambiguous_candidate",
    latest_attempt_at: "2026-10-12T20:27:46.000Z",
    counts_as_ambiguous: true,
    counts_as_finished_search: true,
  }),
  row({
    asin: "B00UNCHECKED",
    latest_state: "not_checked",
    latest_attempt_at: null,
    counts_as_unchecked: true,
  }),
];

test("newest checked attempt is the e2e fixture ambiguous time", () => {
  assert.equal(newestCheckedAttemptAt(E2E_FIXTURE), "2026-10-12T20:27:46.000Z");
  assert.equal(
    findabilityLastCheckedSentence(newestCheckedAttemptAt(E2E_FIXTURE)),
    "Last checked Oct 12, 2026, 8:27 PM UTC.",
  );
});

test("an unchecked row with a later timestamp does not win", () => {
  const rows = [
    ...E2E_FIXTURE,
    row({
      asin: "B00LATER",
      latest_state: "not_checked",
      latest_attempt_at: "2026-11-01T12:00:00.000Z",
      counts_as_unchecked: true,
    }),
    row({
      asin: "B00BLANK",
      latest_state: null,
      latest_attempt_at: "2026-12-01T12:00:00.000Z",
      counts_as_unchecked: false,
    }),
  ];
  assert.equal(newestCheckedAttemptAt(rows), "2026-10-12T20:27:46.000Z");
});

test("all-null or unusable times return no time", () => {
  assert.equal(newestCheckedAttemptAt([]), null);
  assert.equal(
    newestCheckedAttemptAt([
      row({ asin: "U1", latest_state: "not_checked", latest_attempt_at: null, counts_as_unchecked: true }),
      row({
        asin: "E1",
        latest_state: "exact_official_product",
        latest_attempt_at: null,
        counts_as_confirmed: true,
        counts_as_finished_search: true,
      }),
      row({
        asin: "E2",
        latest_state: "exact_official_product",
        latest_attempt_at: "   ",
        counts_as_confirmed: true,
        counts_as_finished_search: true,
      }),
      row({
        asin: "E3",
        latest_state: "exact_official_product",
        latest_attempt_at: "not-a-date",
        counts_as_confirmed: true,
        counts_as_finished_search: true,
      }),
    ]),
    null,
  );
  assert.equal(findabilityLastCheckedSentence(null), null);
});

const NOW = Date.parse("2026-11-11T16:00:00.000Z");
const DAY = 86_400_000;
const at = (days: number) => new Date(NOW - days * DAY).toISOString();
const exact = (asin: string, attempt: string | null) =>
  row({ asin, latest_state: "exact_official_product", latest_attempt_at: attempt, counts_as_confirmed: true });

test("coverage counts each row's own check inside the 14-day window, not the newest check", () => {
  const rows = [
    exact("R1", at(0)),
    exact("R2", at(14)),
    exact("O1", at(14.01)),
    exact("O2", at(30)),
    exact("N1", null),
    row({ asin: "U1", latest_state: "not_checked", latest_attempt_at: at(1), counts_as_unchecked: true }),
  ];
  assert.deepEqual(findabilityCoverage(rows, NOW), { recent: 2, total: 6 });
  const stale = findabilityStale(rows, NOW);
  assert.ok(stale);
  assert.equal(stale.reason, "coverage");
  assert.equal(stale.missing, "4 of 6 listings have no official-page check in 14 days");
  assert.equal(
    findabilityLastCheckedTip(rows, NOW),
    "This is the newest official-page check. 2 of 6 listings checked in the last 14 days.",
  );
});

test("every row checked inside the window leaves the figures plain", () => {
  const rows = [exact("R1", at(0)), exact("R2", at(13))];
  assert.equal(findabilityStale(rows, NOW), null);
  assert.equal(findabilityStale([], NOW), null);
});
