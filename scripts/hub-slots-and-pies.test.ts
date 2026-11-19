// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/hub-slots-and-pies.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { citationEvidence } from "../lib/ai-search/citations.ts";
import { citationPies } from "../lib/ai-search/citation-pies.ts";
import type { AiCallRow, AiCitationRow, AiSearchRead } from "../lib/ai-search/types.ts";
import { buildHubSlots } from "../lib/fender-canvas/hub-slots.ts";
import type { SuppressionDetail } from "../lib/fender-canvas/portfolio-retail.ts";
import type { RetailReading } from "../lib/fender-canvas/portfolio-retail.ts";
import type { FindabilityRow } from "../lib/findability/outcomes.ts";

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

function suppressed(count: number, population: number): RetailReading<SuppressionDetail | null> {
  return {
    status: count > 0 ? "available_with_issues" : "available_with_zero",
    issueCount: count,
    missingMessage: null,
    headlineLabel: "Suppressed Listings",
    headlineNoun: "listing",
    detail: {
      counts: {
        population,
        current: population,
        classified: population,
        confirmedHighPrice: count,
        benchmarkPresent: population,
      },
      suppressed: count,
      audited: population,
      population,
      withThreshold: population,
    } as SuppressionDetail,
  };
}

function readyAi(): AiSearchRead {
  const calls = [
    call({ id: "u1", sim_id: 1, prompt: "Best guitar under $300", outcome: "fender_win" }),
    call({ id: "u2", sim_id: 2, prompt: "Best bass under $400", outcome: "competitor_win", primary_brand: "Yamaha" }),
    call({ id: "b1", sim_id: 3, prompt: "Is the Fender Stratocaster a good first guitar", outcome: "fender_win" }),
    call({ id: "b2", sim_id: 4, prompt: "Is a Squier Affinity a good bass", outcome: "fender_win" }),
  ];
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
      calls,
      probes: [],
      citations: [],
    },
  };
}

const findabilityRows = [
  { latest_state: "exact_official_product" },
  { latest_state: "exact_official_product" },
  { latest_state: "official_family_page" },
  { latest_state: "completed_not_found" },
  { latest_state: "ambiguous_candidate" },
  { latest_state: "not_checked" },
] as FindabilityRow[];

test("retail slots use one population and name a danger in words", () => {
  const feeds = buildHubSlots({
    suppressed: suppressed(39, 993),
    ai: { phase: "loading" },
    findability: { phase: "loading" },
    missingSpecPages: 12,
    phaseOneValue: "+$680K",
    phaseOneDetail: "Phase 1 annual estimate",
    commandItems: [
      {
        id: "buybox",
        title: "Suppressed listings need a price match",
        why: "Open the suppressed listings.",
        severity: "critical",
        spokeId: "ecommerce",
        subTab: "Suppressed Listings",
      },
    ],
  });
  const [gap, opportunity, action] = feeds["spoke-retail"].slots;
  assert.equal(gap.figure, "39");
  assert.equal(gap.statusWord, "Needs attention");
  assert.equal(gap.chart?.part, 39);
  assert.equal(gap.chart?.total, 993);
  assert.equal(opportunity.figure, "954");
  assert.equal(opportunity.chart?.part, 954);
  assert.equal((gap.chart?.part ?? 0) + (opportunity.chart?.part ?? 0), 993);
  assert.equal(action.statusWord, "Needs attention");
  assert.match(action.detail, /suppressed listings/i);
  const aiAction = feeds["spoke-aeo"].slots[2];
  assert.equal(aiAction.spokeId, "aeo");
  assert.equal(aiAction.figure, "Open");
  assert.doesNotMatch(aiAction.label, /Suppressed|Buy Box|price match/);
  assert.equal(feeds.hub, undefined);
  assert.equal(feeds["spoke-fixes"], undefined);
  assert.equal(feeds["spoke-roadmap"], undefined);
  assert.deepEqual(Object.keys(feeds).sort(), ["spoke-aeo", "spoke-competitors", "spoke-retail", "spoke-specs"]);
});

function specsSlots(rows: FindabilityRow[]) {
  const feeds = buildHubSlots({
    suppressed: "loading",
    ai: { phase: "loading" },
    findability: { phase: "ready", rows, dealerBundleLoaded: true },
    missingSpecPages: 4,
    phaseOneValue: "+$680K",
    phaseOneDetail: "Phase 1 annual estimate",
    commandItems: [],
  });
  return feeds["spoke-specs"].slots;
}

test("findability cards follow the exact-page share bands", () => {
  const rows = (exact: number, total: number) =>
    Array.from({ length: total }, (_, i) => ({
      latest_state: i < exact ? "exact_official_product" : "completed_not_found",
    })) as FindabilityRow[];
  const [lowGap, lowExact] = specsSlots(rows(1, 12));
  assert.equal(lowGap.tone, "danger");
  assert.equal(lowExact.tone, "danger");
  const [midGap, midExact] = specsSlots(rows(4, 12));
  assert.equal(midGap.tone, "warning");
  assert.equal(midExact.tone, "warning");
  const [highGap, highExact] = specsSlots(rows(10, 12));
  assert.equal(highGap.tone, "success");
  assert.equal(highExact.tone, "success");
  assert.equal(lowGap.label, "Listings not matched to an exact official page");
  assert.equal(lowExact.label, "Listings matched to an exact official page");
});

test("findability and AI slots keep their denominators", () => {
  const feeds = buildHubSlots({
    suppressed: "loading",
    ai: readyAi(),
    findability: { phase: "ready", rows: findabilityRows, dealerBundleLoaded: true },
    missingSpecPages: 4,
    phaseOneValue: "+$680K",
    phaseOneDetail: "Phase 1 annual estimate",
    commandItems: [],
  });
  const [pagesGap, exact] = feeds["spoke-specs"].slots;
  assert.equal(exact.figure, "2");
  assert.equal(exact.chart?.total, 6);
  assert.equal(pagesGap.chart?.part, 4);
  assert.equal(pagesGap.chart?.unit, undefined);
  assert.match(exact.detail, /1 family page/);
  const [aiGap, branded] = feeds["spoke-aeo"].slots;
  assert.equal(aiGap.chart?.total, 2);
  assert.equal(aiGap.chart?.part, 1);
  assert.equal(aiGap.chart?.unit, "answers");
  assert.match(aiGap.detail, /1 of 2/);
  assert.equal(branded.chart?.part, 2);
  assert.equal(branded.chart?.total, 2);
  assert.match(branded.note, /Published run/);
  const aiAction = feeds["spoke-aeo"].slots[2];
  assert.equal(aiAction.figure, "1");
  assert.equal(aiAction.label, "Unbranded answers to review");
  assert.equal(aiAction.spokeId, "aeo");
});

test("AI Search cards follow their own role's bubble bands", () => {
  const withWins = (wins: number, total: number, bWins: number, bTotal: number): AiSearchRead => {
    const ai = readyAi();
    if (ai.phase !== "ready") throw new Error("ready read expected");
    const branded = Array.from({ length: bTotal }, (_, i) =>
      call({
        id: `b${i}`,
        sim_id: 300 + i,
        prompt: "Is the Fender Stratocaster a good first guitar",
        outcome: i < bWins ? "fender_win" : "competitor_win",
        primary_brand: i < bWins ? "Fender/Squier" : "Yamaha",
      }),
    );
    const calls = Array.from({ length: total }, (_, i) =>
      call({
        id: `x${i}`,
        sim_id: 100 + i,
        prompt: `Best guitar number ${i}`,
        outcome: i < wins ? "fender_win" : "competitor_win",
        primary_brand: i < wins ? "Fender/Squier" : "Yamaha",
      }),
    );
    return { ...ai, snapshot: { ...ai.snapshot, calls: [...calls, ...branded] } };
  };
  const tones = (wins: number, total: number, bWins: number, bTotal: number) => {
    const feeds = buildHubSlots({
      suppressed: "loading",
      ai: withWins(wins, total, bWins, bTotal),
      findability: { phase: "loading" },
      missingSpecPages: 0,
      phaseOneValue: "+$680K",
      phaseOneDetail: "Phase 1 annual estimate",
      commandItems: [],
    });
    return feeds["spoke-aeo"].slots.slice(0, 2).map((s) => s.tone);
  };
  // Gap card: unbranded share (20% danger, 50% warning, 80% success). Opportunity card: branded share (60% danger, 80% warning, 95% success).
  assert.deepEqual(tones(1, 5, 3, 5), ["danger", "danger"]);
  assert.deepEqual(tones(1, 2, 4, 5), ["warning", "warning"]);
  assert.deepEqual(tones(4, 5, 19, 20), ["success", "success"]);
  assert.deepEqual(tones(4, 5, 3, 5), ["success", "danger"]);
  assert.deepEqual(tones(1, 5, 19, 20), ["danger", "success"]);
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
