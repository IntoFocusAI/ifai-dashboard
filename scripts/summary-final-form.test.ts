// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/summary-final-form.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { aiSearchStale } from "../lib/ai-search/stale.ts";
import { partialFigureTip } from "../lib/fender-canvas/canvas-reads.ts";
import {
  BRIEFING_COUNT_MISSING,
  briefingFindingsLead,
  SPLINTERED_LISTINGS_LABEL,
} from "../lib/fender-canvas/briefing-retail-lead.ts";
import {
  CONSENSUS_SCORE_TARGET,
  consensusPartial,
  pillarPartial,
  scoreAgainstTarget,
  scoreFigure,
  scoreStatus,
  scoreTargetLabel,
} from "../lib/fender-canvas/consensus-score-display.ts";
import { consensusScore, type CommerceInputs, type FoundationInputs } from "../lib/fender-canvas/consensus-scores.ts";
import {
  divisionCellText,
  divisionPopulation,
  divisionRowModels,
} from "../lib/fender-canvas/division-rows.ts";
import { isExportTable } from "../lib/export/tables.ts";

function read(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const share = (numerator: number, denominator: number) => ({ numerator, denominator });

const FOUNDATION: FoundationInputs = {
  exactOfficialPages: share(30, 100),
  machineReadableSpecs: share(40, 100),
  requiredMarketplaceSpecs: share(50, 100),
  unbrandedNamedMost: share(60, 100),
  factCheckMatch: share(70, 100),
};

const COMMERCE: CommerceInputs = {
  controlledBuyBox: share(80, 100),
  notSuppressed: share(90, 100),
  activeProductsAvailable: null,
  notSplintered: share(70, 100),
  noMapViolation: share(60, 100),
};

test("H-07: each score reads against target 70 as whole points", () => {
  assert.equal(CONSENSUS_SCORE_TARGET, 70);
  assert.equal(scoreFigure(41.4), "41");
  assert.equal(scoreFigure(null), "Not available");
  assert.equal(scoreTargetLabel(), "vs target 70");
  assert.equal(scoreAgainstTarget(41.4), "41 vs target 70");
  assert.equal(scoreAgainstTarget(null), null);
});

test("score status follows the score bands: Poor below 40, Fair 40 to 70, Good above 70", () => {
  assert.equal(scoreStatus(39.9), "bad");
  assert.equal(scoreStatus(40), "okay");
  assert.equal(scoreStatus(70), "okay");
  assert.equal(scoreStatus(70.1), "good");
  assert.equal(scoreStatus(null), null);
});

test("X-25: AI Consensus and a pillar that leave out inputs carry the partial reading", () => {
  const consensus = consensusScore(FOUNDATION, COMMERCE);
  const whole = pillarPartial(consensus.foundation);
  assert.equal(whole, null, "every Foundation component is in");

  const commerce = pillarPartial(consensus.commerce);
  assert.ok(commerce);
  assert.equal(commerce.reason, "coverage");
  assert.match(commerce.missing, /Active products available is left out of AI Commerce/);
  assert.equal(commerce.coverage, "4 of 5 components");
  assert.match(partialFigureTip(commerce), /never counted as zero/);

  const overall = consensusPartial(consensus);
  assert.ok(overall);
  assert.match(overall.missing, /AI Actuation is left out of AI Consensus: it has no owner, evidence, or dated records yet/);
  assert.equal(overall.coverage, "2 of 3 pillars");
  assert.doesNotMatch(partialFigureTip(overall), /—|n't/);
});

test("Briefing: a loading read says Loading on the card, a failed read stays Not available*", () => {
  const loading = briefingFindingsLead({ phase: "loading" }, { phase: "loading" }, { phase: "loading" });
  for (const finding of loading.findings) {
    assert.equal(finding.loading, true, finding.id);
    assert.equal(finding.percent, BRIEFING_COUNT_MISSING, "the fix list keeps Not available*");
  }
  const failed = briefingFindingsLead(
    { phase: "error" },
    { phase: "error", message: "x" },
    { phase: "error", message: "x" },
  );
  for (const finding of failed.findings) {
    assert.equal(finding.loading, false, finding.id);
    assert.equal(finding.percent, BRIEFING_COUNT_MISSING);
  }
  const ai = failed.findings.find((finding) => finding.id === "unbranded_discovery");
  assert.match(ai?.explainer ?? "", /did not load/);
  const map = failed.findings.find((finding) => finding.id === "map_leakage");
  assert.equal(map?.tab, "MAP Leakage");
});

test("X-18: the Briefing names the bundle finding Splintered Listings", () => {
  const lead = briefingFindingsLead({ phase: "error" }, { phase: "loading" }, { phase: "loading" });
  assert.equal(lead.findings[2].label, SPLINTERED_LISTINGS_LABEL);
  assert.equal(SPLINTERED_LISTINGS_LABEL, "Splintered Listings");
  assert.doesNotMatch(read("lib/fender-canvas/briefing-retail-lead.ts"), /Splintered bundles/);
});

test("X-25: a stale published run marks the Briefing AI figure", () => {
  const old = new Date(Date.now() - 10 * 86_400_000).toISOString();
  const stale = aiSearchStale({ published_at: old, completed_at: old });
  assert.ok(stale);
  const lead = briefingFindingsLead({ phase: "loading" }, { phase: "loading" }, { phase: "loading" }, { aiStale: stale });
  // No figure while the read loads, so no asterisk either.
  assert.equal(lead.findings[4].partial, null);
});

test("decision 7: Summary AI figures read the map's population, not the date-pill context", () => {
  const hook = read("components/v3/live/useSummaryAiRead.ts");
  assert.match(hook, /useMapAiSearch\(useAiHistory\(\)\.current\)/);
  for (const file of [
    "components/v3/live/BriefingRetailHero.tsx",
    "components/v3/live/ConsensusScoresPanel.tsx",
  ]) {
    const source = read(file);
    assert.match(source, /useSummaryAiRead\(\)/, file);
    assert.doesNotMatch(source, /useAiSearch\(\)/, file);
  }
  const lead = read("components/v3/live/BriefingConsensusLead.tsx");
  assert.doesNotMatch(lead, /useAiSearch\(\)/);
  assert.match(lead, /authorizedPartners/, "the Briefing score uses the same partners as Performance");
});

test("X-33 / X-10: the division table sorts every column, searches, and downloads CSV", () => {
  const table = read("components/v3/live/FenderDivisionsTable.tsx");
  assert.match(table, /<ResizableTable/);
  assert.match(table, /useClientTableSort\(/);
  assert.equal((table.match(/sort: "(text|number)"/g) ?? []).length, 4);
  assert.ok(isExportTable("catalog-divisions"));
  assert.match(read("lib/export/load-table.ts"), /"catalog-divisions": loadDivisionsSource/);

  const rows = divisionRowModels(
    [
      { division: "Solid Body", monitored_skus: 4, buybox_pct: null, schema_sync_pct: null, splinter_bundles: 1, primary_threat: null, strategic_action: null },
      { division: "Pegs", monitored_skus: null, buybox_pct: null, schema_sync_pct: null, splinter_bundles: null, primary_threat: null, strategic_action: null },
    ],
    { "solid body": { listings: 3, knownHolder: 2, amazonHolds: 1 } },
  );
  assert.equal(rows[0].bundles.share, 25);
  assert.equal(rows[0].buyBox.share, 50);
  assert.equal(rows[1].bundles.share, null);
  assert.equal(divisionCellText(rows[0].bundles), "25.0% (1 of 4 SKUs)");
  assert.equal(divisionCellText(rows[1].bundles), "Not available*");
  assert.match(divisionPopulation(rows), /^2 catalog divisions in the division read/);
});
