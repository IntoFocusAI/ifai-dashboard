/**
 * The checks the hover slots choose from (FDD X-22). Each check is a stored count that
 * falls short, out of its own population, with the tab that lists those rows.
 * A read that is still loading is pending. A read with no population is left out, never zero.
 * Only approved thresholds become a target. Every other check reads No target set.
 */

import { categoryBattles } from "@/lib/ai-search/competitors";
import type { FactCheckCoverage } from "@/lib/ai-search/drift";
import { factCheckAccuracyLead } from "@/lib/ai-search/fact-check-copy";
import { categoryLabel } from "@/lib/ai-search/run-metrics";
import { summarizeRun } from "@/lib/ai-search/summary";
import type { AiSearchRead } from "@/lib/ai-search/types";
import type { NodeStatus } from "@/lib/canvas-sdk/types";
import {
  CONTROLLED_BUY_BOX_PLACEHOLDER_TOOLTIP,
  REQUIRED_SPECS_PLACEHOLDER_TOOLTIP,
  controlledBuyBoxFromCensus,
  requiredMarketplaceSpecShare,
} from "@/lib/fender-canvas/consensus-scores";
import { bulletCounts } from "@/lib/fender-canvas/listing-content";
import { specPageCounts } from "@/lib/fender-canvas/machine-readability";
import type { PortfolioRetailSnapshot } from "@/lib/fender-canvas/portfolio-retail";
import type { RetailCanvasRead } from "@/lib/fender-canvas/portfolio-retail-display";
import { specHero } from "@/lib/fender-canvas/retail-overview-lead";
import type { CanvasBundle } from "@/lib/fender-canvas/types";
import type { FindabilityRead } from "@/lib/findability/copy";
import { newestCheckedAttemptAt } from "@/lib/findability/last-checked";
import { countFindability } from "@/lib/findability/outcomes";

export type CheckId =
  | "buy_box_withheld"
  | "controlled_buy_box"
  | "map_violation"
  | "splintered"
  | "specs_complete"
  | "required_specs"
  | "machine_readable"
  | "exact_pages"
  | "five_bullets"
  | "unbranded"
  | "branded"
  | "fact_checks";

export type CheckTarget = {
  /** Approved threshold in words, such as "Specs complete at 98% and up". */
  text: string;
  /** Current value in the threshold's own unit. */
  now: string;
  tone: Exclude<NodeStatus, "neutral">;
};

export type SlotCheck = {
  id: string;
  label: string;
  failing: number;
  total: number;
  /** Plural noun phrase for M in "N of M". */
  population: string;
  failLabel: string;
  passLabel: string;
  /** Null reads No target set. */
  target: CheckTarget | null;
  /** Stored check times. The newest one is Last checked. */
  checkedAt: Array<string | null | undefined>;
  /** Names the read in "... has no stored check time." */
  source: string;
  spokeId: string;
  subTab: string;
  note: string;
  /** Definition behind the note, for a placeholder list. */
  noteDefinition?: string;
};

export type CategoryCheck = SlotCheck & {
  category: string;
  competitorWins: number;
};

export type SlotReads = {
  bundle?: CanvasBundle | null;
  /** Undefined is read as still loading. */
  retail?: RetailCanvasRead;
  ai: AiSearchRead;
  findability: FindabilityRead;
  /** Null keeps the placeholder partner list. */
  authorizedPartners?: readonly string[] | null;
};

export type CheckBook = {
  checks: Partial<Record<CheckId, SlotCheck>>;
  /** Checks whose read has not loaded yet. */
  pending: ReadonlySet<CheckId>;
  /** Unbranded discovery categories, most answers another brand led first. */
  categories: CategoryCheck[];
  categoriesPending: boolean;
};

type CheckFields = Omit<SlotCheck, "id" | "failing" | "total">;

function measured(id: string, failing: number | null | undefined, total: number | null | undefined, fields: CheckFields): SlotCheck | null {
  if (failing == null || total == null) return null;
  if (!Number.isInteger(failing) || !Number.isInteger(total)) return null;
  if (total <= 0 || failing < 0 || failing > total) return null;
  return { id, failing, total, ...fields };
}

function jobTimes(bundle: CanvasBundle | null | undefined, ...jobs: string[]): Array<string | null> {
  return (bundle?.fresh ?? []).filter((row) => jobs.includes(row.job_key)).map((row) => row.last_run_at);
}

const RETAIL_EVIDENCE = { spokeId: "ecommerce", note: "" } as const;

function retailChecks(snapshot: PortfolioRetailSnapshot, reads: SlotReads): SlotCheck[] {
  const { bundle } = reads;
  const partners = reads.authorizedPartners ?? null;
  const counts = snapshot.suppressedListings.detail?.counts ?? null;
  const recomputed =
    partners != null && snapshot.buyBoxSellers ? controlledBuyBoxFromCensus(snapshot.buyBoxSellers, partners) : null;
  const buyBox = recomputed ?? snapshot.controlledBuyBox ?? null;
  const map = snapshot.mapLeakage.detail;
  const bundles = snapshot.unnestedBundles.detail;
  const spec = specHero(snapshot);
  const specChecked = spec.denominator;
  const specComplete = spec.numerator;

  return [
    measured("buy_box_withheld", counts?.withheld, counts?.current, {
      ...RETAIL_EVIDENCE,
      label: "Buy Box withheld",
      population: "current Buy Box readings",
      failLabel: "Withheld",
      passLabel: "Buy Box shown",
      target: null,
      checkedAt: [counts?.newestCheckedAt],
      source: "The Buy Box read",
      subTab: "Suppressed Listings",
    }),
    measured("controlled_buy_box", buyBox ? buyBox.known - buyBox.controlled : null, buyBox?.known, {
      ...RETAIL_EVIDENCE,
      label: "Buy Box not held by Amazon or a named partner",
      population: "listings with a known Buy Box seller",
      failLabel: "Another seller",
      passLabel: "Amazon or a partner",
      target: null,
      checkedAt: jobTimes(bundle, "buybox_seller_harvester"),
      source: "The Buy Box seller read",
      subTab: "Retail Overview",
      note: partners == null ? "Placeholder partner list." : "Uses the partner list saved in this browser.",
      noteDefinition: partners == null ? CONTROLLED_BUY_BOX_PLACEHOLDER_TOOLTIP : undefined,
    }),
    measured("map_violation", map?.violations, map?.decided, {
      ...RETAIL_EVIDENCE,
      label: "Listings priced below MAP",
      population: "listings with a stored MAP comparison",
      failLabel: "Below MAP",
      passLabel: "At or above MAP",
      target: null,
      checkedAt: jobTimes(bundle, "map_leakage_walmart", "map_parity_musiciansfriend"),
      source: "The MAP read",
      subTab: "MAP",
      note: map && map.undecided > 0 ? "Listings with no stored MAP comparison are left out." : "",
    }),
    measured("splintered", bundles?.opportunities.length, bundles?.bundlesInRead, {
      ...RETAIL_EVIDENCE,
      label: "Splintered bundles",
      population: "bundles in this read",
      failLabel: "No usable parent",
      passLabel: "Nested",
      target: null,
      checkedAt: jobTimes(bundle, "catalog_harvester"),
      source: "The catalog read",
      subTab: "Catalog Governance",
      note: "No usable parent ASIN, so reviews stay split.",
    }),
    measured(
      "specs_complete",
      specChecked != null && specComplete != null ? specChecked - specComplete : null,
      specChecked,
      {
        ...RETAIL_EVIDENCE,
        label: "Listings missing an Amazon spec field",
        population: "checked listings",
        failLabel: "Missing a field",
        passLabel: "Specs filled",
        target: { text: "Specs complete at 98% and up", now: spec.percent, tone: spec.tone },
        checkedAt: jobTimes(bundle, "spec_readiness"),
        source: "The Amazon spec read",
        subTab: "Catalog Governance",
      },
    ),
    requiredSpecCheck(snapshot, bundle),
  ].filter((check): check is SlotCheck => check != null);
}

function requiredSpecCheck(snapshot: PortfolioRetailSnapshot, bundle: CanvasBundle | null | undefined): SlotCheck | null {
  const detail = snapshot.amazonSpecGaps.detail;
  const share = detail ? requiredMarketplaceSpecShare(detail.gaps, detail.checked) : null;
  if (!share) return null;
  return measured("required_specs", share.denominator - share.numerator, share.denominator, {
    label: "Listings missing a required spec",
    population: "checked listings",
    failLabel: "Missing a required spec",
    passLabel: "Required specs filled",
    target: null,
    checkedAt: jobTimes(bundle, "spec_readiness"),
    source: "The Amazon spec read",
    spokeId: "specs",
    subTab: "Amazon Specs",
    note: "Placeholder required-spec list.",
    noteDefinition: REQUIRED_SPECS_PLACEHOLDER_TOOLTIP,
  });
}

function bundleChecks(bundle: CanvasBundle): SlotCheck[] {
  const pages = specPageCounts(bundle.specPages);
  const bullets = bulletCounts(bundle.listingContent);
  return [
    measured("machine_readable", pages?.missingSpecBlock, pages?.pages, {
      label: "Found fender.com pages missing machine-readable specs",
      population: "found fender.com pages",
      failLabel: "No spec block",
      passLabel: "Spec block",
      target: null,
      checkedAt: (bundle.specPages?.pages ?? []).map((page) => page.checkedAt),
      source: "The fender.com page read",
      spokeId: "specs",
      subTab: "Brand-Site Specs",
      note: "",
    }),
    measured("five_bullets", bullets?.short, bullets?.listings, {
      label: "Amazon listings with fewer than five bullets",
      population: "live Amazon listings read",
      failLabel: "Fewer than five",
      passLabel: "Five or more",
      target: null,
      checkedAt: (bundle.listingContent?.rows ?? []).map((row) => row.checked_at),
      source: "The Amazon listing-content read",
      spokeId: "specs",
      subTab: "Amazon A+ Matrix",
      note: "",
    }),
  ].filter((check): check is SlotCheck => check != null);
}

function findabilityCheck(read: FindabilityRead): SlotCheck | null {
  if (read.phase !== "ready") return null;
  const counts = countFindability(read.rows);
  return measured("exact_pages", counts.total - counts.exact_official_product, counts.total, {
    label: "Listings without an exact official page",
    population: "listings in the official-page read",
    failLabel: "Not an exact page",
    passLabel: "Exact official page",
    target: null,
    checkedAt: [newestCheckedAttemptAt(read.rows)],
    source: "The official-page read",
    spokeId: "specs",
    subTab: "Findability",
    note: "A family page is not an exact page.",
  });
}

/** Fact-check accuracy is above 98% to be on target, with the Fact Checks satellite's bands. */
export function factCheckTarget(coverage: FactCheckCoverage): CheckTarget | null {
  const lead = factCheckAccuracyLead(coverage);
  if (!lead.rate || !lead.tone) return null;
  return { text: "Fact-check accuracy above 98%", now: lead.rate, tone: lead.tone };
}

function aiChecks(ai: AiSearchRead): { checks: SlotCheck[]; categories: CategoryCheck[] } {
  if (ai.phase !== "ready") return { checks: [], categories: [] };
  const summary = summarizeRun(ai.snapshot);
  const ran = [ai.snapshot.run.completed_at];
  const run = { checkedAt: ran, source: "The published AI run", target: null } as const;
  const { unbranded, branded } = summary.roles;
  const coverage = summary.drift.coverage;
  const checks = [
    measured("unbranded", unbranded.resolved - unbranded.fenderWins, unbranded.resolved, {
      ...run,
      label: "Unbranded answers Fender/Squier did not lead",
      population: "resolved unbranded answers",
      failLabel: "Not led",
      passLabel: "Fender/Squier led",
      spokeId: "aeo",
      subTab: "Run Details",
      note: "",
    }),
    measured("branded", branded.resolved - branded.fenderWins, branded.resolved, {
      ...run,
      label: "Branded answers Fender/Squier did not lead",
      population: "resolved branded answers",
      failLabel: "Not led",
      passLabel: "Fender/Squier led",
      spokeId: "aeo",
      subTab: "Run Details",
      note: "",
    }),
    measured("fact_checks", coverage.contradictions, coverage.answersChecked, {
      ...run,
      target: factCheckTarget(coverage),
      label: "Checked answers that contradict a verified fact",
      population: "answers checked against a verified fact",
      failLabel: "Contradicts",
      passLabel: "Matches",
      spokeId: "aeo",
      subTab: "Product Fact Checks",
      note: "",
    }),
  ].filter((check): check is SlotCheck => check != null);

  const categories = categoryBattles(ai.snapshot.calls)
    .map((battle) => {
      const check = measured(`category:${battle.category}`, battle.competitorWins, battle.resolved, {
        ...run,
        label: `${categoryLabel(battle.category)} answers another brand led`,
        population: `resolved unbranded ${categoryLabel(battle.category).toLowerCase()} answers`,
        failLabel: "Another brand led",
        passLabel: "Not led by another brand",
        spokeId: "competitors",
        subTab: "Category Battlecards",
        note: "",
      });
      return check ? { ...check, category: battle.category, competitorWins: battle.competitorWins } : null;
    })
    .filter((check): check is CategoryCheck => check != null);
  return { checks, categories };
}

const RETAIL_IDS: CheckId[] = [
  "buy_box_withheld",
  "controlled_buy_box",
  "map_violation",
  "splintered",
  "specs_complete",
  "required_specs",
];
const BUNDLE_IDS: CheckId[] = ["machine_readable", "five_bullets"];
const AI_IDS: CheckId[] = ["unbranded", "branded", "fact_checks"];

/** Every check the slots can choose from, keyed by id. */
export function buildCheckBook(reads: SlotReads): CheckBook {
  const pending = new Set<CheckId>();
  const list: SlotCheck[] = [];
  const retail = reads.retail ?? { phase: "loading" as const };

  if (retail.phase === "ready") list.push(...retailChecks(retail.snapshot, reads));
  else if (retail.phase === "loading") RETAIL_IDS.forEach((id) => pending.add(id));

  if (reads.bundle) list.push(...bundleChecks(reads.bundle));
  else BUNDLE_IDS.forEach((id) => pending.add(id));

  const exact = findabilityCheck(reads.findability);
  if (exact) list.push(exact);
  else if (reads.findability.phase === "loading") pending.add("exact_pages");

  const ai = aiChecks(reads.ai);
  list.push(...ai.checks);
  if (reads.ai.phase === "loading") AI_IDS.forEach((id) => pending.add(id));

  const checks: Partial<Record<CheckId, SlotCheck>> = {};
  for (const check of list) checks[check.id as CheckId] = check;
  return { checks, pending, categories: ai.categories, categoriesPending: reads.ai.phase === "loading" };
}
