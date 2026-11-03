/**
 * Metrics the Minimal view slots pick from: the headline figures each tab leads with, grouped
 * by area in map order. A map bubble's entry reads the same figure as the bubble. Every other
 * entry reads its tab's own hero model, so the value, the N of M, and the disc match that tab.
 * A new figure is one entry in its area's list.
 */

import type { CanvasMetricReading, CanvasMinimalMetric } from "@/lib/canvas-sdk/minimal-view-types";
import type { CanvasNode } from "@/lib/canvas-sdk/types";
import { AI_SEARCH_ENTRIES, COMPETITIVE_ENTRIES } from "@/lib/fender-canvas/minimal-metrics-ai";
import { READINESS_ENTRIES } from "@/lib/fender-canvas/minimal-metrics-readiness";
import { RETAIL_ENTRIES } from "@/lib/fender-canvas/minimal-metrics-retail";
import { ACTION_ITEM_ENTRIES, SUMMARY_ENTRIES } from "@/lib/fender-canvas/minimal-metrics-summary";
import type { MinimalContext, MinimalListItem, MinimalMetricInput } from "@/lib/fender-canvas/minimal-metric-kit";

export { NOT_AVAILABLE, type MinimalMetricInput, type StockLossRead } from "@/lib/fender-canvas/minimal-metric-kit";

/** Summary, Catalog Health, AI Search Visibility, AI Readiness, Competitive Radar, Action Items. */
export const MINIMAL_ENTRIES: readonly MinimalListItem[] = [
  ...SUMMARY_ENTRIES,
  ...RETAIL_ENTRIES,
  ...AI_SEARCH_ENTRIES,
  ...READINESS_ENTRIES,
  ...COMPETITIVE_ENTRIES,
  ...ACTION_ITEM_ENTRIES,
];

/** A value that already reads "N of M" keeps only the noun on the line under it. */
function withoutRepeatedCount(reading: CanvasMetricReading, value: string): CanvasMetricReading {
  if (!reading.ratio?.startsWith(`${value} `)) return reading;
  return { ...reading, ratio: reading.ratio.slice(value.length + 1) };
}

/** Required on every estimate, small slot and large. */
function estimateDetail(estimate: string | undefined): string {
  return estimate ? `Analyst estimate. ${estimate}.` : "Analyst estimate.";
}

export function buildMinimalMetrics(nodes: CanvasNode[], input: MinimalMetricInput): CanvasMinimalMetric[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const ctx: MinimalContext = { ...input, node: (id) => byId.get(id) };
  const entries = MINIMAL_ENTRIES.flatMap((item) => ("family" in item ? item.entries(ctx) : [item]));
  return entries.flatMap((entry): CanvasMinimalMetric[] => {
    if (entry.offered && !entry.offered(ctx)) return [];
    const { value, tone, estimate, ...figure } = entry.read(ctx);
    const reading = withoutRepeatedCount(figure, value);
    const provenance = entry.provenance ?? "live";
    return [
      {
        id: entry.id,
        spokeId: entry.spokeId,
        label: typeof entry.label === "string" ? entry.label : entry.label(ctx),
        value,
        detail: provenance === "estimate" ? estimateDetail(estimate) : reading.ratio ?? reading.missing ?? "",
        tone,
        subTab: entry.tab,
        provenance,
        reading,
      },
    ];
  });
}
