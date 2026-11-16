/**
 * Action Items · Urgent Interventions: the action line for each of the five current findings.
 * The rows render in React (ActionItemsFixTable), where DefinedCopy marks glossary terms the way
 * annotateGlossary marks them in the HTML tabs.
 */

import {
  BRIEFING_COUNT_MISSING,
  type BriefingFinding,
  type BriefingFindingId,
} from "@/lib/fender-canvas/briefing-retail-lead";
import { brandName, brandSite } from "@/lib/brand-copy";

export function hasStoredReading(finding: BriefingFinding): boolean {
  return (
    finding.ratio != null &&
    finding.numerator != null &&
    finding.denominator != null &&
    finding.percent !== BRIEFING_COUNT_MISSING
  );
}

/** Operator next step when the finding has a stored N of M. Two sentences at most. */
const STORED_ACTIONS: Record<BriefingFindingId, string> = {
  buy_box:
    "These listings have no one-click offer. Correct each offer so a shopper can add the product to the cart.",
  map_leakage:
    "These offers are advertised below the lowest price a partner agreed to show. Raise those prices back to that floor.",
  splintered_bundles:
    "These bundles are their own listings, so their reviews stay split. Nest each bundle under the official parent listing so the reviews sit on one page.",
  exact_official_product:
    `Publish one ${brandSite()} page for each exact product that does not have one. A page for the whole line covers more than one model, so an assistant can attach the wrong specs.`,
  unbranded_discovery:
    `When someone asks what to buy without naming ${brandName()}, assistants name ${brandName()} this often. Fix the withheld offers, the prices under the floor, the split bundles, and the missing exact pages, which are what an assistant can repeat.`,
};

/** When the figure is missing, do not advise as if the count were known. */
const MISSING_ACTIONS: Record<BriefingFindingId, string> = {
  buy_box: "The Buy Box reading is not stored.",
  map_leakage: "The MAP reading is not stored.",
  splintered_bundles: "The catalog reading is not stored.",
  exact_official_product: "The official-page reading is not stored.",
  unbranded_discovery: "The AI Search reading is not stored.",
};

export function findingAction(finding: BriefingFinding): string {
  return hasStoredReading(finding) ? STORED_ACTIONS[finding.id] : MISSING_ACTIONS[finding.id];
}
