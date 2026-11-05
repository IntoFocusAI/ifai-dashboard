// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/story-deck.test.ts
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { aiSpokeDesc } from "../lib/ai-search/canvas-surfaces.ts";
import { utcDay } from "../lib/ai-search/history-eligibility.ts";
import { DEFAULT_HISTORY_MODE, historyControlLabel } from "../lib/ai-search/history-mode.ts";
import { roleRateLead, summarizeRun, BRANDED_RATE_BANDS, UNBRANDED_RATE_BANDS } from "../lib/ai-search/summary.ts";
import type { AiCallRow, AiSearchRead, AiSearchSnapshot } from "../lib/ai-search/types.ts";
import { briefingFindingsLead } from "../lib/fender-canvas/briefing-retail-lead.ts";
import { READ_NOT_AVAILABLE } from "../lib/fender-canvas/canvas-reads.ts";
import { formatRatio } from "../lib/fender-canvas/format.ts";
import { headlineSurface } from "../lib/fender-canvas/portfolio-retail-display.ts";
import {
  loadPortfolioRetailSnapshot,
  type CatalogBundleRow,
  type MapLeakageRow,
  type SuppressionSupportRow,
} from "../lib/fender-canvas/portfolio-retail.ts";
import type { RetailCanvasRead } from "../lib/fender-canvas/portfolio-retail-display.ts";
import { findabilityWidgetCopy, type FindabilityRead } from "../lib/findability/copy.ts";
import type { FindabilityRow } from "../lib/findability/outcomes.ts";
import {
  dashboardWindowLabel,
  DECK_PAGE,
  NO_RESOLVED_ANSWERS,
  storyDeck,
  STORY_DECK_PATH,
} from "../lib/story-deck/story-deck.ts";

const PUBLISHED_ID = "11111111-2222-4333-8444-555555555555";
const WINDOW_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

const CHECKED_AT = new Date(Date.now() - 60_000).toISOString();

function suppression(asin: string, withheld: boolean): SuppressionSupportRow {
  return {
    asin,
    offer_price: 200,
    featured_offer_state: withheld ? "withheld" : "present",
    featured_offer_withheld: withheld,
    featured_offer_source: "keepa",
    featured_offer_checked_at: CHECKED_AT,
    featured_offer_attempted_at: CHECKED_AT,
    featured_offer_last_error: null,
    competitive_external_price_state: "present",
    competitive_price_threshold_cents: 10000,
    featured_offer_observed_price_cents: withheld ? 20000 : 9000,
    featured_offer_observed_shipping_cents: null,
    featured_offer_observed_seller: null,
  };
}

function mapRow(leak: number): MapLeakageRow {
  return { map_price: 100, offer_price: 100 + leak, amz_leakage: leak, wmt_leakage: null, mf_leakage: null };
}

function bundleRow(asin: string, parent: string | null): CatalogBundleRow {
  return {
    asin,
    model_name: asin,
    title: null,
    bundle_name: null,
    parent_asin: parent,
    product_url: null,
    is_bundle: true,
    featured_offer_state: "present",
  };
}

async function retail(): Promise<RetailCanvasRead> {
  const snapshot = await loadPortfolioRetailSnapshot({
    suppressionRows: async () => ({
      ok: true,
      rows: [suppression("B0A", true), suppression("B0B", false)],
      truncated: false,
    }),
    mapRows: async () => ({ ok: true, rows: [mapRow(-10), mapRow(5), mapRow(0)], truncated: false }),
    catalogRows: async () => ({
      ok: true,
      rows: [bundleRow("B000000001", null), bundleRow("B000000002", "B0PARENT01")],
      truncated: false,
    }),
    catalogBundleCount: async () => 945,
    specRows: async () => ({
      ok: true,
      rows: [{ asin: "B0S", title: "S", amazon_checked: true, amazon_missing_fields: null }],
      truncated: false,
    }),
  });
  return { phase: "ready", snapshot };
}

function findabilityRow(asin: string, state: string): FindabilityRow {
  return {
    asin,
    title: "Listing",
    category: "Solid Body",
    product_kind: "instrument",
    latest_state: state,
    latest_canonical_url: null,
    latest_variant_sku: null,
    confidence: null,
    explanation: null,
    source_method: null,
    http_status: null,
    latest_attempt_at: null,
    jsonld_status: "not_checked",
    counts_as_confirmed: state === "exact_official_product",
    counts_as_finished_search: false,
    counts_as_ambiguous: false,
    counts_as_unchecked: false,
    counts_as_completed_not_found: state === "completed_not_found",
    counts_as_blocked: false,
    counts_as_timeout: false,
    counts_as_parse_failure: false,
    counts_as_unsupported: false,
  };
}

const findability: FindabilityRead = {
  phase: "ready",
  dealerBundleLoaded: true,
  rows: [
    findabilityRow("E1", "exact_official_product"),
    findabilityRow("E2", "exact_official_product"),
    findabilityRow("F1", "official_family_page"),
    findabilityRow("N1", "completed_not_found"),
  ],
};

function call(runId: string, id: string, sim: number, prompt: string, outcome: AiCallRow["outcome"]): AiCallRow {
  return {
    id,
    audit_run_id: runId,
    sim_id: sim,
    engine: "chatgpt",
    model: "gpt",
    category: "electric_guitar",
    prompt,
    prompt_key: `p${sim}`,
    prompt_kind: "commercial",
    call_status: "answered",
    outcome,
    primary_brand: outcome === "fender_win" ? "Fender" : "Yamaha",
    material_hallucination: "none",
    hallucination_evidence: null,
    root_cause: null,
    remediation_patch: null,
    error_message: null,
    attempt_no: 1,
    repeat_no: 1,
    created_at: "2026-11-03T12:00:00Z",
  };
}

function snapshot(runId: string, calls: AiCallRow[]): AiSearchSnapshot {
  return {
    run: {
      audit_run_id: runId,
      run_state: "completed",
      collector_version: "v11",
      prompt_set_hash: "abc",
      expected_calls: calls.length,
      attempted_calls: calls.length,
      answered_calls: calls.length,
      error_calls: 0,
      started_at: "2026-11-03T00:00:00Z",
      completed_at: "2026-11-03T01:00:00Z",
      published_at: "2026-11-03T02:00:00Z",
      missing_calls: 0,
      is_published: true,
    },
    calls,
    probes: [],
    citations: [],
  };
}

const publishedSnap = snapshot(PUBLISHED_ID, [
  call(PUBLISHED_ID, "u1", 1, "best beginner electric guitar", "fender_win"),
  call(PUBLISHED_ID, "u2", 2, "best beginner electric guitar", "competitor_win"),
  call(PUBLISHED_ID, "b1", 3, "Is a Fender Stratocaster good for beginners", "fender_win"),
]);

const windowSnap = snapshot(WINDOW_ID, [
  call(WINDOW_ID, "u1", 1, "best beginner electric guitar", "competitor_win"),
  call(WINDOW_ID, "u2", 2, "best beginner electric guitar", "competitor_win"),
  call(WINDOW_ID, "u3", 3, "best beginner electric guitar", "fender_win"),
  call(WINDOW_ID, "b1", 4, "Is a Fender Stratocaster good for beginners", "competitor_win"),
]);

const published: AiSearchRead = { phase: "ready", snapshot: publishedSnap };
const briefingAi: AiSearchRead = { phase: "ready", snapshot: windowSnap };

function visibleText(deck: ReturnType<typeof storyDeck>): string[] {
  const lines = [deck.windowLabel, DECK_PAGE.title, DECK_PAGE.lead];
  for (const finding of deck.findings) {
    lines.push(finding.label, finding.explainer);
    if (finding.percent) lines.push(finding.percent);
    if (finding.ratio) lines.push(finding.ratio);
    if (finding.note) lines.push(finding.note);
  }
  if (deck.published.phase === "ready") {
    lines.push(deck.published.runId, deck.published.unbranded.percent, deck.published.branded.percent);
    if (deck.published.unbranded.ratio) lines.push(deck.published.unbranded.ratio);
    if (deck.published.branded.ratio) lines.push(deck.published.branded.ratio);
    if (deck.published.unbranded.tip) lines.push(deck.published.unbranded.tip);
    if (deck.published.branded.tip) lines.push(deck.published.branded.tip);
  } else {
    lines.push(deck.published.copy);
  }
  return lines;
}

test("findings reuse briefingFindingsLead for the window, and the published run stays its own citation", async () => {
  const retailRead = await retail();
  const windowLabel = dashboardWindowLabel(published);
  const deck = storyDeck({ retail: retailRead, findability, published, briefingAi, windowLabel });
  const lead = briefingFindingsLead(retailRead, findability, briefingAi);

  assert.deepEqual(
    deck.findings.map((finding) => finding.id),
    ["buy_box", "map_leakage", "splintered_bundles", "exact_official_product", "unbranded_discovery"],
  );
  assert.deepEqual(
    deck.findings.map((finding) => finding.label),
    ["Buy Box withheld", "MAP leakage", "Splintered bundles", "Exact official product pages", "Unbranded discovery"],
  );
  for (const finding of deck.findings) {
    const fromLead = lead.findings.find((item) => item.id === finding.id)!;
    assert.equal(finding.percent, fromLead.percent, finding.id);
    assert.equal(finding.ratio, fromLead.ratio, finding.id);
    assert.equal(finding.explainer, fromLead.explainer, finding.id);
    assert.equal(finding.note, null, finding.id);
    assert.match(finding.percent ?? "", /%$/);
    assert.ok(finding.ratio, `${finding.id} shows N of M`);
  }

  assert.equal(deck.published.phase, "ready");
  if (deck.published.phase !== "ready") return;
  assert.equal(deck.published.runId, PUBLISHED_ID);
  assert.notEqual(deck.published.runId, deck.published.runId.slice(0, 8));

  const summary = summarizeRun(publishedSnap);
  const unbranded = roleRateLead(summary.roles.unbranded, UNBRANDED_RATE_BANDS);
  const branded = roleRateLead(summary.roles.branded, BRANDED_RATE_BANDS);
  assert.equal(deck.published.unbranded.percent, unbranded.rate);
  assert.equal(deck.published.branded.percent, branded.rate);
  assert.equal(deck.published.unbranded.ratio, formatRatio(summary.roles.unbranded.fenderWins, summary.roles.unbranded.resolved));
  assert.equal(deck.published.branded.ratio, formatRatio(summary.roles.branded.fenderWins, summary.roles.branded.resolved));

  const windowUnbranded = deck.findings.find((finding) => finding.id === "unbranded_discovery")!;
  assert.notEqual(windowUnbranded.percent, deck.published.unbranded.percent);
  assert.equal(windowLabel, historyControlLabel(DEFAULT_HISTORY_MODE, utcDay(publishedSnap.run.published_at), null, PUBLISHED_ID));
  assert.equal(deck.windowLabel, windowLabel);
  assert.match(deck.windowLabel, /^Last 30 days · /);
});

test("a failed read uses the dashboard failure copy and does not invent a figure", async () => {
  const failedAi: AiSearchRead = { phase: "error", message: "canvas_ai_current_run timed out" };
  const failedFindability: FindabilityRead = { phase: "error", message: "canvas_spec_findability timed out" };
  const deck = storyDeck({
    retail: { phase: "error" },
    findability: failedFindability,
    published: failedAi,
    briefingAi: { phase: "error", message: "selected period timed out", selection: "failed" },
    windowLabel: "Last 30 days",
  });

  const retailNote = headlineSurface({ phase: "error" }).missingMessage;
  for (const id of ["buy_box", "map_leakage", "splintered_bundles"] as const) {
    const finding = deck.findings.find((item) => item.id === id)!;
    assert.equal(finding.percent, READ_NOT_AVAILABLE, id);
    assert.equal(finding.ratio, null, id);
    assert.equal(finding.note, retailNote, id);
  }
  const pages = deck.findings.find((item) => item.id === "exact_official_product")!;
  assert.equal(pages.percent, READ_NOT_AVAILABLE);
  assert.equal(pages.note, findabilityWidgetCopy(failedFindability).detail);
  const unbranded = deck.findings.find((item) => item.id === "unbranded_discovery")!;
  assert.equal(unbranded.percent, READ_NOT_AVAILABLE);
  assert.equal(unbranded.note, aiSpokeDesc({ phase: "error", message: "selected period timed out", selection: "failed" }));
  assert.equal(deck.published.phase, "error");
  if (deck.published.phase === "error") assert.equal(deck.published.copy, aiSpokeDesc(failedAi));
  for (const line of visibleText(deck)) {
    assert.doesNotMatch(line, /\d+(\.\d+)?%/, `invented percent in "${line}"`);
    assert.doesNotMatch(line, /\$|680|38M/, `dollar in "${line}"`);
  }
});

test("a missing published run and a still-loading read show no rate", () => {
  const deck = storyDeck({
    retail: { phase: "loading" },
    findability: { phase: "loading" },
    published: { phase: "no-run" },
    briefingAi: { phase: "loading" },
    windowLabel: dashboardWindowLabel({ phase: "loading" }),
  });
  for (const finding of deck.findings) {
    assert.equal(finding.percent, null, finding.id);
    assert.equal(finding.ratio, null, finding.id);
    assert.ok(finding.note, finding.id);
  }
  assert.equal(deck.published.phase, "no-run");
  if (deck.published.phase === "no-run") {
    assert.equal(deck.published.copy, aiSpokeDesc({ phase: "no-run" }));
    assert.doesNotMatch(deck.published.copy, /%|\$/);
  }
  assert.equal(deck.windowLabel, "Last 30 days");
  const empty = storyDeck({
    retail: { phase: "loading" },
    findability: { phase: "loading" },
    published,
    briefingAi: { phase: "loading" },
    windowLabel: "Last 30 days",
  });
  assert.equal(empty.published.phase, "ready");
  if (empty.published.phase === "ready") {
    const none = snapshot(PUBLISHED_ID, []);
    const bare = storyDeck({
      retail: { phase: "loading" },
      findability: { phase: "loading" },
      published: { phase: "ready", snapshot: none },
      briefingAi: { phase: "loading" },
      windowLabel: "Last 30 days",
    });
    assert.equal(bare.published.phase, "ready");
    if (bare.published.phase === "ready") {
      assert.equal(bare.published.unbranded.percent, NO_RESOLVED_ANSWERS);
      assert.equal(bare.published.branded.percent, NO_RESOLVED_ANSWERS);
      assert.equal(bare.published.unbranded.ratio, null);
    }
  }
});

const DECK_DIR = "app/(canvas)/dashboard/deck";

test("the deck page is a guest route beside security, with no period control and no fee or dollar copy", () => {
  const files = readdirSync(DECK_DIR).map((name) => join(DECK_DIR, name));
  files.push("lib/story-deck/story-deck.ts");
  const page = readFileSync(join(DECK_DIR, "page.tsx"), "utf8");
  const live = readFileSync(join(DECK_DIR, "DeckLive.tsx"), "utf8");
  const view = readFileSync(join(DECK_DIR, "DeckView.tsx"), "utf8");
  assert.equal(STORY_DECK_PATH, "/dashboard/deck");
  assert.match(page, /DeckThemeRoot/);
  assert.match(page, /Suspense/);
  assert.match(readFileSync(join(DECK_DIR, "DeckFrame.tsx"), "utf8"), /DASHBOARD_PATH/);
  assert.doesNotMatch(page + live, /DashboardAuthView|enterGuestDashboard|redirect\(/);
  assert.match(live, /useDisplayedAiSearch/);
  assert.match(live, /useAiSearchRead/);
  assert.match(live, /usePortfolioRetailSnapshot/);
  assert.match(live, /useFindabilityRead/);
  assert.doesNotMatch(live + view, /RunHistoryControl|viewRun\(|viewPublished\(/);
  assert.match(readFileSync("lib/story-deck/story-deck.ts", "utf8"), /briefingFindingsLead/);
  assert.match(view, /className: `\$\{className\} ifai-term`/);
  assert.match(view, /data-ifai-tooltip-title/);
  assert.match(view, /data-ifai-tooltip-desc/);
  assert.match(view, /tabIndex: 0/);
  assert.match(view, /aria-label/);
  assert.doesNotMatch(view, /\btitle=/);
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(source, /\u2014/, `em dash in ${file}`);
    assert.doesNotMatch(source, /\$\d|680|38M|fee|retainer/, `commercial copy in ${file}`);
    assert.doesNotMatch(source, /caused an answer|page caused/i, `causation copy in ${file}`);
  }
});
