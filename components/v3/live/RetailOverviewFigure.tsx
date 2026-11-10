"use client";

import "@/components/v3/live/catalog-health.css";
import { StatusMark } from "@/components/v3/live/StatusMark";
import type { PieDiscData } from "@/lib/ai-search/citation-pies";
import { CHART_COLORS, dataStatusFromNode } from "@/lib/canvas-sdk/data-status";
import type { NodeStatus } from "@/lib/canvas-sdk/types";

const DISC_CLASS = "citation-pie-disc citation-pie-disc-retail";

function gradient(pie: PieDiscData, measuredKey: string): string {
  let angle = 0;
  return pie.slices
    .map((slice) => {
      const start = angle;
      angle += (slice.count / pie.total) * 360;
      const color = slice.key === measuredKey ? CHART_COLORS.measured : CHART_COLORS.rest;
      return `${color} ${start}deg ${angle}deg`;
    })
    .join(", ");
}

/**
 * Catalog Health share disc in the chart tokens: the measured slice in ice blue, the rest gray.
 * Status color stays on the figure beside it, never on the chart.
 */
export function RetailShareDisc({
  pie,
  measuredKey,
  tip,
}: {
  pie: PieDiscData;
  /** Key of the slice the headline figure counts. */
  measuredKey: string;
  /** Custom tooltip text. Defaults to the slice counts. */
  tip?: string | null;
}) {
  const label = pie.slices.map((slice) => `${slice.count} ${slice.label}`).join(". ");
  const description = tip ?? `${pie.title}. ${label}. Total ${pie.total} ${pie.totalLabel}.`;
  return (
    <div
      className={`${DISC_CLASS} citation-chart-tip ifai-term`}
      style={{ background: `conic-gradient(${gradient(pie, measuredKey)})` }}
      role="img"
      aria-label={`${pie.title}. ${description}`}
      data-citation-pie-disc={pie.id}
      data-chart-measured={measuredKey}
      data-ifai-tooltip-title={pie.title}
      data-ifai-tooltip-desc={description}
      tabIndex={0}
    />
  );
}

/** A name longer than this is likely cut by the two-line clamp, so it gets its full text in a tooltip. */
const LISTING_NAME_TIP_LENGTH = 44;

/**
 * A listing name in a table cell: two lines at most, so a row never grows past the name.
 * A long name opens in full in the shared custom tooltip.
 */
export function ListingName({ name }: { name: string }) {
  const long = name.length > LISTING_NAME_TIP_LENGTH;
  return (
    <strong
      className={long ? "listing-name ifai-term" : "listing-name"}
      {...(long ? { "data-ifai-tooltip-title": "Listing", "data-ifai-tooltip-desc": name } : {})}
    >
      {name}
    </strong>
  );
}

/** Every column after the first: the ids a fitted Catalog Health table lets wrap. */
export function wrapColumnIdsAfterFirst(columns: readonly { id: string }[]): string[] {
  return columns.slice(1).map((column) => column.id);
}

/** Table class for a Catalog Health table that fits the panel at 1280 wide without side scroll. */
export const RETAIL_FIT_TABLE = "retail-fit";

/** The mark and word under a status-colored retail figure. Nothing when the figure has no status. */
export function RetailStatusMark({ tone }: { tone: NodeStatus | null | undefined }) {
  const status = dataStatusFromNode(tone);
  return status ? <StatusMark status={status} /> : null;
}
