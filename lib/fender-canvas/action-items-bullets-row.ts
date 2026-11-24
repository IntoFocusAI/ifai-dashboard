/**
 * The Amazon bullets item (Brian Magazu, 23 Nov 2026 fix round): live Amazon listings that fill
 * fewer than five bullets join the one central ranking as one item, so Priorities, Action Items,
 * the Roadmap and the deck rank it with every other fix. One template for every client.
 */

import { bulletCounts, type BulletCounts } from "@/lib/fender-canvas/listing-content";
import { formatPct, formatRatio } from "@/lib/fender-canvas/format";
import { RECOMMENDED_LABEL, type UnrankedPlanItem } from "@/lib/fender-canvas/roadmap-plan";
import type { CanvasBundle } from "@/lib/fender-canvas/types";

export const BULLETS_ROW_ID = "signal:amazon_bullets";

/** The item, or null when no bullet read is stored or every live listing fills five bullets. */
export function bulletsPlanItem(counts: BulletCounts | null): UnrankedPlanItem | null {
  if (!counts || counts.short <= 0) return null;
  const ratio = formatRatio(counts.short, counts.listings);
  return {
    id: BULLETS_ROW_ID,
    kind: "signal",
    label: "Amazon listings with fewer than five bullets",
    percent: formatPct((100 * counts.short) / counts.listings),
    ratio,
    tone: null,
    statusLabel: RECOMMENDED_LABEL,
    fact: `${ratio} live Amazon listings fill fewer than five bullets. Bullets are the first copy an AI shopping assistant quotes about a listing.`,
    action: "Fill all five bullets on each Amazon listing.",
    needsAction: true,
    noReading: false,
    loading: false,
    partial: null,
    open: { spokeId: "specs", tab: "Amazon A+ Matrix" },
    siteType: null,
    pages: [],
    evidence: null,
    categories: [],
    // Listings short of five bullets; catalog content (M, 21g), as the A+ row.
    inputs: {
      affected: counts.short,
      base: counts.listings,
      unit: "listings",
      monthly: null,
      effort: "M",
      dependsOn: [],
      tier: "action",
    },
  };
}

/** The bullets item from the bundle's listing-content read. */
export function bulletsFromBundle(bundle: CanvasBundle | null): UnrankedPlanItem | null {
  return bulletsPlanItem(bulletCounts(bundle?.listingContent ?? null));
}
