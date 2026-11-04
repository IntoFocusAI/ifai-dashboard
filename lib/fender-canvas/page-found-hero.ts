/**
 * fender.com page found hero on Brand-Site Specs.
 * Percent, N of M, and band color come from pageFoundHero, the figure the AI Readiness
 * bubble leads with, so the tab and the bubble never disagree.
 */

import type { PieDiscData } from "@/lib/ai-search/citation-pies";
import {
  PAGE_FOUND_DEFINITION,
  PAGE_FOUND_LABEL,
  pageFoundDefinition,
  pageFoundHero,
} from "@/lib/fender-canvas/ai-readiness-lead";
import { formatInt } from "@/lib/fender-canvas/format";
import type { CanvasMetricsRow } from "@/lib/fender-canvas/types";

export const PAGE_FOUND_HERO_ID = "page_found";

/** Anchor for the hero card, so a link can land on it. */
export const PAGE_FOUND_ANCHOR = "brand-site-page-found";

export const PAGE_FOUND_UNAVAILABLE = "Not available*";

export const PAGE_FOUND_UNAVAILABLE_TIP =
  "The fender.com product check has not reported how many SKUs it checked or how many have a matching fender.com product page, so this share is not shown.";

export type PageFoundHeroModel = {
  id: typeof PAGE_FOUND_HERO_ID;
  label: string;
  definition: string;
  percent: string;
  ratio: string | null;
  color: string;
  pie: PieDiscData | null;
  tip: string | null;
  explainer: string;
  numerator: number | null;
  denominator: number | null;
  figureTip: string | null;
};

function pageFoundPie(found: number, checked: number): PieDiscData {
  return {
    id: "brand-site-page-found",
    title: PAGE_FOUND_LABEL,
    total: checked,
    totalLabel: "checked SKUs",
    slices: [
      { key: "matched", label: "Page found", count: found },
      { key: "contradicted", label: "No page found", count: checked - found },
    ].filter((slice) => slice.count > 0),
  };
}

function unavailableHero(definition: string = PAGE_FOUND_DEFINITION): PageFoundHeroModel {
  return {
    id: PAGE_FOUND_HERO_ID,
    label: PAGE_FOUND_LABEL,
    definition,
    percent: PAGE_FOUND_UNAVAILABLE,
    ratio: null,
    color: "var(--warning-amber)",
    pie: null,
    tip: null,
    explainer: "The checked-SKU counts are not available.",
    numerator: null,
    denominator: null,
    figureTip: PAGE_FOUND_UNAVAILABLE_TIP,
  };
}

/** `checkedAt` is when the fender.com product check last ran, for the definition tooltip. */
export function brandSitePageFoundHero(
  m: CanvasMetricsRow | null | undefined,
  checkedAt: string | null = null,
): PageFoundHeroModel {
  const definition = pageFoundDefinition(checkedAt);
  if (!m) return unavailableHero(definition);
  const base = pageFoundHero(m, checkedAt);
  const checked = m.spec_checked;
  const found = m.spec_fender_found;
  if (base.ratio == null || base.color == null || checked == null || found == null) {
    return unavailableHero(definition);
  }
  if (checked <= 0 || found < 0 || found > checked) return unavailableHero(definition);
  const missing = checked - found;
  return {
    id: PAGE_FOUND_HERO_ID,
    label: PAGE_FOUND_LABEL,
    definition,
    percent: base.percent,
    ratio: base.ratio,
    color: base.color,
    pie: pageFoundPie(found, checked),
    tip: base.tip,
    explainer:
      missing === 0
        ? "Every checked SKU has a matching fender.com product page."
        : `${formatInt(missing)} checked SKUs have no matching fender.com product page.`,
    numerator: found,
    denominator: checked,
    figureTip: null,
  };
}
