"use client";

import { useCallback, useRef, useState } from "react";
import { EstimateTrail } from "@/components/v3/live/estimates/EstimateTrail";
import { resultFigureText, resultHeroText } from "@/components/v3/live/estimates/trail-copy";
import type { EstimateResult } from "@/lib/estimates/types";

/**
 * A dollar estimate that opens to its trail: the mid with its range and the analyst estimate
 * label, as a button. On a hero card the mid is the figure and the range sits on its own line
 * below in the N of M type. Focus returns here when the trail closes.
 */
export function EstimateTrailTrigger({ result, className, hero }: { result: EstimateResult; className?: string; hero?: boolean }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => {
    setOpen(false);
    buttonRef.current?.focus();
  }, []);
  const heroText = hero ? resultHeroText(result) : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`estimate-trail-trigger${heroText ? " estimate-trail-trigger-hero" : ""}${className ? ` ${className}` : ""}`}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-estimate-trigger={result.lineId}
      >
        <span className={`estimate-trail-trigger-figure${result.status === "estimated" ? " estimate-trail-trigger-figure-gain" : ""}`}>
          {heroText ? heroText.figure : resultFigureText(result)}
          {result.asterisk && result.status === "estimated" ? "*" : null}
        </span>
        <span className="estimate-trail-trigger-label">{result.label}</span>
        {heroText?.range ? (
          <span className="estimate-trail-trigger-range" data-estimate-range="">
            {heroText.range}
          </span>
        ) : null}
      </button>
      {open ? <EstimateTrail result={result} onClose={close} /> : null}
    </>
  );
}
