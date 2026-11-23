/**
 * Roadmap and Action Items: the brand's own product pages (decision 21 c, Brian, 11 Nov 2026).
 *
 * Five brand-controlled factors, each judged by the red, yellow, and green bands its home tab
 * already uses: brand-site page found, completeness when a page is found, machine-readable specs
 * (additionalProperty), Amazon attribute completeness, and A+ content.
 * - Any red or yellow: an urgent own-page action, Days 1 to 30 when one is red, else 31 to 60.
 * - All green, and the brand-owned site cited in under 30% of shopping answers with sources:
 *   a low-priority Days 61 to 90 action to word the pages to match shopper questions.
 * - All green and cited 30% or more: no own-page action.
 */

import type { AiSearchSnapshot } from "@/lib/ai-search/types";
import type { NodeStatus } from "@/lib/canvas-sdk/types";
import { DATA_STATUS_WORD, dataStatusFromNode } from "@/lib/canvas-sdk/data-status";
import { brandName, brandSite } from "@/lib/brand-copy";
import {
  amazonCompletenessHero,
  fenderCompletenessHero,
  pageFoundHero,
} from "@/lib/fender-canvas/ai-readiness-lead";
import { formatPct, formatRatio } from "@/lib/fender-canvas/format";
import { listingContentHeroes } from "@/lib/fender-canvas/listing-content";
import { machineReadabilityHeroes, SPEC_BLOCK_FIELD, plainSpecFieldName, type SpecFoundListing, type SpecPageSummary } from "@/lib/fender-canvas/machine-readability";
import type { Effort } from "@/lib/fender-canvas/priority-rank";
import { joinList, runShares } from "@/lib/fender-canvas/roadmap-sources";
import type { CanvasBundle } from "@/lib/fender-canvas/types";

/** 21c: the brand-owned site's share of shopping answers with sources, below which pages are reworded. */
export const OWN_SITE_CITED_THRESHOLD = 0.3;

export type Tone = Exclude<NodeStatus, "neutral">;

export type OwnPageFactor = {
  id: "page_found" | "completeness" | "machine_specs" | "amazon_completeness" | "aplus";
  label: string;
  percent: string;
  ratio: string | null;
  /** Null when the figure has no reading, so it is not judged. */
  tone: Tone | null;
  open: { spokeId: string; tab: string };
  /**
   * What the factor falls short on, for the central rank, in listings: listings without the item,
   * or, for the brand-site page factors, the listings whose found page has the gap (a count, never
   * an estimate from an average). Null without a reading.
   */
  affected: number | null;
  /** The listings the factor reads. */
  base: number | null;
  /** What `affected` counts, as the problem: "Listings without a fender.com page". */
  short: string;
  /** The figure's tooltip when the count has a second reading (the same gap in distinct pages). */
  tip?: string | null;
  /** The short action title when the own-pages item works on this factor (fix round 3). */
  task: string;
  /** The effort and kind of that work (fix round 3: from the factor, never the phase). */
  effort: Effort;
};

/**
 * Each factor's effort (Brian Magazu, 23 Nov 2026 fix round 3). Every factor is page or listing
 * content the brand publishes: catalog and site content, Medium.
 */
export const FACTOR_EFFORT: Readonly<Record<OwnPageFactor["id"], Effort>> = {
  page_found: "M",
  completeness: "M",
  machine_specs: "M",
  amazon_completeness: "M",
  aplus: "M",
};

/** A field named for the gap must be missing for at least this share of the listings with a gap. */
export const NAMED_FIELD_SHARE = 0.9;

/**
 * What the brand-site completeness gap is made of, from the stored page read, counted in LISTINGS
 * (worker 32.18) so the figure and the central rank share one unit: each listing with a found page
 * is counted by its own stored read (the rows canvas_metrics counts, so N matches AI Readiness).
 * Without a named field, `listings` is the listings whose page misses at least one field. When one
 * field accounts for the gap (missing for at least NAMED_FIELD_SHARE of those listings), it is named
 * and `listings` counts the listings whose page misses that field, so the label and N agree.
 * `base` is every listing with a found page. `pages` and `pageBase` count the same gap in distinct
 * pages, as Brand-Site Specs counts them (several listings can share one page), for the tooltip.
 * Null without a page read.
 */
export type CompletenessGap = { listings: number; base: number; pages: number; pageBase: number; field: string | null };

/** Each listing with a found page and its missing fields; fixtures without them read each page's listings. */
function foundListings(summary: SpecPageSummary): SpecFoundListing[] {
  return summary.foundListings ?? summary.pages.flatMap((page) => page.asins.map((asin) => ({ asin, missingFields: page.missingFields })));
}

/** The gap for one field (null: any field), in listings and in pages. */
function gapFor(summary: SpecPageSummary, listings: readonly SpecFoundListing[], field: string | null): CompletenessGap {
  const has = (missing: readonly string[]) => (field ? missing.includes(field) : missing.length > 0);
  return {
    listings: listings.filter((listing) => has(listing.missingFields)).length,
    base: listings.length,
    pages: summary.pages.filter((page) => has(page.missingFields)).length,
    pageBase: summary.pages.length,
    field,
  };
}

export function completenessGap(specPages: SpecPageSummary | null | undefined): CompletenessGap | null {
  if (!specPages || specPages.pages.length === 0) return null;
  const listings = foundListings(specPages);
  if (listings.length === 0) return null;
  const any = gapFor(specPages, listings, null);
  const missing = new Map<string, number>();
  for (const listing of listings) for (const field of new Set(listing.missingFields)) missing.set(field, (missing.get(field) ?? 0) + 1);
  const [top, count] = [...missing.entries()].sort((x, y) => y[1] - x[1] || (x[0] === SPEC_BLOCK_FIELD ? -1 : 1))[0] ?? [null, 0];
  if (top && any.listings > 0 && count >= NAMED_FIELD_SHARE * any.listings) return gapFor(specPages, listings, top);
  return any;
}

/** The listings whose page has no spec block, for the machine-readable specs factor (same unit as the rank). */
function specBlockGap(specPages: SpecPageSummary | null | undefined): CompletenessGap | null {
  if (!specPages || specPages.pages.length === 0) return null;
  const listings = foundListings(specPages);
  return listings.length ? gapFor(specPages, listings, SPEC_BLOCK_FIELD) : null;
}

/** What the gap's page has, as a predicate: "lacks machine-readable specs". */
function gapPredicate(gap: CompletenessGap | null): string {
  if (gap?.field === SPEC_BLOCK_FIELD) return "lacks machine-readable specs";
  if (gap?.field) return `is missing ${plainSpecFieldName(gap.field)}`;
  return "has empty spec fields";
}

/** The completeness count's label, in listings: names the one missing field when one accounts for the gap. */
export function completenessShort(gap: CompletenessGap | null): string {
  return `Listings whose ${brandSite()} page ${gapPredicate(gap)}`;
}

/** The same gap in distinct pages, for the figure's tooltip: "fender.com pages without machine-readable specs: 197 of 197 found pages." */
export function completenessPagesTip(gap: CompletenessGap | null): string | null {
  if (!gap) return null;
  const what =
    gap.field === SPEC_BLOCK_FIELD
      ? `${brandSite()} pages without machine-readable specs`
      : gap.field
        ? `${brandSite()} pages missing ${plainSpecFieldName(gap.field)}`
        : `${brandSite()} pages with empty spec fields`;
  return `${what}: ${formatRatio(gap.pages, gap.pageBase)} found pages. One page can serve several listings.`;
}

/** Each factor's short action title, from the client settings (site, brand), never a client name. */
export function factorTask(id: OwnPageFactor["id"], gap?: CompletenessGap | null): string {
  switch (id) {
    case "page_found":
      return `Publish ${brandSite()} pages for listings without one`;
    case "completeness":
      if (gap?.field === SPEC_BLOCK_FIELD) return `Add machine-readable specs to ${brandSite()} product pages`;
      return `Fill the empty spec fields on ${brandSite()} product pages`;
    case "machine_specs":
      return `Make ${brandSite()} specs machine-readable`;
    case "amazon_completeness":
      return `Fill the empty spec fields on ${brandName()} Amazon listings`;
    case "aplus":
      return `Add A+ content to ${brandName()} Amazon listings without it`;
  }
}

/** The factor's task and effort, set once for every factor. */
function work(id: OwnPageFactor["id"], gap?: CompletenessGap | null): Pick<OwnPageFactor, "task" | "effort"> {
  return { task: factorTask(id, gap), effort: FACTOR_EFFORT[id] };
}

/**
 * The ranked item that already fixes a factor, by plan item id (Brian Magazu, 23 Nov 2026 fix
 * round 2: no duplicate fixes). While that item is in the ranked list needing action, the
 * own-pages item skips the factor and starts on its worst remaining one; with none left, the
 * own-pages item drops. Ids are the plan's: the exact official product pages finding, the
 * missing Amazon spec fields signal, and the A+ content row.
 */
export const FACTOR_COVERED_BY: Readonly<Record<OwnPageFactor["id"], string | null>> = {
  page_found: "finding:exact_official_product",
  completeness: null,
  machine_specs: null,
  amazon_completeness: "signal:missing_specs",
  aplus: "estimate:aplus",
};

/** Listings short on a share (base − has), or null without a reading. */
function shortOf(has: number | null | undefined, base: number | null | undefined): Pick<OwnPageFactor, "affected" | "base"> {
  return has != null && base != null && base > 0 ? { affected: Math.max(0, base - has), base } : { affected: null, base: null };
}

/** An average's listings' worth of empty fields: round(listings × (100 − average) / 100), for the Amazon factor. */
function shortOfAverage(pct: number | null | undefined, base: number | null | undefined): Pick<OwnPageFactor, "affected" | "base"> {
  return pct != null && !Number.isNaN(pct) && base != null && base > 0
    ? { affected: Math.max(0, Math.round((base * (100 - pct)) / 100)), base }
    : { affected: null, base: null };
}

export type OwnPageAction = {
  id: "own:pages" | "own:wording";
  urgent: boolean;
  phase: "days_1_30" | "days_31_60" | "days_61_90";
  label: string;
  percent: string;
  ratio: string | null;
  tone: Tone | null;
  fact: string;
  action: string;
  open: { spokeId: string; tab: string };
  /** Share of the population the figure covers, 0 to 1, for ranking. */
  share: number;
  /** The wording row's count: shopping answers with sources that cite the brand's site, of all of them. */
  cited?: { answers: number; total: number };
  /** The urgent row's worst factor count, for the central rank (listings), and what it counts. */
  worst?: { affected: number; base: number; short: string } | null;
  /** The urgent row's factors below Good, worst first, so the plan can skip one another item fixes. */
  below?: OwnPageFactor[];
  /** The urgent row's effort: the worst factor's (fix round 3). The wording row's comes from its phase. */
  effort?: Effort;
  /** The figure's tooltip from the worst factor (the same gap in pages), when it has one. */
  tip?: string | null;
};

export type OwnPagesRead = {
  factors: OwnPageFactor[];
  action: OwnPageAction | null;
  /** Why no own-page action shows, for the hand-back and the page's data attributes. */
  reason: string;
};

function colorTone(color: string | null | undefined): Tone | null {
  if (!color) return null;
  if (color.includes("danger")) return "danger";
  if (color.includes("warning")) return "warning";
  if (color.includes("success")) return "success";
  return null;
}

const SPECS = { spokeId: "specs", tab: "Brand-Site Specs" } as const;

/** The five factors as their home tabs read them. A factor with no reading carries no tone. */
export function ownPageFactors(bundle: CanvasBundle): OwnPageFactor[] {
  const m = bundle.m;
  const found = pageFoundHero(m);
  const complete = fenderCompletenessHero(m);
  const machine = machineReadabilityHeroes(bundle.specPages ?? null)[0]!;
  const amazon = amazonCompletenessHero(m);
  const aplus = listingContentHeroes(bundle.listingContent ?? null)[1]!;
  const listingContent = bundle.listingContent ?? null;
  const gap = completenessGap(bundle.specPages);
  const specBlock = specBlockGap(bundle.specPages);
  return [
    {
      id: "page_found",
      label: found.label,
      percent: found.percent,
      ratio: found.ratio,
      tone: found.ratio ? found.tone : null,
      open: SPECS,
      ...(found.ratio ? shortOf(m.spec_fender_found, m.spec_checked) : shortOf(null, null)),
      short: `Listings without a ${brandSite()} page`,
      ...work("page_found"),
    },
    {
      id: "completeness",
      label: complete.label,
      percent: complete.percent,
      ratio: complete.ratio,
      tone: complete.tone,
      open: SPECS,
      affected: gap ? gap.listings : null,
      base: gap ? gap.base : null,
      short: completenessShort(gap),
      tip: completenessPagesTip(gap),
      ...work("completeness", gap),
    },
    {
      id: "machine_specs",
      label: machine.label,
      percent: machine.percent,
      ratio: machine.ratio,
      tone: machine.denominator != null ? colorTone(machine.color) : null,
      open: SPECS,
      affected: machine.denominator != null && specBlock ? specBlock.listings : null,
      base: machine.denominator != null && specBlock ? specBlock.base : null,
      short: completenessShort(specBlock),
      tip: machine.denominator != null ? completenessPagesTip(specBlock) : null,
      ...work("machine_specs"),
    },
    {
      id: "amazon_completeness",
      label: amazon.label,
      percent: amazon.percent,
      ratio: amazon.ratio,
      tone: amazon.tone,
      open: { spokeId: "specs", tab: "Amazon Specs" },
      ...shortOfAverage(m.spec_avg_amazon_pct, m.spec_checked),
      short: "Listings with empty Amazon spec fields",
      ...work("amazon_completeness"),
    },
    {
      id: "aplus",
      label: aplus.label,
      percent: aplus.percent,
      ratio: aplus.ratio,
      tone: aplus.denominator != null ? colorTone(aplus.color) : null,
      open: { spokeId: "specs", tab: "Amazon A+ Matrix" },
      ...(listingContent ? shortOf(aplus.numerator, aplus.denominator) : shortOf(null, null)),
      short: "Listings without A+ content",
      ...work("aplus"),
    },
  ];
}

function word(tone: Tone): string {
  return DATA_STATUS_WORD[dataStatusFromNode(tone)!];
}

/** The factor's label inside a sentence: "found pages missing machine-readable specs". */
function phrase(factor: OwnPageFactor): string {
  return factor.id === "machine_specs" ? factor.label.charAt(0).toLowerCase() + factor.label.slice(1) : factor.label;
}

/** A sentence that opens on a lower-case label starts with a capital, unless it opens on a site name. */
function sentence(text: string): string {
  return text.startsWith("found ") ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

/** Share of shopping answers with sources that cite a brand-owned site, on the map's run. */
export function ownSiteCited(snapshot: AiSearchSnapshot): { answers: number; total: number } {
  const run = runShares(snapshot);
  const answers = new Set(run.read.rows.filter((row) => row.sourceClass === "fender_owned").map((row) => row.simulationId)).size;
  return { answers, total: run.read.answersWithCitation };
}

/**
 * Red before yellow; ties keep the factors' order. One gap, one figure (worker 32.18): the spec
 * block is one of the fields the completeness factor counts, so while completeness is below Good
 * the machine-readable specs factor folds into it and never shows as a second figure.
 */
function worstFirst(factors: readonly OwnPageFactor[]): OwnPageFactor[] {
  const below = factors.filter((factor) => factor.tone === "danger" || factor.tone === "warning");
  const folded = below.some((factor) => factor.id === "completeness") ? below.filter((factor) => factor.id !== "machine_specs") : below;
  return folded.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === "danger" ? -1 : 1));
}

/**
 * The urgent own-pages action from the factors below Good, starting on the worst; null when
 * none is. The plan calls it again without the factors another ranked item fixes.
 */
export function urgentOwnPagesAction(factors: readonly OwnPageFactor[]): OwnPageAction | null {
  const below = worstFirst(factors);
  const worst = below[0];
  if (!worst) return null;
  const red = worst.tone === "danger";
  return {
    id: "own:pages",
    urgent: true,
    phase: red ? "days_1_30" : "days_31_60",
    label: `${brandName()} pages and listings: ${phrase(worst)}`,
    percent: worst.percent,
    ratio: worst.ratio,
    tone: worst.tone,
    fact: sentence(`${joinList(below.map((factor) => `${phrase(factor)} reads ${factor.percent} (${word(factor.tone!)})`))}.`),
    action: `${worst.task}.`,
    open: worst.open,
    share: 1,
    worst: worst.affected != null && worst.base != null ? { affected: worst.affected, base: worst.base, short: worst.short } : null,
    below,
    effort: worst.effort,
    tip: worst.tip ?? null,
  };
}

/** 21c on the read: the own-page action, if any, and the factors behind it. */
export function ownPagesAction(bundle: CanvasBundle | null, snapshot: AiSearchSnapshot | null): OwnPagesRead {
  if (!bundle) return { factors: [], action: null, reason: "The retail and spec reads are loading." };
  const factors = ownPageFactors(bundle);
  const below = worstFirst(factors);
  const action = urgentOwnPagesAction(below);
  if (action) return { factors, reason: `${below.length} of ${factors.length} factors below Good`, action };
  const unjudged = factors.filter((factor) => factor.tone == null);
  if (unjudged.length) {
    return { factors, action: null, reason: `no reading for ${joinList(unjudged.map((factor) => factor.label))}` };
  }
  if (!snapshot) return { factors, action: null, reason: "the AI Search read is loading" };
  const cited = ownSiteCited(snapshot);
  if (cited.total <= 0) return { factors, action: null, reason: "no shopping answers with sources" };
  const share = cited.answers / cited.total;
  if (share >= OWN_SITE_CITED_THRESHOLD) {
    return { factors, action: null, reason: `every factor Good and ${brandSite()} cited in ${formatPct(100 * share)}` };
  }
  return {
    factors,
    reason: `every factor Good; ${brandSite()} cited in ${formatPct(100 * share)}`,
    action: {
      id: "own:wording",
      urgent: false,
      phase: "days_61_90",
      label: `${brandSite()} in shopping answers`,
      percent: formatPct(100 * share),
      ratio: formatRatio(cited.answers, cited.total),
      tone: null,
      fact: `${brandSite()} is cited in ${formatPct(100 * share)} of shopping answers with sources (${formatRatio(cited.answers, cited.total)}). Every ${brandName()}-controlled page factor reads Good.`,
      action: `Word the ${brandSite()} product pages to match the questions shoppers ask.`,
      open: { spokeId: "aeo", tab: "Citation Ecosystem" },
      share,
      cited,
    },
  };
}
