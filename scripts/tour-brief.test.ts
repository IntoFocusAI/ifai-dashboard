// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/tour-brief.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import type { AiCallRow, AiSearchRead } from "../lib/ai-search/types.ts";
import type { FindabilityRead } from "../lib/findability/copy.ts";
import type { FindabilityRow } from "../lib/findability/outcomes.ts";
import { headlineSurface, type RetailCanvasRead } from "../lib/fender-canvas/portfolio-retail-display.ts";
import {
  mapLeakageFinding,
  suppressedListingsFinding,
  unnestedBundlesFinding,
  type SuppressionSupportRow,
} from "../lib/fender-canvas/portfolio-retail.ts";
import { buildLiveTourSteps, retailTourLines } from "../lib/fender-canvas/tour-from-live.ts";
import type { CanvasBundle } from "../lib/fender-canvas/types.ts";

/** About one rendered line in the 440px tour card at 12px. The e2e spec checks the real wrap. */
const ONE_LINE = 64;

const CHECKED_AT = new Date(Date.now() - 60_000).toISOString();

function offer(asin: string, overrides: Partial<SuppressionSupportRow> = {}): SuppressionSupportRow {
  return {
    asin,
    offer_price: 433.06,
    featured_offer_state: "withheld",
    featured_offer_withheld: true,
    featured_offer_source: "keepa",
    featured_offer_checked_at: CHECKED_AT,
    featured_offer_attempted_at: CHECKED_AT,
    featured_offer_last_error: null,
    competitive_external_price_state: "present",
    competitive_price_threshold_cents: 37198,
    featured_offer_observed_price_cents: 43306,
    featured_offer_observed_shipping_cents: null,
    featured_offer_observed_seller: null,
    ...overrides,
  };
}

function unchecked(asin: string): SuppressionSupportRow {
  return offer(asin, {
    featured_offer_state: null,
    featured_offer_withheld: null,
    featured_offer_source: null,
    featured_offer_checked_at: null,
    featured_offer_attempted_at: null,
    competitive_external_price_state: null,
    competitive_price_threshold_cents: null,
    featured_offer_observed_price_cents: null,
  });
}

function retail(rows: SuppressionSupportRow[]): RetailCanvasRead {
  return {
    phase: "ready",
    snapshot: {
      suppressedListings: suppressedListingsFinding(rows),
      mapLeakage: mapLeakageFinding([]),
      unnestedBundles: unnestedBundlesFinding([]),
      amazonSpecGaps: { status: "unavailable", issueCount: null, missingMessage: "Not stored.", detail: null },
      headline: null,
    },
  };
}

const range = (n: number, prefix: string) => Array.from({ length: n }, (_, i) => `${prefix}${i}`);

/** 1,108 monitored listings, 973 with a current reading, 56 withheld with no outside price. */
const PARTIAL_RETAIL = retail([
  ...range(56, "W").map((asin) =>
    offer(asin, { competitive_external_price_state: null, competitive_price_threshold_cents: null }),
  ),
  ...range(917, "P").map((asin) =>
    offer(asin, { featured_offer_state: "present", featured_offer_withheld: false }),
  ),
  ...range(135, "U").map(unchecked),
]);

function call(id: number, partial: Partial<AiCallRow>): AiCallRow {
  return {
    id: `c${id}`,
    sim_id: id,
    audit_run_id: "run-a",
    engine: "chatgpt",
    model: "gpt",
    category: "acoustics",
    prompt: "best acoustic guitar under $500",
    prompt_key: `p${id}`,
    prompt_kind: "commercial",
    call_status: "answered",
    outcome: "competitor_win",
    primary_brand: "Yamaha",
    material_hallucination: "none",
    hallucination_evidence: null,
    root_cause: null,
    remediation_patch: null,
    error_message: null,
    attempt_no: 1,
    repeat_no: 1,
    created_at: "2026-11-03T20:00:00Z",
    ...partial,
  };
}

function aiReady(): AiSearchRead {
  let id = 0;
  const calls = [
    ...range(1263, "f").map(() => call(++id, { outcome: "fender_win", primary_brand: "Fender", category: "electric" })),
    ...range(1175, "y").map((_, i) => call(++id, { primary_brand: i % 3 === 0 ? "Taylor" : i % 3 === 1 ? "Yamaha" : "PRS" })),
    ...range(1385, "b").map(() =>
      call(++id, { prompt: "Fender Stratocaster vs Gibson Les Paul", outcome: "fender_win", primary_brand: "Fender" }),
    ),
  ];
  return {
    phase: "ready",
    snapshot: {
      run: {
        audit_run_id: "run-a",
        run_state: "partial",
        collector_version: "v11",
        prompt_set_hash: null,
        expected_calls: 12040,
        attempted_calls: calls.length,
        answered_calls: calls.length,
        error_calls: 0,
        started_at: "2026-11-03T20:00:00Z",
        completed_at: "2026-11-03T21:31:00Z",
        published_at: "2026-11-03T21:31:00Z",
        missing_calls: 12040 - calls.length,
      },
      calls,
      probes: [],
      citations: [],
    },
  };
}

function findabilityReady(): FindabilityRead {
  const rows = [
    ...range(82, "e").map(() => "exact_official_product"),
    ...range(1544, "f").map(() => "official_family_page"),
    ...range(333, "n").map(() => "completed_not_found"),
    ...range(8, "a").map(() => "ambiguous_candidate"),
    ...range(74, "u").map(() => "not_checked"),
  ].map((latest_state, i) => ({ asin: `A${i}`, latest_state }) as FindabilityRow);
  return { phase: "ready", rows, dealerBundleLoaded: false };
}

function bundle(overrides: Partial<CanvasBundle> = {}): CanvasBundle {
  return {
    missing: range(14, "m"),
    specPages: { pages: range(184, "s"), withSpecBlock: 0 },
    ...overrides,
  } as unknown as CanvasBundle;
}

const lines = (steps: ReturnType<typeof buildLiveTourSteps>) => steps.flatMap((step) => [...step.displays, step.value]);

test("every tour bullet and value line is one short line on a live-sized read", () => {
  const steps = buildLiveTourSteps(bundle(), PARTIAL_RETAIL, aiReady(), findabilityReady());
  assert.equal(steps.length, 7);
  for (const line of lines(steps)) {
    assert.ok(line.length <= ONE_LINE, `${line.length} chars: ${line}`);
  }
});

test("loading and failed reads stay one short line too", () => {
  for (const [retailRead, ai, findability] of [
    [{ phase: "loading" }, { phase: "loading" }, { phase: "loading" }],
    [{ phase: "error" }, { phase: "error", message: "timeout after 30s while reading the published run" }, { phase: "error", message: "x" }],
  ] as Array<[RetailCanvasRead, AiSearchRead, FindabilityRead]>) {
    for (const line of lines(buildLiveTourSteps(bundle(), retailRead, ai, findability))) {
      assert.ok(line.length <= ONE_LINE, `${line.length} chars: ${line}`);
    }
  }
  const failed = buildLiveTourSteps(bundle(), { phase: "error" }, { phase: "error", message: "x" }, { phase: "error", message: "x" });
  const text = lines(failed).join("\n");
  assert.match(text, /Retail headline: Not available\* \(retail read did not load\)/);
  assert.match(text, /AI run: Not available\* \(published run did not load\)/);
  assert.match(text, /Official pages: Not available\* \(findability read did not load\)/);
});

test("a partial Buy Box reading keeps the ticker's label and count, its asterisk, and its N of M", () => {
  const surface = headlineSurface(PARTIAL_RETAIL);
  assert.ok(surface.missingMessage, "fixture is a partial reading");
  assert.deepEqual(retailTourLines(PARTIAL_RETAIL), [`${surface.label}: ${surface.countLabel}* (973 of 1,108 read)`]);
  const tour = lines(buildLiveTourSteps(bundle(), PARTIAL_RETAIL)).join("\n");
  assert.doesNotMatch(tour, /Buy Box audit has a current reading/);
});

test("a finished reading is the ticker's label and count with no asterisk", () => {
  const done = retail([offer("W1"), offer("P1", { featured_offer_state: "present", featured_offer_withheld: false })]);
  const surface = headlineSurface(done);
  assert.equal(surface.missingMessage, null);
  assert.deepEqual(retailTourLines(done), [`${surface.label}: ${surface.countLabel}`]);
});

test("the short lines keep the live figures", () => {
  const steps = buildLiveTourSteps(bundle(), PARTIAL_RETAIL, aiReady(), findabilityReady());
  const step = (id: string) => steps.find((s) => s.nodeId === id)!.displays.join("\n");

  assert.match(step("hub"), /Unbranded: Fender\/Squier named most in 1,263 of 2,438 \(51\.8%\)/);
  assert.match(step("hub"), /Branded: Fender\/Squier named most in 1,385 of 1,385 \(100\.0%\)/);
  assert.equal(step("roadmap"), step("hub"));
  assert.match(step("aeo"), /^Partial run: 3,823 of 12,040 calls answered$/m);
  assert.match(step("competitors"), /^(Taylor|Yamaha) named most in 392 of 2,438 unbranded answers$/m);
  assert.match(step("competitors"), /^Acoustics: rivals out-mention Fender\/Squier in 1,175 of 1,175$/m);
  assert.match(step("competitors"), /^Acoustics leaders: /m);
  assert.match(step("specs"), /^184 of 184 fender\.com pages have no spec block$/m);
  assert.match(step("specs"), /^82 exact official product pages, 1,544 family pages$/m);
  assert.match(step("specs"), /^333 No Defensible Pages, 8 ambiguous, 74 unchecked$/m);
  assert.match(step("specs"), /^14 missing-field rows are on Amazon Specs$/m);
  assert.match(step("suggestions"), /Phase 1: .*est\./);
  assert.match(step("suggestions"), /Enterprise: .*est\./);
});

test("a failed missing-field read still says Not available* and names its source", () => {
  const failed = bundle({
    unavailable: { missing: { source: "canvas_spec_missing_fields", message: "x" } },
  } as Partial<CanvasBundle>);
  const specs = buildLiveTourSteps(failed).find((s) => s.nodeId === "specs")!;
  assert.ok(
    specs.displays.includes("Amazon Specs missing-field rows: Not available* (canvas_spec_missing_fields did not load)"),
  );
});
