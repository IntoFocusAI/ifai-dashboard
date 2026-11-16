"use client";

import { StatusGlyph } from "@/components/v3/live/StatusMark";
import { TOOLTIP_ROWS_ATTR } from "@/lib/canvas-sdk/tooltip-content";
import { dataAsOf, dataSourceFreshness, dataSourceLine } from "@/lib/fender-canvas/data-source-freshness";
import type { CanvasFreshnessRow } from "@/lib/fender-canvas/types";

/**
 * "Data as of <date>" in the map header. The tooltip lists each data source the client has with
 * its last check date; a source past twice its normal check interval reads "out of date" in the
 * Oxblood status color with its x mark, and the visible label carries the same x.
 */
export function DataFreshnessBar({
  fresh,
  stale,
}: {
  fresh: CanvasFreshnessRow[];
  stale?: boolean;
}) {
  const sources = dataSourceFreshness(fresh);
  const asOfIso = dataAsOf(sources);
  const asOfLabel = asOfIso
    ? new Date(asOfIso).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Not available*";
  const lines = sources.map(dataSourceLine);
  const rows = sources.map((source, index) => (source.outOfDate ? { text: lines[index], bad: true } : { text: lines[index] }));
  const anyOutOfDate = sources.some((source) => source.outOfDate);
  const desc = lines.length ? lines.join("\n") : "No data source has reported a check yet.";
  const rowsAttr = rows.length ? { [TOOLTIP_ROWS_ATTR]: JSON.stringify(rows) } : {};

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 11,
        color: "var(--text-muted)",
      }}
    >
      <span
        className="ifai-term data-freshness-label"
        data-ifai-tooltip-title="Last check by source"
        data-ifai-tooltip-desc={desc}
        {...rowsAttr}
        data-out-of-date={anyOutOfDate ? "true" : undefined}
        tabIndex={0}
        aria-label={`Data as of ${asOfLabel}. ${lines.join(". ")}`}
        style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
      >
        {anyOutOfDate ? (
          <span className="data-status-bad" data-status="bad" style={{ display: "inline-flex" }}>
            <StatusGlyph status="bad" />
          </span>
        ) : null}
        Data as of {asOfLabel}
      </span>
      {stale ? (
        <span className="tag-badge tag-warning" style={{ fontSize: 11 }}>
          Stale
        </span>
      ) : null}
    </div>
  );
}
