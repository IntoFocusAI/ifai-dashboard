// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/briefing-retail-hero.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import type { AiCallRow, AiSearchSnapshot } from "../lib/ai-search/types.ts";
import { formatPct, formatRatio } from "../lib/fender-canvas/format.ts";
import {
  BRIEFING_COUNT_MISSING,
  BRIEFING_LOST_REVENUE_FIGURE,
  BRIEFING_LOST_REVENUE_LABEL,
  briefingFindingsLead,
  briefingLostRevenuePlaceholder,
} from "../lib/fender-canvas/briefing-retail-lead.ts";
import {
  mapLeakageFinding,
  selectRetailHeadline,
  suppressedListingsFinding,
  unnestedBundlesFinding,
  type CatalogBundleRow,
  type MapLeakageRow,
  type PortfolioRetailFindings,
  type SuppressionSupportRow,
} from "../lib/fender-canvas/portfolio-retail.ts";
import { buyBoxHero, catalogHero, mapHero } from "../lib/fender-canvas/retail-overview-lead.ts";
import type { FindabilityRow } from "../lib/findability/outcomes.ts";
import { countFindability } from "../lib/findability/outcomes.ts";
import { outcomeShareFigure, outcomeRatioFigure } from "../lib/findability/lead.ts";
import { summarizeRun } from "../lib/ai-search/summary.ts";

const root = new URL("..", import.meta.url).pathname;
const read = (path: string) => readFileSync(join(root, path), "utf8");

const CHECKED_AT = new Date(Date.now() - 60_000).toISOString();

function suppressed(price = 200): SuppressionSupportRow {
  return {
    asin: "B0EQ000000",
    offer_price: price,
    featured_offer_state: "withheld",
    featured_offer_withheld: true,
    featured_offer_source: "keepa",
    featured_offer_checked_at: CHECKED_AT,
    featured_offer_attempted_at: CHECKED_AT,
    featured_offer_last_error: null,
    competitive_external_price_state: "present",
    competitive_price_threshold_cents: 10000,
    featured_offer_observed_price_cents: 20000,
    featured_offer_observed_shipping_cents: null,
    featured_offer_observed_seller: null,
  };
}

function present(): SuppressionSupportRow {
  return {
    ...suppressed(),
    featured_offer_state: "present",
    featured_offer_withheld: false,
    featured_offer_observed_price_cents: 9000,
  };
}

function notChecked(): SuppressionSupportRow {
  return {
    ...suppressed(),
    featured_offer_state: null,
    featured_offer_withheld: null,
    featured_offer_source: null,
    featured_offer_checked_at: null,
    featured_offer_attempted_at: null,
    competitive_external_price_state: null,
    competitive_price_threshold_cents: null,
    featured_offer_observed_price_cents: null,
  };
}

function mapRow(leak: number | null): MapLeakageRow {
  return {
    map_price: 100,
    offer_price: 80,
    amz_leakage: leak,
    wmt_leakage: null,
    mf_leakage: null,
  };
}

function bundle(asin: string, parent: string | null): CatalogBundleRow {
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

function findings(partial: Partial<PortfolioRetailFindings> = {}): PortfolioRetailFindings {
  return {
    suppressedListings: suppressedListingsFinding([suppressed(), present(), notChecked()]),
    mapLeakage: mapLeakageFinding([mapRow(-12.5), mapRow(4)]),
    unnestedBundles: unnestedBundlesFinding([
      bundle("B000000001", null),
      bundle("B000000002", "B000000099"),
    ]),
    amazonSpecGaps: {
      status: "unavailable",
      issueCount: null,
      missingMessage: "Amazon spec-field readings have not been stored.",
      detail: null,
    },
    ...partial,
  };
}

function findabilityRow(
  partial: Partial<FindabilityRow> & Pick<FindabilityRow, "asin" | "latest_state">,
): FindabilityRow {
  return {
    title: "Listing",
    category: "Solid Body",
    product_kind: "instrument",
    latest_canonical_url: null,
    latest_variant_sku: null,
    confidence: null,
    explanation: null,
    source_method: null,
    http_status: null,
    latest_attempt_at: null,
    jsonld_status: "not_checked",
    counts_as_confirmed: false,
    counts_as_finished_search: false,
    counts_as_ambiguous: false,
    counts_as_unchecked: false,
    counts_as_completed_not_found: false,
    counts_as_blocked: false,
    counts_as_timeout: false,
    counts_as_parse_failure: false,
    counts_as_unsupported: false,
    ...partial,
  };
}

function aiCall(partial: Partial<AiCallRow> & Pick<AiCallRow, "id" | "sim_id">): AiCallRow {
  return {
    audit_run_id: "run-a",
    engine: "chatgpt",
    model: "gpt",
    category: "electric_guitar",
    prompt: "best beginner electric guitar",
    prompt_key: "u1",
    prompt_kind: "commercial",
    call_status: "answered",
    outcome: "fender_win",
    primary_brand: "Fender",
    material_hallucination: "none",
    hallucination_evidence: null,
    root_cause: null,
    remediation_patch: null,
    error_message: null,
    attempt_no: 1,
    repeat_no: 1,
    created_at: "2025-10-20T00:00:00Z",
    ...partial,
  };
}

function aiSnapshot(calls: AiCallRow[]): AiSearchSnapshot {
  return {
    run: {
      audit_run_id: "run-a",
      run_state: "completed",
      collector_version: "v11",
      prompt_set_hash: null,
      expected_calls: calls.length,
      attempted_calls: calls.length,
      answered_calls: calls.length,
      error_calls: 0,
      started_at: "2025-10-20T00:00:00Z",
      completed_at: "2025-10-20T01:00:00Z",
      published_at: "2025-10-20T01:00:00Z",
      missing_calls: 0,
    },
    calls,
    probes: [],
    citations: [],
  };
}

test("five findings reuse Retail Overview / Findability / Run Details populations", () => {
  const snapshot = findings({
    suppressedListings: suppressedListingsFinding([
      suppressed(),
      present(),
      present(),
      notChecked(),
    ]),
    mapLeakage: mapLeakageFinding([mapRow(-5), mapRow(null), mapRow(-2), mapRow(1)]),
    unnestedBundles: unnestedBundlesFinding(
      [
        bundle("B000000001", null),
        bundle("B000000002", null),
        bundle("B000000003", "B000000099"),
        bundle("B000000004", "B000000098"),
      ],
      { catalogBundleCount: 20 },
    ),
  });
  const headline = selectRetailHeadline(snapshot);
  const findabilityRows = [
    findabilityRow({ asin: "E1", latest_state: "exact_official_product", counts_as_confirmed: true }),
    findabilityRow({ asin: "E2", latest_state: "exact_official_product", counts_as_confirmed: true }),
    findabilityRow({ asin: "F1", latest_state: "official_family_page", counts_as_confirmed: true }),
    findabilityRow({ asin: "N1", latest_state: "completed_not_found", counts_as_completed_not_found: true }),
  ];
  const ai = aiSnapshot([
    aiCall({ id: "c1", sim_id: 1, outcome: "fender_win", primary_brand: "Fender" }),
    aiCall({ id: "c2", sim_id: 2, outcome: "competitor_win", primary_brand: "Yamaha" }),
    aiCall({ id: "c3", sim_id: 3, outcome: "fender_win", primary_brand: "Fender" }),
    aiCall({
      id: "c4",
      sim_id: 4,
      prompt: "Is a Fender Stratocaster good for beginners",
      outcome: "fender_win",
      primary_brand: "Fender",
    }),
  ]);

  const lead = briefingFindingsLead(
    { phase: "ready", snapshot: { ...snapshot, headline } },
    { phase: "ready", rows: findabilityRows, dealerBundleLoaded: true },
    { phase: "ready", snapshot: ai },
  );

  assert.equal(lead.findings.length, 5);
  assert.deepEqual(
    lead.findings.map((f) => f.id),
    ["buy_box", "map_leakage", "splintered_bundles", "exact_official_product", "unbranded_discovery"],
  );

  const retailSnap = { ...snapshot, headline };
  const buyBox = buyBoxHero(retailSnap);
  const map = mapHero(retailSnap);
  const catalog = catalogHero(retailSnap);
  assert.equal(lead.findings[0].numerator, buyBox.numerator);
  assert.equal(lead.findings[0].denominator, buyBox.denominator);
  assert.equal(lead.findings[0].percent, buyBox.percent);
  assert.equal(lead.findings[0].ratio, buyBox.ratio);
  assert.equal(lead.findings[0].label, "Buy Box withheld");
  assert.equal(lead.findings[0].tab, "Suppressed Listings");
  assert.doesNotMatch(lead.findings[0].explainer, /1,049|audited|monitored/i);

  assert.equal(lead.findings[1].numerator, map.numerator);
  assert.equal(lead.findings[1].denominator, map.denominator);
  assert.equal(lead.findings[1].percent, map.percent);
  assert.equal(lead.findings[1].label, "MAP leakage");
  assert.equal(lead.findings[1].tab, "MAP Leakage");

  assert.equal(lead.findings[2].numerator, catalog.numerator);
  assert.equal(lead.findings[2].denominator, catalog.denominator);
  assert.equal(lead.findings[2].percent, catalog.percent);
  assert.equal(lead.findings[2].label, "Splintered Listings");
  assert.equal(lead.findings[2].tab, "Catalog Governance");
  assert.equal(lead.findings[2].denominator, 4);
  assert.doesNotMatch(lead.findings[2].explainer, /946|coverage|monitored/i);

  const counts = countFindability(findabilityRows);
  assert.equal(lead.findings[3].percent, outcomeShareFigure(counts, "exact_official_product"));
  assert.equal(lead.findings[3].ratio, outcomeRatioFigure(counts, "exact_official_product"));
  assert.equal(lead.findings[3].numerator, 2);
  assert.equal(lead.findings[3].denominator, 4);
  assert.equal(lead.findings[3].tab, "Findability");
  assert.match(lead.findings[3].explainer, /family page/i);

  const unbranded = summarizeRun(ai).roles.unbranded;
  assert.equal(lead.findings[4].numerator, unbranded.fenderWins);
  assert.equal(lead.findings[4].denominator, unbranded.resolved);
  assert.equal(lead.findings[4].ratio, formatRatio(unbranded.fenderWins, unbranded.resolved));
  assert.equal(lead.findings[4].percent, formatPct((100 * unbranded.fenderWins) / unbranded.resolved));
  assert.equal(lead.findings[4].tab, "Run Details");
  assert.doesNotMatch(lead.findings[4].explainer, /branded consideration/i);

  for (const finding of lead.findings) {
    assert.ok(finding.pie, `${finding.id} needs a share pie`);
    assert.equal(finding.pie.total, finding.denominator);
    assert.doesNotMatch(finding.percent, /\u2014/);
    assert.doesNotMatch(finding.explainer, /\u2014/);
  }
});

test("lost-revenue placeholder is Not available* and is not a sixth finding", () => {
  const placeholder = briefingLostRevenuePlaceholder();
  assert.equal(placeholder.label, BRIEFING_LOST_REVENUE_LABEL);
  assert.equal(placeholder.figure, BRIEFING_LOST_REVENUE_FIGURE);
  assert.equal(placeholder.figure, BRIEFING_COUNT_MISSING);
  assert.doesNotMatch(placeholder.figure, /\$|USD|\d{2,}/);
  assert.doesNotMatch(placeholder.explainer, /fee|retainer|IntoFocus/i);

  const types = read("lib/fender-canvas/types.ts");
  const retail = read("lib/fender-canvas/portfolio-retail.ts");
  assert.doesNotMatch(types, /monthly.?potential.?lost|lost.?brand.?revenue/i);
  assert.doesNotMatch(retail, /monthly.?potential.?lost|lost.?brand.?revenue/i);

  const snapshot = findings();
  const headline = selectRetailHeadline(snapshot);
  const lead = briefingFindingsLead(
    { phase: "ready", snapshot: { ...snapshot, headline } },
    { phase: "loading" },
    { phase: "loading" },
  );
  assert.equal(lead.findings.length, 5);
  assert.equal(lead.lostRevenue.figure, BRIEFING_COUNT_MISSING);
  assert.ok(!lead.findings.some((f) => /revenue|\$/i.test(f.label)));
});

test("a missing stored count shows Not available* without inventing zero", () => {
  const snapshot = findings({
    suppressedListings: suppressedListingsFinding(null),
  });
  const headline = selectRetailHeadline(snapshot);
  const lead = briefingFindingsLead(
    { phase: "ready", snapshot: { ...snapshot, headline } },
    { phase: "error", message: "failed" },
    { phase: "error", message: "failed" },
  );
  assert.equal(lead.findings[0].percent, BRIEFING_COUNT_MISSING);
  assert.equal(lead.findings[0].ratio, null);
  assert.equal(lead.findings[0].pie, null);
  assert.equal(lead.findings[3].percent, BRIEFING_COUNT_MISSING);
  assert.equal(lead.findings[4].percent, BRIEFING_COUNT_MISSING);
});

test("hub Briefing puts consensus in the findings row, then the essay", () => {
  const spokes = read("components/v3/build-live-spokes.tsx");
  const hero = read("components/v3/live/BriefingRetailHero.tsx");
  const lead = read("lib/fender-canvas/briefing-retail-lead.ts");
  const consensusLead = read("components/v3/live/BriefingConsensusLead.tsx");
  const briefingHtml = JSON.parse(read("data/fender-v3-spec.json")).spokes.hub.tabTemplates[0] as string;
  assert.match(spokes, /BriefingRetailHero/);
  assert.match(
    spokes,
    /0:\s*\([^)]*\)\s*=>\s*\(\s*<>\s*<BriefingRetailHero[\s\S]*?htmlBlock\(bindCopy\(HUB_BRIEFING_HTML/,
    "findings row, then the essay",
  );
  assert.doesNotMatch(spokes, /BriefingConsensusLead|briefing-consensus-lead/);
  assert.match(hero, /<BriefingConsensusLead[\s\S]*<BriefingFindingCard[\s\S]*<LostRevenuePlaceholder/);
  assert.doesNotMatch(hero, /briefing-buy-box-cluster|briefing-consensus-lead/);
  assert.match(consensusLead, /consensusFromLive\(/);
  assert.match(consensusLead, /briefingConsensusSentence\(/);
  assert.match(consensusLead, /data-ifai-tooltip-title="AI Consensus"/);
  assert.match(consensusLead, /data-ifai-tooltip-desc=\{sentence\}/);
  assert.doesNotMatch(consensusLead, /<p[\s>]|className="briefing-consensus-sentence"|className="briefing-consensus-lead"/);
  assert.doesNotMatch(
    consensusLead,
    /dominant|ScoreHeroCard|ConsensusLeadBand|ActuationHeroCard|CONSENSUS_EXPLAINER|FenderDivisionsTable|why it matters|Featured Offer/,
  );
  assert.doesNotMatch(consensusLead, /\stitle=/);
  const hub = spokes.slice(spokes.indexOf("\n  hub:"), spokes.indexOf("\n  ecommerce:"));
  const tab0 = hub.slice(hub.indexOf("\n    0:"), hub.indexOf("\n    1:"));
  const tab1 = hub.slice(hub.indexOf("\n    1:"));
  assert.match(tab0, /BriefingRetailHero/);
  assert.doesNotMatch(tab0, /FenderDivisionsTable|ConsensusScoresPanel|ConsensusLeadBand|BriefingConsensusLead/);
  assert.match(
    tab1,
    /<ConsensusScoresPanel bundle=\{bundle\} retail=\{retail\} \/>\s*<FenderDivisionsTable divisions=\{bundle\.divisions\} \/>/,
  );
  assert.doesNotMatch(tab1, /BriefingConsensusLead|BriefingRetailHero/);
  const card = read("components/v3/live/BriefingFindingCard.tsx");
  const buttonAt = card.indexOf("<button");
  assert.ok(buttonAt > card.indexOf("data-ifai-tooltip-desc={finding.explainer}"));
  assert.doesNotMatch(card.slice(buttonAt), /tabIndex=\{0\}|metric-card-sub|data-briefing-finding-explainer/);
  assert.match(card, /className="metric-card-label ifai-term"/);
  assert.match(card, /data-ifai-tooltip-title=\{finding\.label\}/);
  assert.match(card, /aria-label=\{`\$\{finding\.label\}: \$\{finding\.explainer\}`\}/);
  assert.match(hero, /data-ifai-tooltip-desc=\{placeholder\.explainer\}/);
  assert.doesNotMatch(hero, /metric-card-sub|data-briefing-revenue-explainer/);
  assert.doesNotMatch(read("components/v3/live/RoadmapFindingsPanel.tsx"), /BriefingConsensusLead|AI Consensus/);
  assert.match(hero, /briefingFindingsLead/);
  assert.match(hero, /data-briefing-findings/);
  assert.match(hero, /data-briefing-revenue-placeholder/);
  assert.match(hero, /BriefingFindingCard/);
  assert.match(card, /citation-pie-disc-retail/);
  assert.match(card, /data-ifai-open=\{finding\.spokeId\}/);
  assert.match(card, /data-ifai-tab=\{finding\.tab\}/);
  assert.match(lead, /buyBoxHero|mapHero|catalogHero/);
  assert.match(lead, /BRIEFING_LOST_REVENUE/);
  assert.match(lead, /Not available\*/);
  assert.doesNotMatch(briefingHtml, /\{retail_headline\}/);
  assert.match(briefingHtml, /Buy Box/);
  assert.match(briefingHtml, /\{enterprise_potential\}/);
  assert.match(briefingHtml, /commercial selling model/i);
  assert.doesNotMatch(hero, /\u2014/);
  assert.doesNotMatch(lead, /\u2014/);
  assert.doesNotMatch(hero, /\stitle=/);
  assert.doesNotMatch(card, /\stitle=/);
  assert.doesNotMatch(spokes, /DIY|Done-with-You|Done-for-You|retainer|service-fee/i);
  assert.doesNotMatch(lead, /AI Foundation|AI Commerce|AI Actuation|AI Consensus/);
});
