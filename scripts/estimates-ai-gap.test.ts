// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/estimates-ai-gap.test.ts
//
// Lines 8 and 9 (chunk E5 light v1, approved 18 Nov 2026) and Enterprise Potential's AI part, from the
// fixture listings and the AI rates the proposal read on 17 Nov 2026 (docs/dollar-estimates-proposal.md,
// sections 3 and 5). The proposal ran AI_UNBRANDED_SHARE and AI_BRANDED_SHARE at 1% low; Brian moved
// the low to 1.5% on 18 Nov (benchmark register change 4), so only the low figures differ.
import assert from "node:assert/strict";
import { test } from "node:test";
import { getClientSettings } from "../lib/client/active-client.ts";
import { estimateAiLines, relativeGap, retailerShareOf, unbrandedTarget, type AiGapInputs } from "../lib/estimates/ai-gap.ts";
import { withAiEstimates } from "../lib/estimates/ai-gap-read.ts";
import { ENTERPRISE_AI_MISSING_NOTE, estimateEnterprise } from "../lib/estimates/enterprise.ts";
import { buildClientEstimates } from "../lib/estimates/live-inputs.ts";
import { enterprisePotentialEstimate } from "../lib/fender-canvas/analyst-estimates.ts";
import { ESTIMATE_LOADING } from "../lib/fender-canvas/analyst-estimates.ts";
import { loadEstimatesFixture } from "./fixtures/estimates/load.ts";

function near(actual: number | null | undefined, expected: number, tolerance: number, label: string): void {
  assert.ok(typeof actual === "number", `${label} is missing`);
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label} expected ${expected}, got ${actual}`);
}

function measured(client: "fender" | "ledlenser") {
  const fx = loadEstimatesFixture(client);
  return buildClientEstimates(fx.listings, { rankCategory: fx.rankCategory, dataAsOf: fx.readOn, salesSources: "measured_only", revenue: getClientSettings(client).revenue_inputs });
}

// The proposal's reads, 17 Nov 2026. Retailers were 27.2% of citations in Fender's rival-led
// Unbranded Discovery answers (758) and 12.1% of Ledlenser's (496).
const FENDER_AI: AiGapInputs = {
  unbranded: { wins: 134, resolved: 251 },
  branded: { wins: 72, resolved: 78 },
  topRival: { brand: "Gibson", wins: 40, resolved: 251 },
  rivalLedCitations: { total: 758, retailer: 206 },
  asOf: "2026-11-17",
};
const LEDLENSER_AI: AiGapInputs = {
  unbranded: { wins: 3, resolved: 79 },
  branded: { wins: 38, resolved: 52 },
  topRival: { brand: "Petzl", wins: 19, resolved: 79 },
  rivalLedCitations: { total: 496, retailer: 60 },
  asOf: "2026-11-17",
};

test("line 8 reproduces the proposal: Fender $90K ($338K high), Ledlenser $2.4K, capped at doubling", () => {
  const fender = measured("fender");
  near(fender.catalog.annualSales.mid, 20695240, 1, "Fender sales base");
  const f = estimateAiLines(FENDER_AI, fender.catalog, "2026-11-17").unbranded;
  assert.equal(f.status, "estimated");
  near(f.range?.mid, 90040, 2, "Fender line 8 mid");
  near(f.range?.high, 337649, 2, "Fender line 8 high");
  // Proposal low $11,255 at a 1% share; at the approved 1.5% it is 1.5 times that.
  near(f.range?.low, 11255 * 1.5, 2, "Fender line 8 low");
  assert.match(String(f.trail.inputs.find((i) => i.key === "target")?.value), /Good band, 65%/);
  assert.equal(f.trail.confidence, "low");
  assert.equal(f.label, "analyst estimate");
  assert.equal(f.countsInTotal, false);

  const ledlenser = measured("ledlenser");
  const l = estimateAiLines(LEDLENSER_AI, ledlenser.catalog, "2026-11-17").unbranded;
  near(l.range?.mid, 2447, 1, "Ledlenser line 8 mid");
  near(l.range?.high, 9178, 1, "Ledlenser line 8 high");
  assert.match(String(l.trail.inputs.find((i) => i.key === "target")?.value), /Petzl/);
  assert.match(String(l.trail.inputs.find((i) => i.key === "relative_gap")?.value), /100%, capped/);
});

test("line 9: Fender at target reads $0 and says so; Ledlenser reproduces $567", () => {
  const f = estimateAiLines(FENDER_AI, measured("fender").catalog).branded;
  assert.equal(f.status, "estimated");
  assert.deepEqual(f.range, { low: 0, mid: 0, high: 0 });
  assert.equal(f.asterisk, false);
  assert.ok(f.trail.notes.some((n) => /^At target: 92\.3% against 90%/.test(n)));
  const l = estimateAiLines(LEDLENSER_AI, measured("ledlenser").catalog).branded;
  near(l.range?.mid, 567, 1, "Ledlenser line 9 mid");
  near(l.range?.high, 2125, 2, "Ledlenser line 9 high");
});

test("targets, gap and retailer share follow the proposal's rules", () => {
  assert.equal(unbrandedTarget(LEDLENSER_AI).rate, 19 / 79);
  assert.equal(unbrandedTarget(FENDER_AI).rate, 0.65);
  assert.deepEqual(relativeGap(0.7, 0.65), { gap: 0, capped: false });
  assert.deepEqual(relativeGap(0, 0.65), { gap: 1, capped: true });
  near(retailerShareOf(FENDER_AI.rivalLedCitations)! * 1000, 231, 1, "Fender retailer share x 1000");
  near(retailerShareOf(LEDLENSER_AI.rivalLedCitations)! * 1000, 103, 1, "Ledlenser retailer share x 1000");
  assert.equal(retailerShareOf({ total: 0, retailer: 0 }), null);
});

test("Enterprise Potential adds the AI part less the retailer share: Fender about $12M on the $1B placeholder", () => {
  const est = measured("fender");
  const lines = estimateAiLines(FENDER_AI, est.catalog);
  const withAi = estimateEnterprise(est.phase1, est.catalog, est.revenue ?? null, null, { rates: lines.rates, retailerShare: lines.retailerShare });
  const listing = est.enterprise.range!;
  const aiPart = withAi.trail.inputs.find((i) => i.key === "ai_part")?.value as number;
  // AI part: 0.435% of $1B x (1 - 23.1%), about $3.3M; listing part about $8.7M.
  near(aiPart, 3.35e6, 0.05e6, "Fender AI part mid");
  near(withAi.range!.mid, listing.mid + aiPart, 1, "Fender Enterprise mid");
  near(withAi.range!.mid, 12.0e6, 0.1e6, "Fender Enterprise mid, proposal $12.0M");
  assert.ok(!withAi.trail.notes.includes(ENTERPRISE_AI_MISSING_NOTE));
  assert.ok(est.enterprise.trail.notes.includes(ENTERPRISE_AI_MISSING_NOTE));
  // Never added to Phase 1.
  assert.deepEqual(est.phase1.parts?.map((p) => p.lineId), ["out_of_stock", "buy_box", "splintered", "missing_specs", "aplus"]);
});

test("a failed AI read: the AI lines read Not available* and Enterprise keeps the listing-fix part and its note", () => {
  const est = measured("ledlenser");
  const read = withAiEstimates({ phase: "ready", estimates: est }, { phase: "error", message: "timeout" });
  assert.equal(read?.phase, "ready");
  if (read?.phase !== "ready") return;
  assert.equal(read.estimates.ai?.phase, "error");
  assert.deepEqual(read.estimates.enterprise.range, est.enterprise.range);
  assert.ok(read.estimates.enterprise.trail.notes.includes(ENTERPRISE_AI_MISSING_NOTE));
  // While the AI read loads, Enterprise reads Loading rather than flipping later.
  const loading = withAiEstimates({ phase: "ready", estimates: est }, { phase: "loading" });
  assert.equal(enterprisePotentialEstimate({ estimates: loading }), ESTIMATE_LOADING);
});

test("no resolved answers in the window reads Not available*, never $0", () => {
  const est = measured("ledlenser");
  const lines = estimateAiLines({ ...LEDLENSER_AI, unbranded: { wins: 0, resolved: 0 } }, est.catalog);
  assert.equal(lines.unbranded.status, "not_available");
  assert.equal(lines.unbranded.range, null);
});
