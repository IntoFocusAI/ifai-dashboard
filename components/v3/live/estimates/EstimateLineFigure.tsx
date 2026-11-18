"use client";

import "@/components/v3/live/estimates/estimate-trail.css";
import { useCallback, useRef, useState } from "react";
import { figureTipAttrs } from "@/components/v3/live/FigureTip";
import { EstimateTrail } from "@/components/v3/live/estimates/EstimateTrail";
import { ESTIMATES_READ_FAILED } from "@/components/v3/live/estimates/OpportunityEstimates";
import { coverageShortText, NOT_AVAILABLE_LISTINGS_TIP, resultHeroText } from "@/components/v3/live/estimates/trail-copy";
import { useClientEstimates, type ClientEstimatesRead } from "@/components/v3/live/estimates/useClientEstimates";
import { estimateListingLines } from "@/lib/estimates/rollup";
import type { EstimateLineId, EstimateRange, EstimateResult } from "@/lib/estimates/types";
import { fixRowFigure } from "@/lib/fender-canvas/action-items-buybox-rows";
import {
  FIX_ESTIMATE_LABEL,
  lineFromListings,
  type LineListingsEstimate,
} from "@/lib/fender-canvas/action-items-fix-list";
import type { BuyBoxCauseSplit } from "@/lib/fender-canvas/buy-box-cause";
import { BRIEFING_LOADING } from "@/lib/fender-canvas/briefing-retail-lead";
import { PARTIAL_MARK, READ_NOT_AVAILABLE } from "@/lib/fender-canvas/canvas-reads";
import { formatMoneyShort } from "@/lib/fender-canvas/format";

let titles: Map<EstimateLineId, EstimateResult> | null = null;

/** Each line's own title and meaning, from the formula core, so the card reads before the data does. */
function lineTitle(lineId: EstimateLineId): { title: string; means: string } {
  if (!titles) {
    const empty = estimateListingLines([]);
    titles = new Map(
      [empty.outOfStock, empty.buyBox, empty.mapLeakage, empty.splintered, empty.missingSpecs, empty.aplus].map((line) => [line.lineId, line]),
    );
  }
  const line = titles.get(lineId);
  return { title: line?.trail.title ?? "", means: line?.trail.means ?? "" };
}

function NotAvailable({ desc, testId }: { desc: string; testId: string }) {
  return (
    <span {...figureTipAttrs(READ_NOT_AVAILABLE, desc, testId)} data-estimate-na={testId}>
      {READ_NOT_AVAILABLE}
    </span>
  );
}

/** The mid as a button that opens the line's trail; the asterisk keeps its own coverage tooltip. */
function MidButton({ line, range, className }: { line: EstimateResult; range: EstimateRange; className?: string }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => {
    setOpen(false);
    buttonRef.current?.focus();
  }, []);
  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`estimate-trail-trigger${className ? ` ${className}` : ""}`}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-estimate-trigger={line.lineId}
        data-estimate-mid={Math.round(range.mid)}
      >
        <span className="estimate-trail-trigger-figure">{formatMoneyShort(range.mid)}</span>
      </button>
      {line.asterisk ? (
        <span {...figureTipAttrs("Partial coverage", coverageShortText(line.trail), "estimate-line-partial")} className="ifai-term partial-figure-mark">
          {PARTIAL_MARK}
        </span>
      ) : null}
      {open ? <EstimateTrail result={line} onClose={close} /> : null}
    </>
  );
}

/** Loading, a failed read, Not available*, or nothing when the line touches no listing. */
function Placeholder({ read, figure }: { read: ClientEstimatesRead; figure: LineListingsEstimate | null }) {
  if (read.phase === "loading") return <span data-estimate-loading="">{BRIEFING_LOADING}</span>;
  if (read.phase === "error") return <NotAvailable desc={ESTIMATES_READ_FAILED} testId="estimate-read-failed" />;
  if (figure?.status === "not_available") return <NotAvailable desc={NOT_AVAILABLE_LISTINGS_TIP} testId="estimate-no-sales-figure" />;
  return null;
}

/**
 * Action Items fix list: the row's dollar, added from the shared per-listing estimates, labeled
 * analyst estimate and opening the row's trail. Empty for a row no estimate line covers yet.
 */
export function FixRowEstimate({
  itemId,
  read,
  split = null,
}: {
  itemId: string;
  read: ClientEstimatesRead;
  /** The Buy Box cause split, for the two cause rows. */
  split?: BuyBoxCauseSplit | null;
}) {
  const figure = read.phase === "ready" ? fixRowFigure(itemId, read.estimates, split) : null;
  if (read.phase === "ready" && !figure) return null;
  return (
    <span
      className="estimate-row-figure"
      data-fix-estimate={figure?.status ?? read.phase}
      style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-start", gap: 2, maxWidth: "100%" }}
    >
      {figure?.status === "estimated" && figure.range ? (
        <>
          <span style={{ whiteSpace: "nowrap" }}>
            <MidButton line={figure.line} range={figure.range} />
          </span>
          <span className="estimate-trail-trigger-label">{FIX_ESTIMATE_LABEL}</span>
        </>
      ) : (
        <Placeholder read={read} figure={figure} />
      )}
    </span>
  );
}

/**
 * A tab's yearly dollar line (E4): the line's mid opening its trail, the range under it in the
 * N of M style, labeled analyst estimate. The label's tooltip is the line's own meaning, so MAP
 * reads as retail value below MAP, beside Phase 1. Hidden when the line touches no listing.
 */
export function EstimateLineCard({ lineId }: { lineId: EstimateLineId }) {
  const read = useClientEstimates();
  const figure = read.phase === "ready" ? lineFromListings(read.estimates, lineId) : null;
  if (read.phase === "ready" && (!figure || figure.status === "none")) return null;
  const { title, means } = lineTitle(lineId);
  const label = `${title}, per year`;
  const range = figure?.status === "estimated" ? figure.range : null;
  // The range on its own line, in main's shared hero style and wording.
  const rangeText = range ? resultHeroText({ status: "estimated", range }).range : null;
  return (
    <div
      className="content-box findability-lead-card estimate-line-card"
      data-estimate-line-card={lineId}
      data-estimate-line-status={figure?.status ?? read.phase}
      style={{ flex: "0 0 auto", width: "fit-content", maxWidth: "100%", alignSelf: "flex-start", marginTop: 0 }}
    >
      <div>
        <span {...figureTipAttrs(label, means, `estimate-line-label-${lineId}`)}>{label}</span>
      </div>
      <div className="findability-lead-figures">
        <span className="ai-lead-figure" data-estimate-line-figure="">
          {figure && range ? <MidButton line={figure.line} range={range} /> : <Placeholder read={read} figure={figure} />}
        </span>
        {rangeText ? (
          <span className="findability-lead-ratio" data-estimate-line-range="">
            {rangeText}
          </span>
        ) : null}
        <span className="findability-lead-ratio">
          <span className="source-tag source-tag-estimate" data-source="Estimate">
            {FIX_ESTIMATE_LABEL}
          </span>
        </span>
      </div>
    </div>
  );
}
