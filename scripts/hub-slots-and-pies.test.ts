// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/hub-slots-and-pies.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { citationEvidence } from "../lib/ai-search/citations.ts";
import { citationPies } from "../lib/ai-search/citation-pies.ts";
import type { AiCallRow, AiCitationRow, AiProbeRow, AiSearchRead } from "../lib/ai-search/types.ts";
import { isHubEvidenceSlot, type HubEvidenceSlot } from "../lib/canvas-sdk/hub-slot-types.ts";
import type { HubSlotFeed, PriorityItem } from "../lib/canvas-sdk/types.ts";
import { buildCheckBook } from "../lib/fender-canvas/hub-slot-checks.ts";
import { gapSlot } from "../lib/fender-canvas/hub-slot-rules.ts";
import { buildHubSlots, type HubSlotInput } from "../lib/fender-canvas/hub-slots.ts";
import type { FeaturedOfferCounts } from "../lib/fender-canvas/featured-offer.ts";
import {
  selectRetailHeadline,
  type PortfolioRetailFindings,
  type PortfolioRetailSnapshot,
  type UnnestedBundleOpportunity,
} from "../lib/fender-canvas/portfolio-retail.ts";
import type { CanvasBundle } from "../lib/fender-canvas/types.ts";
import type { FindabilityRow } from "../lib/findability/outcomes.ts";

const root = new URL("..", import.meta.url).pathname;
const read = (path: string) => readFileSync(join(root, path), "utf8");

function call(patch: Partial<AiCallRow>): AiCallRow {
  return {
    id: "row",
    audit_run_id: "run",
    sim_id: 1,
    engine: "chatgpt",
    model: null,
    category: "beginner",
    prompt: "Best guitar under $300",
    prompt_key: "p",
    prompt_kind: "commercial",
    call_status: "answered",
    outcome: "fender_win",
    primary_brand: "Fender/Squier",
    material_hallucination: "not_evaluated",
    hallucination_evidence: null,
    root_cause: null,
    remediation_patch: null,
    error_message: null,
    attempt_no: 1,
    repeat_no: 1,
    created_at: "2026-10-18T12:00:00.000Z",
    ...patch,
  };
}

function readyAi(calls?: AiCallRow[]): AiSearchRead {
  return {
    phase: "ready",
    snapshot: {
      run: {
        audit_run_id: "run",
        run_state: "completed",
        collector_version: "v11",
        prompt_set_hash: null,
        expected_calls: 4,
        attempted_calls: 4,
        answered_calls: 4,
        error_calls: 0,
        started_at: "2026-10-18T12:00:00.000Z",
        completed_at: "2026-10-18T12:05:00.000Z",
        published_at: "2026-10-18T12:06:00.000Z",
        missing_calls: 0,
      },
      calls: calls ?? [
        call({ id: "u1", sim_id: 1, prompt: "Best guitar under $300", outcome: "fender_win" }),
        call({ id: "u2", sim_id: 2, prompt: "Best bass under $400", outcome: "competitor_win", primary_brand: "Yamaha" }),
        call({ id: "b1", sim_id: 3, prompt: "Is the Fender Stratocaster a good first guitar", outcome: "fender_win" }),
        call({ id: "b2", sim_id: 4, prompt: "Is a Squier Affinity a good bass", outcome: "fender_win" }),
      ],
      probes: [],
      citations: [],
    },
  };
}

/** 12 resolved electric answers (4 led by Gibson) and 3 bass answers (2 led by Yamaha). */
function categoryCalls(): AiCallRow[] {
  const electric = Array.from({ length: 12 }, (_, index) =>
    call({
      id: `e${index}`,
      sim_id: index,
      category: "electric",
      prompt: "Best electric guitar under $800",
      outcome: index < 4 ? "competitor_win" : "fender_win",
      primary_brand: index < 4 ? "Gibson" : "Fender/Squier",
    }),
  );
  const bass = Array.from({ length: 3 }, (_, index) =>
    call({
      id: `b${index}`,
      sim_id: 100 + index,
      category: "bass",
      prompt: "Best bass under $500",
      outcome: index < 2 ? "competitor_win" : "fender_win",
      primary_brand: index < 2 ? "Yamaha" : "Fender/Squier",
    }),
  );
  return [...electric, ...bass];
}

function gaps(required: number, other: number) {
  return [
    ...Array.from({ length: required }, (_, index) => ({ asin: `R${index}`, modelOrTitle: null, missingFields: ["color"] })),
    ...Array.from({ length: other }, (_, index) => ({ asin: `O${index}`, modelOrTitle: null, missingFields: ["brand_name"] })),
  ];
}

/** Withheld 10 of 100, MAP 30 of 60, splintered 2 of 20, another seller 5 of 50, specs missing 3 of 100. */
function snapshot(patch: Partial<PortfolioRetailFindings> = {}): PortfolioRetailSnapshot {
  const findings: PortfolioRetailFindings = {
    suppressedListings: {
      status: "available_with_issues",
      issueCount: 10,
      missingMessage: null,
      headlineLabel: "Buy Box withheld",
      headlineNoun: "listing",
      detail: {
        counts: {
          population: 120,
          current: 100,
          withheld: 10,
          confirmedHighPrice: 0,
          newestCheckedAt: "2026-11-01T09:00:00.000Z",
          oldestCheckedAt: "2026-10-28T09:00:00.000Z",
        } as FeaturedOfferCounts,
        suppressed: 0,
        audited: 100,
        population: 120,
        withThreshold: 0,
      },
    },
    mapLeakage: {
      status: "available_with_issues",
      issueCount: 30,
      missingMessage: null,
      detail: { violations: 30, decided: 60, undecided: 0, population: 80, averageLeakage: 12 },
    },
    unnestedBundles: {
      status: "available_with_issues",
      issueCount: 2,
      missingMessage: null,
      detail: { opportunities: [{}, {}] as UnnestedBundleOpportunity[], bundlesInRead: 20, catalogBundles: 20 },
    },
    amazonSpecGaps: {
      status: "available_with_issues",
      issueCount: 3,
      missingMessage: null,
      detail: { gaps: gaps(1, 2), checked: 100, unchecked: 0 },
    },
    controlledBuyBox: { controlled: 45, known: 50, population: 120 },
    buyBoxSellers: {
      amazonRetail: 40,
      sellers: [
        { name: "Austin Bazaar", listings: 5 },
        { name: "Other Shop", listings: 5 },
      ],
      known: 50,
      population: 120,
    },
    ...patch,
  };
  return { ...findings, headline: selectRetailHeadline(findings) };
}

function bundle(): CanvasBundle {
  const pages = Array.from({ length: 10 }, (_, index) => ({
    url: `https://www.fender.com/p${index}`,
    model: `Page ${index}`,
    asins: [],
    missingFields: [],
    hasSpecBlock: index >= 4,
    basicsPresent: 0,
    missingBasics: [],
    checkedAt: index === 0 ? "2026-10-31T10:00:00.000Z" : "2026-10-29T10:00:00.000Z",
  }));
  return {
    fresh: [
      { job_key: "map_leakage_walmart", last_run_at: "2026-11-02T08:00:00.000Z" },
      { job_key: "map_parity_musiciansfriend", last_run_at: "2026-10-30T08:00:00.000Z" },
      { job_key: "catalog_harvester", last_run_at: "2026-11-01T08:00:00.000Z" },
      { job_key: "buybox_seller_harvester", last_run_at: "2026-11-01T08:00:00.000Z" },
      { job_key: "spec_readiness", last_run_at: "2026-10-27T08:00:00.000Z" },
    ],
    specPages: { pages, withSpecBlock: 6, withAllBasics: 0, listings: 10 },
    listingContent: {
      rows: [{ checked_at: "2026-10-26T08:00:00.000Z" }],
      bulletsRead: 10,
      fullBullets: 9,
    },
  } as unknown as CanvasBundle;
}

const findabilityRows = [
  { latest_state: "exact_official_product", latest_attempt_at: "2026-10-25T08:00:00.000Z" },
  { latest_state: "exact_official_product", latest_attempt_at: "2026-10-25T08:00:00.000Z" },
  { latest_state: "exact_official_product", latest_attempt_at: "2026-10-25T08:00:00.000Z" },
  { latest_state: "official_family_page", latest_attempt_at: "2026-10-24T08:00:00.000Z" },
] as FindabilityRow[];

const ITEMS: PriorityItem[] = [
  {
    id: "buybox-suppression",
    title: "Buy Box withheld: 10 listings",
    why: "Buy Box withheld is the current retail headline.",
    severity: "critical",
    spokeId: "ecommerce",
    subTab: "Retail Overview",
  },
  {
    id: "schema-coverage",
    title: "fender.com pages are missing machine-readable specs",
    why: "4 of 10 fender.com product pages have no spec block.",
    severity: "high",
    spokeId: "specs",
    subTab: "Brand-Site Specs",
  },
  {
    id: "map-leakage",
    title: "30 listings are below MAP",
    why: "Open the MAP tab.",
    severity: "high",
    spokeId: "ecommerce",
    subTab: "MAP",
  },
  {
    id: "aplus-tables",
    title: "Amazon listings are missing bullet copy",
    why: "1 of 10 live Amazon listings fill fewer than five bullets.",
    severity: "moderate",
    spokeId: "specs",
    subTab: "A+",
  },
];

function input(patch: Partial<HubSlotInput> = {}): HubSlotInput {
  return {
    bundle: bundle(),
    retail: { phase: "ready", snapshot: snapshot() },
    ai: readyAi(categoryCalls()),
    findability: { phase: "ready", rows: findabilityRows, dealerBundleLoaded: true },
    phaseOneValue: "+$680K",
    phaseOneDetail: "Phase 1 annual estimate",
    commandItems: ITEMS,
    authorizedPartners: null,
    ...patch,
  };
}

function slots(feed: HubSlotFeed): HubEvidenceSlot[] {
  return feed.slots.map((slot) => {
    assert.ok(isHubEvidenceSlot(slot), `${feed.title} ${slot.role} carries its evidence`);
    return slot;
  });
}

function texts(slot: HubEvidenceSlot): string[] {
  return [
    slot.rule,
    slot.figure,
    slot.label,
    slot.note,
    slot.statusWord,
    slot.target.text,
    slot.countedOutOf.text,
    slot.lastChecked.text,
    slot.evidenceLabel,
    slot.countedOutOf.definition ?? "",
    slot.lastChecked.definition ?? "",
    slot.figureDefinition ?? "",
    slot.noteDefinition ?? "",
  ];
}

const MAIN_BUBBLES = [
  "hub",
  "spoke-retail",
  "spoke-aeo",
  "spoke-specs",
  "spoke-competitors",
  "spoke-fixes",
  "spoke-roadmap",
];

test("every slot names its rule, target, N of M, last check, and the tab that opens it", () => {
  for (const reading of [input(), input({ retail: { phase: "loading" } }), input({ retail: { phase: "error" } })]) {
    const feeds = buildHubSlots(reading);
    for (const id of MAIN_BUBBLES) {
      const feed = feeds[id];
      assert.ok(feed, id);
      assert.deepEqual(
        feed.slots.map((slot) => slot.role),
        ["gap", "opportunity", "action"],
      );
      for (const slot of slots(feed)) {
        assert.match(slot.rule, /^[A-Z].+\.$/, `${id} ${slot.role} rule is one plain sentence`);
        assert.doesNotMatch(slot.rule, /\.\s+[A-Z]/, `${id} ${slot.role} rule has no second sentence`);
        assert.ok(slot.figure.trim(), `${id} ${slot.role} figure`);
        assert.ok(slot.statusWord.trim(), `${id} ${slot.role} has a status word, so color is never alone`);
        assert.match(slot.target.text, /^(Target: .+ \(now .+\)|No target set|Loading)$/);
        assert.ok(slot.countedOutOf.text.trim(), `${id} ${slot.role} N of M`);
        assert.match(slot.lastChecked.text, /^(Last checked .+|Loading)$/);
        assert.ok(slot.spokeId, `${id} ${slot.role} opens a bubble`);
        assert.ok(slot.subTab, `${id} ${slot.role} opens a tab`);
        assert.equal(slot.evidenceLabel, `Open ${slot.subTab}`);
        if (slot.countedOutOf.text.includes("Not available*")) assert.ok(slot.countedOutOf.definition);
        if (slot.lastChecked.text.includes("Not available*")) assert.ok(slot.lastChecked.definition);
        for (const text of texts(slot)) {
          assert.doesNotMatch(text, /\u2014/, `${id} ${slot.role} has no em dash`);
          assert.doesNotMatch(text, /retainer|fee\b|monthly charge|IntoFocus price/i);
        }
      }
    }
  }
});

test("the gap is the check with the highest share falling short, with no invented target", () => {
  const feeds = buildHubSlots(input());
  const [gap] = slots(feeds["spoke-retail"]);
  assert.equal(gap.label, "Listings priced below MAP");
  assert.equal(gap.figure, "50.0%");
  assert.equal(gap.countedOutOf.text, "30 of 60 listings with a stored MAP comparison");
  assert.equal(gap.target.text, "No target set");
  assert.equal(gap.tone, "warning");
  assert.equal(gap.statusWord, "Open gap");
  assert.deepEqual([gap.chart?.part, gap.chart?.total], [30, 60]);
  assert.equal(gap.lastChecked.text, "Last checked Nov 2, 2026");
  assert.deepEqual([gap.spokeId, gap.subTab], ["ecommerce", "MAP"]);

  const [specsGap] = slots(feeds["spoke-specs"]);
  assert.equal(specsGap.label, "Found fender.com pages missing machine-readable specs");
  assert.equal(specsGap.countedOutOf.text, "4 of 10 found fender.com pages");
  assert.equal(specsGap.lastChecked.text, "Last checked Oct 31, 2026");
  assert.equal(specsGap.subTab, "Brand-Site Specs");

  const [aiGap] = slots(feeds["spoke-aeo"]);
  assert.equal(aiGap.label, "Unbranded answers Fender/Squier did not lead");
  assert.equal(aiGap.countedOutOf.text, "6 of 15 resolved unbranded answers");
  assert.equal(aiGap.target.text, "No target set");
  assert.equal(aiGap.lastChecked.text, "Last checked Oct 18, 2026");

  const [summaryGap] = slots(feeds.hub);
  assert.equal(summaryGap.label, "Listings priced below MAP");
  assert.match(summaryGap.rule, /^Of every check behind the map's bubbles/);

  const [findingsGap] = slots(feeds["spoke-fixes"]);
  assert.match(findingsGap.rule, /^Of the five current findings/);
  assert.equal(findingsGap.label, "Listings priced below MAP");
});

test("specs complete uses its approved band and stays on the AI Readiness bubble", () => {
  const retail = { phase: "ready" as const, snapshot: snapshot({
    amazonSpecGaps: {
      status: "available_with_issues",
      issueCount: 10,
      missingMessage: null,
      detail: { gaps: gaps(5, 5), checked: 100, unchecked: 0 },
    },
  }) };
  const book = buildCheckBook({ ...input(), retail });
  const check = book.checks.specs_complete;
  assert.ok(check);
  assert.deepEqual(check.target, { text: "Specs complete at 98% and up", now: "90.0%", tone: "danger" });
  const slot = gapSlot(check, "Rule.");
  assert.equal(slot.statusWord, "Needs attention");
  assert.equal(slot.target.text, "Target: Specs complete at 98% and up (now 90.0%)");

  const allClear = bundle();
  allClear.specPages = { ...allClear.specPages!, withSpecBlock: 10, pages: allClear.specPages!.pages.map((page) => ({ ...page, hasSpecBlock: true })) };
  allClear.listingContent = { ...allClear.listingContent!, fullBullets: 10 };
  const exactRows = findabilityRows.map((row) => ({ ...row, latest_state: "exact_official_product" }));
  const [specsGap] = slots(
    buildHubSlots(
      input({ bundle: allClear, retail, findability: { phase: "ready", rows: exactRows, dealerBundleLoaded: true } }),
    )["spoke-specs"],
  );
  assert.equal(specsGap.label, "Listings missing an Amazon spec field");
  assert.equal(specsGap.countedOutOf.text, "10 of 100 checked listings");
  assert.deepEqual([specsGap.spokeId, specsGap.subTab], ["specs", "Amazon Specs"]);
  assert.equal(specsGap.tone, "danger");
  assert.equal(specsGap.statusWord, "Needs attention");
});

function probe(index: number, contradicts: boolean): AiProbeRow {
  return {
    audit_run_id: "run",
    sim_id: 500 + index,
    prompt_key: `fact-${index % 5}`,
    prompt: "What pickups does the Player Stratocaster have",
    engine: "chatgpt",
    model: null,
    call_status: "answered",
    material_hallucination: contradicts ? "confirmed" : "none",
    hallucination_evidence: contradicts ? "The answer names humbuckers." : null,
    verified_claim: "Three single-coil pickups",
    verified_source_url: "https://www.fender.com/en-US/electric-guitars/stratocaster/player-stratocaster",
    verified_at: "2026-10-01T00:00:00.000Z",
    created_at: "2026-10-18T12:01:00.000Z",
  };
}

/** 100 checked fact-check answers, `contradictions` of them contradicting the verified fact. */
function aiWithFactChecks(contradictions: number, calls: AiCallRow[] = categoryCalls()): AiSearchRead {
  const ai = readyAi(calls);
  if (ai.phase !== "ready") throw new Error("ready");
  const probes = Array.from({ length: 100 }, (_, index) => probe(index, index < contradictions));
  return { ...ai, snapshot: { ...ai.snapshot, probes } };
}

test("fact-check accuracy reads its approved target, above 98%, with the Fact Checks bands", () => {
  const bands = [
    { contradictions: 6, now: "94.0%", tone: "danger", word: "Needs attention" },
    { contradictions: 5, now: "95.0%", tone: "warning", word: "Watch" },
    { contradictions: 2, now: "98.0%", tone: "warning", word: "Watch" },
    { contradictions: 1, now: "99.0%", tone: "success", word: "On target" },
  ];
  for (const band of bands) {
    const check = buildCheckBook({ ...input(), ai: aiWithFactChecks(band.contradictions) }).checks.fact_checks;
    assert.ok(check);
    assert.deepEqual(check.target, { text: "Fact-check accuracy above 98%", now: band.now, tone: band.tone });
    const slot = gapSlot(check, "Rule.");
    assert.equal(slot.target.text, `Target: Fact-check accuracy above 98% (now ${band.now})`);
    assert.equal(slot.statusWord, band.word, `${band.now} reads ${band.word}`);
    assert.equal(slot.tone, band.tone);
  }

  const allLed = categoryCalls().map((row) => ({ ...row, outcome: "fender_win" as const, primary_brand: "Fender/Squier" }));
  const contradiction: PriorityItem = {
    id: "ai-confirmed-contradiction",
    title: "6 AI answers contradict a verified Fender fact",
    why: "6 of 101 checked answers stated something an official Fender page contradicts.",
    severity: "critical",
    spokeId: "aeo",
    subTab: "Product Fact Checks",
  };
  // One checked commercial answer joins the Priorities count, so the action's accuracy uses its own 101.
  const calls = [{ ...allLed[0], material_hallucination: "none" }, ...allLed.slice(1)];
  const feeds = buildHubSlots(input({ ai: aiWithFactChecks(6, calls), commandItems: [contradiction] }));
  const [aiGap, aiOpportunity, aiAction] = slots(feeds["spoke-aeo"]);
  assert.equal(aiGap.label, "Checked answers that contradict a verified fact");
  assert.equal(aiGap.figure, "6.0%");
  assert.equal(aiGap.countedOutOf.text, "6 of 100 answers checked against a verified fact");
  assert.equal(aiGap.target.text, "Target: Fact-check accuracy above 98% (now 94.0%)");
  assert.equal(aiGap.statusWord, "Needs attention");
  assert.deepEqual([aiGap.spokeId, aiGap.subTab], ["aeo", "Product Fact Checks"]);

  assert.match(aiOpportunity.target.text, /^Target: AI Foundation above 70 \(now /);

  assert.equal(aiAction.label, contradiction.title);
  assert.equal(aiAction.countedOutOf.text, "6 of 101 answers checked against a verified fact");
  assert.equal(aiAction.target.text, "Target: Fact-check accuracy above 98% (now 94.1%)");
  assert.equal(aiAction.statusWord, "Critical");
});

test("the opportunity adds the most score points by the approved weights", () => {
  const feeds = buildHubSlots(input());
  const [, opportunity] = slots(feeds["spoke-retail"]);
  // Active products available has no input, so 35 + 25 + 15 + 10 rescale to 100.
  const mapWeight = (100 * 10) / 85;
  const commerce = (90 * 35 + 90 * 25 + 90 * 15 + 50 * 10) / 85;
  assert.equal(opportunity.figure, `+${((mapWeight * 50) / 100).toFixed(1)}`);
  assert.equal(opportunity.label, "AI Commerce points if no listing was below MAP");
  assert.equal(opportunity.countedOutOf.text, "30 of 60 listings with a stored MAP comparison fall short");
  assert.equal(opportunity.target.text, `Target: AI Commerce above 70 (now ${commerce.toFixed(1)})`);
  assert.equal(opportunity.note, "This check carries 11.8% of AI Commerce.");
  assert.deepEqual([opportunity.spokeId, opportunity.subTab], ["ecommerce", "Retail Overview"]);

  const [, radarOpportunity] = slots(feeds["spoke-competitors"]);
  assert.match(radarOpportunity.label, /^AI Foundation points if Fender\/Squier led the Electric/);
  assert.equal(radarOpportunity.countedOutOf.text, "4 of 12 resolved unbranded electric answers");
  assert.equal(radarOpportunity.subTab, "Competitor Wins");

  const [, aiOpportunity] = slots(feeds["spoke-aeo"]);
  assert.match(aiOpportunity.label, /^AI Foundation points if Fender\/Squier led every unbranded answer$/);
  assert.equal(aiOpportunity.countedOutOf.text, "6 of 15 resolved unbranded answers fall short");
  assert.deepEqual([aiOpportunity.spokeId, aiOpportunity.subTab], ["hub", "Performance"]);
});

test("the action is the first Priorities item that opens the bubble, with its stored count", () => {
  const feeds = buildHubSlots(input());
  const [, , retailAction] = slots(feeds["spoke-retail"]);
  assert.equal(retailAction.label, "Buy Box withheld: 10 listings");
  assert.equal(retailAction.figure, "10");
  assert.equal(retailAction.countedOutOf.text, "10 of 100 current Buy Box readings");
  assert.equal(retailAction.statusWord, "Critical");
  assert.equal(retailAction.tone, "danger");
  assert.equal(retailAction.lastChecked.text, "Last checked Nov 1, 2026");
  assert.deepEqual([retailAction.spokeId, retailAction.subTab], ["ecommerce", "Retail Overview"]);

  const [, , specsAction] = slots(feeds["spoke-specs"]);
  assert.equal(specsAction.label, "fender.com pages are missing machine-readable specs");
  assert.equal(specsAction.countedOutOf.text, "4 of 10 found fender.com pages");
  assert.equal(specsAction.statusWord, "High");

  const onlyBullets = buildHubSlots(input({ commandItems: [ITEMS[3]] }));
  const [, , bulletsAction] = slots(onlyBullets["spoke-specs"]);
  assert.equal(bulletsAction.subTab, "Amazon A+ Matrix");
  assert.equal(bulletsAction.countedOutOf.text, "1 of 10 live Amazon listings read");
  assert.equal(bulletsAction.statusWord, "Moderate");

  const [, , aiAction] = slots(feeds["spoke-aeo"]);
  assert.equal(aiAction.figure, "None");
  assert.match(aiAction.rule, /^No Priorities item opens AI Search Visibility today/);
  assert.equal(aiAction.countedOutOf.text, "0 of 4 open priorities");
  assert.deepEqual([aiAction.chart?.part, aiAction.chart?.total], [0, 4]);

  const [, , summaryAction] = slots(feeds.hub);
  assert.equal(summaryAction.label, ITEMS[0].title);
  assert.equal(summaryAction.rule, "This is the first item in Priorities, which lists critical items first, then high, then moderate.");
  assert.equal(
    retailAction.rule,
    "This is the first item that opens Catalog Health in Priorities, which lists critical items first, then high, then moderate.",
  );
});

test("the Phase 1 dollar figure stays an analyst estimate with no invented inputs", () => {
  const [, estimate] = slots(buildHubSlots(input())["spoke-fixes"]);
  assert.equal(estimate.figure, "+$680K");
  assert.equal(estimate.statusWord, "Analyst estimate");
  assert.match(estimate.note, /Analyst estimate/);
  assert.equal(estimate.chart, null);
  assert.equal(estimate.target.text, "No target set");
  assert.equal(estimate.countedOutOf.text, "Not available*");
  assert.ok(estimate.countedOutOf.definition);
  assert.equal(estimate.lastChecked.text, "Last checked Not available*");
  assert.deepEqual([estimate.spokeId, estimate.subTab], ["suggestions", "Revenue Estimates"]);
});

test("missing reads are left out, never counted as zero", () => {
  const loading = buildHubSlots(input({ retail: { phase: "loading" } }));
  const [retailGap, retailOpportunity] = slots(loading["spoke-retail"]);
  assert.equal(retailGap.figure, "Loading");
  assert.equal(retailOpportunity.figure, "Loading");

  const failed = buildHubSlots(input({ retail: { phase: "error" } }));
  const [failedGap, failedOpportunity] = slots(failed["spoke-retail"]);
  assert.equal(failedGap.figure, "Not available*");
  assert.ok(failedGap.figureDefinition);
  assert.equal(failedOpportunity.figure, "Not available*");
  // Pages (4 of 10) and unbranded answers (6 of 15) tie at 40%. The larger count wins.
  const [summaryGap] = slots(failed.hub);
  assert.equal(summaryGap.label, "Unbranded answers Fender/Squier did not lead");
  const [roadmapGap] = slots(failed["spoke-roadmap"]);
  assert.equal(roadmapGap.figure, "Not available*");
});

test("Competitive Radar compares categories with enough resolved answers", () => {
  const [gap] = slots(buildHubSlots(input())["spoke-competitors"]);
  assert.equal(gap.label, "Electric answers another brand led");
  assert.equal(gap.countedOutOf.text, "4 of 12 resolved unbranded electric answers");
  assert.match(gap.rule, /at least 10 resolved answers/);
  assert.equal(gap.subTab, "Category Battlecards");

  const [small] = slots(buildHubSlots(input({ ai: readyAi() }))["spoke-competitors"]);
  assert.match(small.rule, /^No unbranded category has 10 resolved answers yet/);
});

test("Strategy Roadmap measures AI Consensus against its approved band", () => {
  const [gap] = slots(buildHubSlots(input())["spoke-roadmap"]);
  assert.match(gap.target.text, /^Target: AI Consensus above 70 \(now \d+\.\d\)$/);
  assert.match(gap.countedOutOf.text, /^\d+\.\d of 100 points, from 2 of 3 pillars$/);
  assert.deepEqual([gap.spokeId, gap.subTab], ["hub", "Performance"]);
});

test("slot definitions use the custom tooltip, never a native title", () => {
  const source = read("lib/canvas-sdk/HubSlots.tsx");
  assert.match(source, /className="ifai-term"/);
  assert.match(source, /data-ifai-tooltip-title=/);
  assert.match(source, /data-ifai-tooltip-desc=/);
  assert.doesNotMatch(source, /(?<![-\w])title=/);
  assert.match(source, /import "@\/lib\/canvas-sdk\/hub-slots.css"/);
});

test("citation pies use the same totals as the tables", () => {
  const calls = [
    call({ id: "u1", sim_id: 1 }),
    call({ id: "u2", sim_id: 2, outcome: "competitor_win" }),
    call({ id: "b1", sim_id: 3, prompt: "Is the Fender Stratocaster a good guitar" }),
    call({ id: "b2", sim_id: 4, prompt: "Is a Squier a good bass" }),
  ];
  const citations: AiCitationRow[] = [
    {
      audit_run_id: "run",
      sim_id: 1,
      simulation_id: "u1",
      prompt_key: "p",
      prompt_kind: "commercial",
      category: "beginner",
      engine: "chatgpt",
      position: 1,
      url: "https://www.fender.com/guitars",
      domain: "fender.com",
      title: "Fender",
    },
    {
      audit_run_id: "run",
      sim_id: 1,
      simulation_id: "u1",
      prompt_key: "p",
      prompt_kind: "commercial",
      category: "beginner",
      engine: "chatgpt",
      position: 2,
      url: "https://www.sweetwater.com/guitars",
      domain: "sweetwater.com",
      title: "Sweetwater",
    },
  ];
  const read = citationEvidence(calls, citations, "commercial");
  const pies = citationPies(read);
  assert.ok(pies);
  assert.equal(pies.some((pie) => (pie.id as string) === "answers"), false);
  const classes = pies.find((pie) => pie.id === "classes");
  const owned = pies.find((pie) => pie.id === "owned");
  assert.equal(classes?.total, read.rows.length);
  assert.equal(owned?.total, read.rows.length);
  assert.equal(
    classes?.slices.reduce((sum, slice) => sum + slice.count, 0),
    read.rows.length,
  );
  assert.equal(
    owned?.slices.reduce((sum, slice) => sum + slice.count, 0),
    read.rows.length,
  );
  assert.equal(owned?.slices.find((slice) => slice.key === "owned")?.count, 1);
});
