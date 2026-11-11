import type { PieDiscData } from "@/lib/ai-search/citation-pies";
import { formatInt } from "@/lib/fender-canvas/format";
import { leadBrand } from "@/lib/brand-copy";
import type { DataStatus } from "@/lib/canvas-sdk/data-status";

/** Competitor Wins bands, the inverse of the unbranded rule (Brian Magazu, 11 Nov 2026). */
export const COMPETITOR_WINS_BANDS = { redAbove: 70, greenBelow: 35 } as const;

/** Status of the competitors' share of resolved unbranded answers. Map satellite and tab hero both use this. */
export function competitorWinsStatus(competitorWins: number, resolved: number): DataStatus | null {
  if (resolved <= 0) return null;
  const share = (100 * competitorWins) / resolved;
  if (share > COMPETITOR_WINS_BANDS.redAbove) return "bad";
  if (share < COMPETITOR_WINS_BANDS.greenBelow) return "good";
  return "okay";
}

/** "1,064 of 1,788": the N-of-M clause the hero and the Competitive Radar sentence share. */
export function competitorWinsCount(competitorWins: number, resolved: number): string {
  return `${formatInt(competitorWins)} of ${formatInt(resolved)}`;
}

/** Same words as the Competitive Radar spoke sentence for this snapshot. */
export function competitorWinsFigure(competitorWins: number, resolved: number): string {
  return `Competitors led ${competitorWinsCount(competitorWins, resolved)} resolved unbranded discovery answers.`;
}

/** Disc of competitor-led versus Fender/Squier-led among resolved unbranded discovery. */
export function competitorLeadPie(competitorWins: number, resolved: number): PieDiscData | null {
  if (resolved <= 0) return null;
  const fenderLed = resolved - competitorWins;
  if (competitorWins < 0 || fenderLed < 0) return null;
  return {
    id: "competitor-wins-lead",
    title: "Unbranded discovery leads",
    total: resolved,
    totalLabel: "resolved unbranded discovery answers",
    slices: [
      { key: "competitor_brand", label: "Competitor led", count: competitorWins },
      { key: "fender", label: `${leadBrand()} led`, count: fenderLed },
    ].filter((slice) => slice.count > 0),
  };
}
