import type { NodeStatus } from "@/lib/canvas-sdk/types";

/**
 * Bad, okay, and good data (brand book pp. 10-11). Oxblood, Champagne, and Pine mark data
 * points only, never buttons, links, tabs, or chart series, and each one travels with a mark
 * and a word so the meaning never rests on color alone.
 */
export type DataStatus = "bad" | "okay" | "good";

export const DATA_STATUSES: readonly DataStatus[] = ["bad", "okay", "good"];

/** The book's sample words. A view may pass its own word for the same status. */
export const DATA_STATUS_WORD: Record<DataStatus, string> = {
  bad: "Poor",
  okay: "Fair",
  good: "Good",
};

/** x, dash, and check, as named in the book. */
export const DATA_STATUS_MARK_NAME: Record<DataStatus, "x" | "dash" | "check"> = {
  bad: "x",
  okay: "dash",
  good: "check",
};

/** 12 x 12 stroke paths for each mark, shared by HTML and the map's SVG. */
export const DATA_STATUS_MARK_PATH: Record<DataStatus, string> = {
  bad: "M3 3l6 6M9 3L3 9",
  okay: "M2.5 6h7",
  good: "M2.5 6.4l2.3 2.3 4.7-5.2",
};

/** CSS custom property for the theme's value: Main on dark pages, Ink on light pages. */
export function dataStatusColor(status: DataStatus): string {
  return `var(--status-${status})`;
}

/** Deep tile fill (white text on it) or the night card tint, per the book's "Right value". */
export function dataStatusFill(status: DataStatus, kind: "deep" | "tint"): string {
  return kind === "deep" ? `var(--status-${status}-deep)` : `var(--status-${status}-tint)`;
}

/** Map bubble statuses onto data statuses. Neutral has no status color. */
export function dataStatusFromNode(status: NodeStatus | null | undefined): DataStatus | null {
  if (status === "danger") return "bad";
  if (status === "warning") return "okay";
  if (status === "success") return "good";
  return null;
}

/** Chart colors: the measured slice in ice blue, the rest gray, at most two blue series. */
export const CHART_COLORS = {
  measured: "var(--chart-measured)",
  second: "var(--chart-second)",
  rest: "var(--chart-rest)",
} as const;
