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
import { machineReadabilityHeroes } from "@/lib/fender-canvas/machine-readability";
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
};

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
  return [
    { id: "page_found", label: found.label, percent: found.percent, ratio: found.ratio, tone: found.ratio ? found.tone : null, open: SPECS },
    { id: "completeness", label: complete.label, percent: complete.percent, ratio: complete.ratio, tone: complete.tone, open: SPECS },
    {
      id: "machine_specs",
      label: machine.label,
      percent: machine.percent,
      ratio: machine.ratio,
      tone: machine.denominator != null ? colorTone(machine.color) : null,
      open: SPECS,
    },
    {
      id: "amazon_completeness",
      label: amazon.label,
      percent: amazon.percent,
      ratio: amazon.ratio,
      tone: amazon.tone,
      open: { spokeId: "specs", tab: "Amazon Specs" },
    },
    {
      id: "aplus",
      label: aplus.label,
      percent: aplus.percent,
      ratio: aplus.ratio,
      tone: aplus.denominator != null ? colorTone(aplus.color) : null,
      open: { spokeId: "specs", tab: "Amazon A+ Matrix" },
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

/** 21c on the read: the own-page action, if any, and the factors behind it. */
export function ownPagesAction(bundle: CanvasBundle | null, snapshot: AiSearchSnapshot | null): OwnPagesRead {
  if (!bundle) return { factors: [], action: null, reason: "The retail and spec reads are loading." };
  const factors = ownPageFactors(bundle);
  const below = factors
    .filter((factor) => factor.tone === "danger" || factor.tone === "warning")
    .sort((a, b) => (a.tone === b.tone ? 0 : a.tone === "danger" ? -1 : 1));
  if (below.length) {
    const worst = below[0]!;
    const red = worst.tone === "danger";
    return {
      factors,
      reason: `${below.length} of ${factors.length} factors below Good`,
      action: {
        id: "own:pages",
        urgent: true,
        phase: red ? "days_1_30" : "days_31_60",
        label: `${brandName()} pages and listings: ${phrase(worst)}`,
        percent: worst.percent,
        ratio: worst.ratio,
        tone: worst.tone,
        fact: sentence(`${joinList(below.map((factor) => `${phrase(factor)} reads ${factor.percent} (${word(factor.tone!)})`))}.`),
        action: `Work through the product pages and listings ${brandName()} controls until each of these reads Good, starting with ${phrase(worst)}.`,
        open: worst.open,
        share: 1,
      },
    };
  }
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
    },
  };
}
