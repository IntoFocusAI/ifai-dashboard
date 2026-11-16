// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/map-stale-mark.test.ts
// X-25 on the map: a bubble whose figure is past its check schedule carries the asterisk and
// its tooltip; the AI Search Visibility and Competitive Radar bubbles carry the asterisk only.
import assert from "node:assert/strict";
import { test } from "node:test";
import { historyFixtureSnapshots } from "../lib/ai-search/history-fixtures.ts";
import type { AiSearchRead } from "../lib/ai-search/types.ts";
import type { CanvasNode } from "../lib/canvas-sdk/types.ts";
import type { FindabilityRead } from "../lib/findability/copy.ts";
import { buildLiveMetrics } from "../lib/fender-canvas/metrics-from-live.ts";
import { buildMinimalMetrics } from "../lib/fender-canvas/minimal-metrics.ts";
import { buildLiveNodes } from "../lib/fender-canvas/nodes-from-live.ts";
import { SPEC_CHECK_JOB } from "../lib/fender-canvas/page-found-checked-at.ts";
import type { CanvasBundle, CanvasMetricsRow } from "../lib/fender-canvas/types.ts";

const DAY = 86_400_000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY).toISOString();

/** The spec read's checked rows: the first has the given time, the optional second is checked a day ago. */
function specPages(first: string | null, second?: boolean) {
  const checkedRows = [{ asin: "B00ONE", checkedAt: first }, ...(second ? [{ asin: "B00TWO", checkedAt: daysAgo(1) }] : [])];
  return { checkedRows, pages: [], withSpecBlock: 0, withAllBasics: 0, listings: 0 };
}

function bundle(specCheckAt: string | null = null, both = false): CanvasBundle {
  return {
    specPages: specCheckAt ? specPages(specCheckAt, both) : undefined,
    m: { catalog_skus: 3598, spec_checked: 925, spec_fender_found: 123, spec_fender_found_pct: 13.3 } as CanvasMetricsRow,
    cats: [],
    engines: [],
    sov: [],
    divisions: [],
    missing: [],
    fresh: specCheckAt ? [{ job_key: SPEC_CHECK_JOB, last_run_at: specCheckAt }] : [],
  } as CanvasBundle;
}

/** Two official-page rows; the second row's check time defaults to the first's. */
function findability(checkedAt: string | null, familyCheckedAt: string | null = checkedAt): FindabilityRead {
  const row = (asin: string, state: string, at: string | null) => ({
    asin,
    title: asin,
    category: null,
    product_kind: null,
    latest_state: state,
    latest_canonical_url: `https://brand.example/${asin}`,
    latest_variant_sku: null,
    confidence: null,
    explanation: null,
    source_method: null,
    http_status: 200,
    latest_attempt_at: at,
    jsonld_status: "not_checked",
    counts_as_confirmed: true,
    counts_as_finished_search: true,
    counts_as_ambiguous: false,
    counts_as_unchecked: false,
    counts_as_completed_not_found: false,
    counts_as_blocked: false,
    counts_as_timeout: false,
    counts_as_parse_failure: false,
    counts_as_unsupported: false,
  });
  return {
    phase: "ready",
    dealerBundleLoaded: true,
    rows: [row("B00EXACT", "exact_official_product", checkedAt), row("B00FAMILY", "official_family_page", familyCheckedAt)],
  } as FindabilityRead;
}

function ai(publishedAt: string): AiSearchRead {
  const snapshots = historyFixtureSnapshots();
  const published = snapshots.find((snapshot) => snapshot.run.is_published) ?? snapshots[snapshots.length - 1];
  return { phase: "ready", snapshot: { ...published, run: { ...published.run, published_at: publishedAt } } };
}

function nodes(input: { find: FindabilityRead; ai: AiSearchRead; specCheckAt?: string | null; specBoth?: boolean }) {
  const b = bundle(input.specCheckAt ?? null, input.specBoth);
  const list = buildLiveNodes(b, buildLiveMetrics(b), { phase: "loading" }, input.ai, input.find);
  return { b, list, byId: new Map(list.map((node) => [node.id, node])) };
}

const node = (byId: Map<string, CanvasNode>, id: string) => {
  const found = byId.get(id);
  assert.ok(found, `no ${id} bubble`);
  return found;
};

test("a Findability check older than twice its weekly schedule marks the Findability bubble", () => {
  const { byId } = nodes({ find: findability(daysAgo(30)), ai: ai(daysAgo(1)) });
  const sat = node(byId, "sat-findability");
  assert.equal(sat.heroValue?.value, "50.0%*");
  // Brian Magazu, 12 Nov 2026: no hover box on a map bubble; the words stay for Minimal and the panel.
  assert.equal(sat.tooltip.desc, "");
  assert.match(sat.partialTip ?? "", /^2 of 2 listings have no official-page check in 14 days\./);
  assert.doesNotMatch(sat.partialTip ?? "", /canvas_/);
  assert.ok((sat.partialTip ?? "").split("\n").length <= 3, "a lead line, then at most two short lines");
});

test("a fresh newest check does not clear the asterisk while another listing is older than 14 days", () => {
  const { byId } = nodes({ find: findability(daysAgo(0), daysAgo(30)), ai: ai(daysAgo(1)) });
  const sat = node(byId, "sat-findability");
  assert.equal(sat.heroValue?.value, "50.0%*");
  assert.match(sat.partialTip ?? "", /^1 of 2 listings has no official-page check in 14 days\./);
});

test("a listing with no stored check time counts as not checked in the window", () => {
  const { byId } = nodes({ find: findability(daysAgo(1), null), ai: ai(daysAgo(1)) });
  assert.equal(node(byId, "sat-findability").heroValue?.value, "50.0%*");
});

test("a current Findability check leaves the bubble plain", () => {
  const { byId } = nodes({ find: findability(daysAgo(3)), ai: ai(daysAgo(1)) });
  const sat = node(byId, "sat-findability");
  assert.equal(sat.heroValue?.value, "50.0%");
  assert.equal(sat.tooltip.desc, "");
  assert.equal(sat.partialTip, undefined);
});

test("a checked listing past 14 days marks the AI Readiness bubble, counted per row (X-25)", () => {
  const stale = nodes({ find: findability(daysAgo(1)), ai: ai(daysAgo(1)), specCheckAt: daysAgo(20) });
  const bubble = node(stale.byId, "spoke-specs");
  assert.match(bubble.heroValue?.value ?? "", /^\d+(\.\d)?%\*$/);
  assert.equal(bubble.tooltip.desc, "", "no hover box on a map bubble");
  assert.match(bubble.partialTip ?? "", /^1 of 1 listing has no .* product check in 14 days\./);

  // The newest listing is fresh, but the other one is not: the asterisk stays.
  const mixed = nodes({ find: findability(daysAgo(1)), ai: ai(daysAgo(1)), specCheckAt: daysAgo(20), specBoth: true });
  const mixedBubble = node(mixed.byId, "spoke-specs");
  assert.match(mixedBubble.heroValue?.value ?? "", /\*$/);
  assert.match(mixedBubble.partialTip ?? "", /^1 of 2 listings has no .* product check in 14 days\./);

  const current = nodes({ find: findability(daysAgo(1)), ai: ai(daysAgo(1)), specCheckAt: daysAgo(2) });
  assert.doesNotMatch(node(current.byId, "spoke-specs").heroValue?.value ?? "", /\*$/);
});

test("a stale AI Search run marks every AI figure; no map bubble gets a hover box (PM24-1, 12 Nov 2026)", () => {
  const { byId } = nodes({ find: findability(daysAgo(1)), ai: ai(daysAgo(9)) });
  for (const id of ["spoke-aeo", "spoke-competitors"]) {
    const bubble = node(byId, id);
    assert.match(bubble.heroValue?.value ?? "", /\*$/, `${id} carries the asterisk`);
    assert.equal(bubble.tooltip.desc, "", `${id} has no hover box`);
    assert.match(bubble.partialTip ?? "", /^No AI Search run has been published in 6 days\./);
  }
  for (const id of ["sat-prompts", "sat-citations", "sat-drift", "sat-taylor", "sat-amps"]) {
    const sat = node(byId, id);
    if (!/\d/.test(sat.heroValue?.value ?? "")) continue;
    assert.match(sat.heroValue?.value ?? "", /\*$/, `${id} carries the asterisk`);
    assert.equal(sat.tooltip.desc, "", `${id} has no hover box`);
    assert.match(sat.partialTip ?? "", /^No AI Search run has been published/, `${id} keeps the words for Minimal`);
  }
});

test("a current AI Search run leaves the AI bubbles plain", () => {
  const { byId } = nodes({ find: findability(daysAgo(1)), ai: ai(daysAgo(2)) });
  for (const id of ["spoke-aeo", "spoke-competitors", "sat-prompts", "sat-taylor"]) {
    assert.doesNotMatch(node(byId, id).heroValue?.value ?? "", /\*$/, id);
  }
});

test("a Minimal slot that reads a stale bubble keeps the asterisk and its tooltip", () => {
  const { b, list } = nodes({ find: findability(daysAgo(30)), ai: ai(daysAgo(1)) });
  const metrics = buildLiveMetrics(b);
  const slots = buildMinimalMetrics(list, {
    bundle: b,
    retail: { phase: "loading" },
    ai: ai(daysAgo(1)),
    findability: findability(daysAgo(30)),
    authorizedPartners: null,
    stockLoss: { phase: "loading" },
    amazonFieldTotals: null,
    phaseOne: metrics.phaseOneLift,
    enterprise: metrics.enterprisePotential,
  });
  const slot = slots.find((entry) => entry.id === "sat-findability");
  assert.ok(slot);
  assert.equal(slot.value, "50.0%*");
  assert.match(slot.reading.missing ?? "", /2 of 2 listings have no official-page check in 14 days/);
  const family = slots.find((entry) => entry.id === "findability-official-family-page");
  assert.ok(family);
  assert.equal(family.value, "50.0%*", "a Findability tile that is not a bubble carries the asterisk too");
  assert.match(family.reading.missing ?? "", /2 of 2 listings have no official-page check in 14 days/);
});
