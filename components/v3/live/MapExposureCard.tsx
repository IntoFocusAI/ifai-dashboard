"use client";

import "@/components/v3/live/catalog-health.css";
import { figureTipAttrs, PartialFigureMark } from "@/components/v3/live/FigureTip";
import { READ_NOT_AVAILABLE, type PartialFigure } from "@/lib/fender-canvas/canvas-reads";
import { formatInt, formatUsd } from "@/lib/fender-canvas/format";
import {
  ANALYST_ESTIMATE_LABEL,
  AWAITING_INPUTS_LABEL,
  MAP_EXPOSURE_LABEL,
  MAP_UNITS_LABEL,
  MAP_AWAITING_RULE,
  MAP_UNITS_SOURCE,
  formatSnapshotDay,
  mapAwaitingCount,
  mapAwaitingSentence,
  mapExposureCoverage,
  mapExposureSummaryTip,
  type MapExposureSummary,
} from "@/lib/fender-canvas/map-exposure";
import { mergePartial } from "@/lib/fender-canvas/row-stale";

export type MapExposureState =
  | { phase: "loading" }
  | { phase: "failed" }
  | { phase: "ready"; summary: MapExposureSummary };

const UNITS_READ_FAILED = `The ${MAP_UNITS_SOURCE} unit estimates could not be loaded, so no discounted retail value is shown.`;

/** The X-25 asterisk on the total: which listings it leaves out, and what that does to it. */
function coveragePartial(summary: MapExposureSummary): PartialFigure | null {
  return mergePartial(awaitingPartial(summary), summary.stale);
}

function awaitingPartial(summary: MapExposureSummary): PartialFigure | null {
  const missing = mapAwaitingSentence(summary);
  if (!missing) return null;
  const read = formatSnapshotDay(summary.latestSnapshot);
  return {
    reason: "coverage",
    missing: `${MAP_AWAITING_RULE} ${missing}`,
    coverage: `${formatInt(summary.estimated)} of ${formatInt(summary.violations)} listings below MAP`,
    source: `${MAP_UNITS_SOURCE} estimated monthly units${read ? `, read ${read},` : ""} and the stored Amazon price gap`,
    effect: "The total covers only the estimated listings, so it is lower than the full exposure.",
  };
}

function EstimateTag({ desc }: { desc: string }) {
  return (
    <span
      {...figureTipAttrs(ANALYST_ESTIMATE_LABEL, desc, "map-exposure-estimate")}
      className="source-tag source-tag-estimate ifai-term"
      data-map-exposure-estimate=""
    >
      {ANALYST_ESTIMATE_LABEL}
    </span>
  );
}

/**
 * MAP exposure (R-09): discounted retail value a month, its unit estimate, and how many
 * listings below MAP are estimated versus awaiting inputs. One total per units source.
 */
export function MapExposureCard({
  state,
  exceptionsSentence = null,
}: {
  state: MapExposureState;
  /** The approved-exceptions sentence for the tooltip, when any listing was left out (R-12). */
  exceptionsSentence?: string | null;
}) {
  const summary = state.phase === "ready" ? state.summary : null;
  const tip = summary
    ? mapExposureSummaryTip(summary, exceptionsSentence)
    : "Price gap below MAP on Amazon times estimated monthly units on Amazon.";
  return (
    <div
      className="content-box findability-lead-card map-exposure-card"
      data-map-exposure={state.phase}
      data-map-exposure-estimated={summary?.estimated ?? ""}
      data-map-exposure-awaiting={summary?.awaiting ?? ""}
    >
      <div className="map-exposure-label">
        <span>{MAP_EXPOSURE_LABEL}</span>
        <EstimateTag desc={tip} />
      </div>
      {state.phase === "loading" ? (
        <p className="retail-missing">Loading the unit estimates…</p>
      ) : null}
      {state.phase === "failed" ? (
        <span className="ai-lead-figure map-exposure-figure" data-map-exposure-value="">
          <span {...figureTipAttrs(READ_NOT_AVAILABLE, UNITS_READ_FAILED, "map-exposure-failed")}>
            {READ_NOT_AVAILABLE}
          </span>
        </span>
      ) : null}
      {summary ? (
        <>
          <span className="ai-lead-figure map-exposure-figure" data-map-exposure-value={summary.totalValue ?? ""}>
            {summary.totalValue != null ? (
              <>
                <PartialFigureMark partial={coveragePartial(summary)} testId="map-exposure-partial">
                  {formatUsd(summary.totalValue)}
                </PartialFigureMark>
                <span className="map-exposure-period"> a month</span>
              </>
            ) : (
              <span {...figureTipAttrs(AWAITING_INPUTS_LABEL, mapAwaitingSentence(summary) ?? tip, "map-exposure-awaiting")}>
                {AWAITING_INPUTS_LABEL}
              </span>
            )}
          </span>
          {summary.totalUnits != null ? (
            <span className="findability-lead-ratio" data-map-exposure-units={summary.totalUnits}>
              {MAP_UNITS_SOURCE} · {formatInt(summary.totalUnits)} {MAP_UNITS_LABEL.toLowerCase()}
            </span>
          ) : null}
          <span className="findability-lead-ratio" data-map-exposure-coverage="">
            {[mapExposureCoverage(summary), mapAwaitingCount(summary)].filter(Boolean).join(" ")}
          </span>
        </>
      ) : null}
    </div>
  );
}
