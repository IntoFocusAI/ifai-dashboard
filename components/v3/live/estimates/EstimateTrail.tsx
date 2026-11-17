"use client";

import "@/components/v3/live/estimates/estimate-trail.css";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { figureTipAttrs } from "@/components/v3/live/FigureTip";
import { StatusMark } from "@/components/v3/live/StatusMark";
import { EstimateTrailInputs, EstimateTrailSalesSplit } from "@/components/v3/live/estimates/EstimateTrailInputs";
import { EstimateTrailSources } from "@/components/v3/live/estimates/EstimateTrailSources";
import {
  ANALYST_ESTIMATE,
  ANALYST_ESTIMATE_TIP,
  CONFIDENCE_STATUS,
  CONFIDENCE_WORD,
  coverageParts,
  coverageShortText,
  NOT_AVAILABLE_LISTINGS_TIP,
  resultFigureText,
  salesSourceRows,
} from "@/components/v3/live/estimates/trail-copy";
import { PARTIAL_MARK, READ_NOT_AVAILABLE } from "@/lib/fender-canvas/canvas-reads";
import type { EstimateResult, EstimateTrail as EstimateTrailData } from "@/lib/estimates/types";

/** Every count: "Based on 182 of 214 listings: 62 measured, 120 estimated from sales rank, 32 Not available*" */
function CoverageLine({ trail }: { trail: EstimateTrailData }) {
  const parts = coverageParts(trail);
  return (
    <p className="estimate-trail-coverage" data-estimate-coverage="">
      {`${parts.lead}: ${parts.measured}, ${parts.estimated}`}
      {parts.notAvailable ? (
        <>
          {`, ${parts.notAvailable} `}
          <span {...figureTipAttrs(READ_NOT_AVAILABLE, NOT_AVAILABLE_LISTINGS_TIP, "estimate-coverage-na")}>
            {READ_NOT_AVAILABLE}
          </span>
        </>
      ) : null}
    </p>
  );
}

/** Mid with range; the asterisk opens the coverage tooltip when listings are missing. */
function Figure({ result }: { result: EstimateResult }) {
  if (result.status !== "estimated" || !result.range) {
    return (
      <span {...figureTipAttrs(READ_NOT_AVAILABLE, NOT_AVAILABLE_LISTINGS_TIP, "estimate-figure-na")}>
        {READ_NOT_AVAILABLE}
      </span>
    );
  }
  const tip = coverageShortText(result.trail);
  return (
    <>
      {resultFigureText(result)}
      {result.asterisk ? (
        <span {...figureTipAttrs("Partial coverage", tip, "estimate-figure-partial")} className="ifai-term partial-figure-mark">
          {PARTIAL_MARK}
        </span>
      ) : null}
    </>
  );
}

function TrailSection({ heading, children, id }: { heading: string; children: ReactNode; id: string }) {
  return (
    <section className="estimate-trail-section" data-estimate-section={id}>
      <h3>{heading}</h3>
      {children}
    </section>
  );
}

/**
 * The trail behind one dollar estimate (decision 112, chunk E2): the figure as mid with range,
 * labeled analyst estimate; the listings it covers and where their sales figures come from; each
 * input with its value and where it comes from; the formula in one sentence; the confidence
 * grade with the one input that would most improve it; and the sources with links and dates.
 * Any dollar estimate opens into this drawer. Escape, the close button, or a click outside closes it.
 */
export function EstimateTrail({ result, onClose }: { result: EstimateResult; onClose: () => void }) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const { trail } = result;
  const improvedBy = trail.mostImprovedBy?.trim() || null;

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="estimate-trail-layer" data-estimate-trail-layer="">
      <button type="button" className="estimate-trail-backdrop" aria-label="Close" tabIndex={-1} onClick={onClose} />
      <aside
        className="estimate-trail"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-estimate-trail={trail.lineId}
        data-estimate-confidence={trail.confidence}
      >
        <header className="estimate-trail-header">
          <div>
            <p className="estimate-trail-eyebrow">
              <span {...figureTipAttrs(ANALYST_ESTIMATE, ANALYST_ESTIMATE_TIP, "estimate-label")} data-analyst-estimate="">
                {ANALYST_ESTIMATE}
              </span>
            </p>
            <h2 id={titleId}>{trail.title}</h2>
          </div>
          <button ref={closeRef} type="button" className="estimate-trail-close" onClick={onClose} aria-label="Close">
            <X size={16} aria-hidden />
          </button>
        </header>

        <div className="estimate-trail-body">
          <p className="estimate-trail-figure" data-estimate-figure="">
            <Figure result={result} />
          </p>
          <p className="estimate-trail-means">{trail.means}</p>
          <CoverageLine trail={trail} />

          <TrailSection heading="How it is worked out" id="formula">
            <p className="estimate-trail-formula" data-estimate-formula="">
              {trail.formula}
            </p>
            {trail.notes.length > 0 ? (
              <ul className="estimate-trail-notes" data-estimate-notes={trail.notes.length}>
                {trail.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            ) : null}
          </TrailSection>

          <TrailSection heading="Inputs" id="inputs">
            <EstimateTrailInputs trail={trail} />
          </TrailSection>

          {salesSourceRows(trail).length > 0 ? (
            <TrailSection heading="Where the sales figures come from" id="sales-sources">
              <EstimateTrailSalesSplit trail={trail} />
            </TrailSection>
          ) : null}

          <TrailSection heading="Confidence" id="confidence">
            <p className="estimate-trail-confidence" data-estimate-grade={trail.confidence}>
              <StatusMark status={CONFIDENCE_STATUS[trail.confidence]} word={CONFIDENCE_WORD[trail.confidence]} />
              <span>{trail.confidenceReason}</span>
            </p>
            {improvedBy ? (
              <p className="estimate-trail-improve" data-estimate-improve="">
                <span className="estimate-trail-improve-label">Most improved by</span> {improvedBy}
              </p>
            ) : null}
          </TrailSection>

          {trail.sources.length > 0 ? (
            <TrailSection heading="Sources" id="sources">
              <EstimateTrailSources sources={trail.sources} />
            </TrailSection>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
