// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/export-brand-copy.test.ts
// A server export runs each request inside runWithClient. Every module below is imported here,
// outside any request, the way the export route imports them. Brand words must still follow the
// request's client, so none of this copy may be fixed at import time.
import assert from "node:assert/strict";
import { test } from "node:test";
import { OUTCOME_LABELS } from "../lib/ai-search/run-metrics.ts";
import { BATTLE_COLUMN_NOTES, LEAD_FILTER_LABELS, onTrackDefinition } from "../lib/ai-search/category-on-track.ts";
import { catalogPickTip, unverifiedFlagTip } from "../lib/ai-search/fact-check-copy.ts";
import type { ClientKey } from "../lib/client/active-client.ts";
import { runWithClient } from "../lib/client/server-client.ts";
import { actionItemsExportSource } from "../lib/export/action-items-export.ts";
import { pageFoundDefinition, pageFoundLabel } from "../lib/fender-canvas/ai-readiness-lead.ts";
import {
  enterprisePotentialEstimate,
  NO_ANALYST_ESTIMATE,
  phaseOneLiftEstimate,
} from "../lib/fender-canvas/analyst-estimates.ts";
import { briefingFindingsLead, type BriefingFinding } from "../lib/fender-canvas/briefing-retail-lead.ts";
import { CANVAS_READS } from "../lib/fender-canvas/canvas-reads.ts";
import { FOUNDATION_COMPONENT_SPECS } from "../lib/fender-canvas/consensus-scores.ts";
import { missingMachineSpecsDefinition } from "../lib/fender-canvas/machine-readability.ts";
import { pageFoundUnavailableTip } from "../lib/fender-canvas/page-found-hero.ts";
import { REASON_COLUMN_TOOLTIP } from "../lib/fender-canvas/page-found-reasons.ts";
import { STORED_REASONS } from "../lib/fender-canvas/page-found-stored-reason.ts";
import { mapPricesNotStored } from "../lib/fender-canvas/portfolio-retail.ts";
import { BRAND_FOCUS } from "../lib/fender-canvas/roadmap-focus.ts";
import { buildPlan } from "../lib/fender-canvas/roadmap-plan.ts";
import type { RoadmapPlanRead } from "../lib/fender-canvas/roadmap-plan-read.ts";
import { findingAction } from "../lib/fender-canvas/urgent-interventions-rows.ts";
import { machineReadabilityPointer, OUTCOME_DEFINITION } from "../lib/findability/copy.ts";

/** The five findings with a stored N of M, so each row carries its operator action line. */
function storedFindings(): BriefingFinding[] {
  const lead = briefingFindingsLead({ phase: "error", message: "x" }, { phase: "error", message: "x" }, { phase: "error", message: "x" });
  return lead.findings.map((finding) => ({ ...finding, percent: "40%", ratio: "4 of 10", numerator: 4, denominator: 10 }));
}

function exportText(): string {
  const plan = buildPlan({ findings: storedFindings(), signals: [], sources: [] });
  const read = { plan } as unknown as RoadmapPlanRead;
  const source = actionItemsExportSource(read, new Date("2026-11-17T12:00:00Z"), "Nov 17, 2026", BRAND_FOCUS);
  return source.rows.map((row) => row.cells.join(" | ")).join("\n");
}

/** Copy that names the brand, read the way a loader reads it: at call time. */
function brandCopy(): Record<string, string> {
  return {
    onTrackDefinition: onTrackDefinition(),
    battleLeader: BATTLE_COLUMN_NOTES.leader,
    leadFilter: LEAD_FILTER_LABELS.fender,
    outcomeLabel: OUTCOME_LABELS.fender_win,
    catalogPickTip: catalogPickTip(),
    unverifiedFlagTip: unverifiedFlagTip(),
    pageFoundLabel: pageFoundLabel(),
    pageFoundDefinition: pageFoundDefinition(),
    pageFoundUnavailableTip: pageFoundUnavailableTip(),
    specPagesRead: CANVAS_READS.specPages.label,
    namedMostComponent: FOUNDATION_COMPONENT_SPECS.find((spec) => spec.id === "unbranded_named_most")!.name,
    missingMachineSpecs: missingMachineSpecsDefinition(),
    reasonColumn: `${REASON_COLUMN_TOOLTIP.title} ${REASON_COLUMN_TOOLTIP.description}`,
    storedReason: `${STORED_REASONS.no_matching_model.label} ${STORED_REASONS.page_not_read.definition}`,
    mapPricesNotStored: mapPricesNotStored(),
    outcomeDefinition: OUTCOME_DEFINITION.exact_official_product,
    machinePointer: machineReadabilityPointer(),
  };
}

function inClient<T>(key: ClientKey, fn: () => T): Promise<T> {
  return runWithClient(key, async () => fn());
}

test("a Ledlenser fix-list download names Ledlenser and ledlenser.com, never Fender", async () => {
  const text = await inClient("ledlenser", exportText);
  assert.match(text, /When someone asks what to buy without naming Ledlenser, assistants name Ledlenser this often\./);
  assert.match(text, /Publish one ledlenser\.com page for each exact product that does not have one\./);
  assert.doesNotMatch(text, /fender/i);

  const actions = await inClient("ledlenser", () => storedFindings().map(findingAction).join(" "));
  assert.match(actions, /Ledlenser/);
  assert.match(actions, /ledlenser\.com/);
  assert.doesNotMatch(actions, /fender/i);
});

test("a Fender fix-list download still names Fender and fender.com", async () => {
  const text = await inClient("fender", exportText);
  assert.match(text, /When someone asks what to buy without naming Fender, assistants name Fender this often\./);
  assert.match(text, /Publish one fender\.com page for each exact product that does not have one\./);
  assert.doesNotMatch(text, /ledlenser/i);
});

test("analyst estimates come from each client's own read: a failed read is Not available* for every client", async () => {
  const failed = { estimates: { phase: "error" as const, message: "x" } };
  for (const client of ["ledlenser", "fender"]) {
    assert.deepEqual(await inClient(client, () => [phaseOneLiftEstimate(failed), enterprisePotentialEstimate(failed)]), [
      NO_ANALYST_ESTIMATE,
      NO_ANALYST_ESTIMATE,
    ]);
  }
  assert.equal(NO_ANALYST_ESTIMATE, "Not available*");
});

test("brand copy reachable from the export loaders follows the request's client", async () => {
  const ledlenser = await inClient("ledlenser", brandCopy);
  const fender = await inClient("fender", brandCopy);
  for (const [name, text] of Object.entries(ledlenser)) {
    assert.doesNotMatch(text, /fender|squier/i, `${name} names Fender in a Ledlenser request`);
    assert.match(text, /Ledlenser|ledlenser\.com/, `${name} names the brand`);
  }
  for (const [name, text] of Object.entries(fender)) {
    assert.doesNotMatch(text, /ledlenser/i, `${name} names Ledlenser in a Fender request`);
    assert.match(text, /Fender|fender\.com/, `${name} names the brand`);
  }
});
