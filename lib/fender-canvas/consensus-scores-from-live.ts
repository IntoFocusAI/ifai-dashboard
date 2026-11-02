/**
 * Build consensus score inputs from the live canvas reads already on screen.
 * Does not invent shares. A missing read stays null and drops that component.
 */

import { summarizeRun } from "@/lib/ai-search/summary";
import type { AiSearchRead } from "@/lib/ai-search/types";
import {
  consensusScore,
  controlledBuyBoxFinding,
  controlledBuyBoxFromCensus,
  requiredMarketplaceSpecShare,
  type CommerceInputs,
  type CommerceScoreOptions,
  type ConsensusScore,
  type FoundationInputs,
  type ShareInput,
} from "@/lib/fender-canvas/consensus-scores";
import { countFindability } from "@/lib/findability/outcomes";
import type { FindabilityRead } from "@/lib/findability/copy";
import type { SpecPageSummary } from "@/lib/fender-canvas/machine-readability";
import type { PortfolioRetailSnapshot } from "@/lib/fender-canvas/portfolio-retail";
import type { RetailCanvasRead } from "@/lib/fender-canvas/portfolio-retail-display";

function share(numerator: number, denominator: number): ShareInput | null {
  if (!(denominator > 0) || numerator < 0 || numerator > denominator) return null;
  return { numerator, denominator };
}

export function foundationInputsFromLive(args: {
  findability: FindabilityRead;
  specPages: SpecPageSummary | null | undefined;
  retail: RetailCanvasRead;
  ai: AiSearchRead;
}): FoundationInputs {
  const { findability, specPages, retail, ai } = args;

  let exactOfficialPages: ShareInput | null = null;
  if (findability.phase === "ready") {
    const counts = countFindability(findability.rows);
    exactOfficialPages = share(counts.exact_official_product, counts.total);
  }

  let machineReadableSpecs: ShareInput | null = null;
  if (specPages && specPages.pages.length > 0) {
    machineReadableSpecs = share(specPages.withSpecBlock, specPages.pages.length);
  }

  let requiredMarketplaceSpecs: ShareInput | null = null;
  if (retail.phase === "ready") {
    const detail = retail.snapshot.amazonSpecGaps.detail;
    if (detail && detail.checked > 0) {
      requiredMarketplaceSpecs = requiredMarketplaceSpecShare(detail.gaps, detail.checked);
    }
  }

  let unbrandedNamedMost: ShareInput | null = null;
  let factCheckMatch: ShareInput | null = null;
  if (ai.phase === "ready") {
    const summary = summarizeRun(ai.snapshot);
    const unbranded = summary.roles.unbranded;
    unbrandedNamedMost = share(unbranded.fenderWins, unbranded.resolved);

    const coverage = summary.drift.coverage;
    if (coverage.answersChecked > 0) {
      const matched = coverage.answersChecked - coverage.contradictions;
      factCheckMatch = share(matched, coverage.answersChecked);
    }
  }

  return {
    exactOfficialPages,
    machineReadableSpecs,
    requiredMarketplaceSpecs,
    unbrandedNamedMost,
    factCheckMatch,
  };
}

export function commerceInputsFromSnapshot(
  snapshot: PortfolioRetailSnapshot,
  authorizedPartners: readonly string[] | null = null,
): CommerceInputs {
  const recomputed =
    authorizedPartners != null && snapshot.buyBoxSellers
      ? controlledBuyBoxFromCensus(snapshot.buyBoxSellers, authorizedPartners)
      : null;
  const buyBox = recomputed ?? snapshot.controlledBuyBox ?? null;
  const controlledBuyBox =
    buyBox && buyBox.known > 0 ? share(buyBox.controlled, buyBox.known) : null;

  const suppression = snapshot.suppressedListings.detail?.counts ?? null;
  const notSuppressed =
    suppression && suppression.current > 0
      ? share(suppression.current - suppression.withheld, suppression.current)
      : null;

  // No current in-stock / active-offer share is stored on the retail read for this score.
  // The 12-month out-of-stock history is a different fact and must not be converted here.
  const activeProductsAvailable: ShareInput | null = null;

  const bundles = snapshot.unnestedBundles.detail;
  const notSplintered =
    bundles && bundles.bundlesInRead > 0
      ? share(bundles.bundlesInRead - bundles.opportunities.length, bundles.bundlesInRead)
      : null;

  const map = snapshot.mapLeakage.detail;
  const noMapViolation =
    map && map.decided > 0 ? share(map.decided - map.violations, map.decided) : null;

  return {
    controlledBuyBox,
    notSuppressed,
    activeProductsAvailable,
    notSplintered,
    noMapViolation,
  };
}

export function commerceInputsFromLive(
  retail: RetailCanvasRead,
  authorizedPartners: readonly string[] | null = null,
): CommerceInputs | null {
  if (retail.phase !== "ready") return null;
  return commerceInputsFromSnapshot(retail.snapshot, authorizedPartners);
}

export function consensusFromLive(args: {
  findability: FindabilityRead;
  specPages: SpecPageSummary | null | undefined;
  retail: RetailCanvasRead;
  ai: AiSearchRead;
  authorizedPartners?: readonly string[] | null;
}): ConsensusScore | null {
  const authorizedPartners = args.authorizedPartners ?? null;
  const commerce = commerceInputsFromLive(args.retail, authorizedPartners);
  if (!commerce) return null;
  const options: CommerceScoreOptions = { authorizedPartners };
  return consensusScore(foundationInputsFromLive(args), commerce, options);
}

/** Re-export for callers that compute Controlled Buy Box outside the snapshot. */
export { controlledBuyBoxFinding };
