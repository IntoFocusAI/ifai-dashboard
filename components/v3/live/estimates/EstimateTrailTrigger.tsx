"use client";

import { useCallback, useRef, useState } from "react";
import { EstimateTrail } from "@/components/v3/live/estimates/EstimateTrail";
import { resultFigureText } from "@/components/v3/live/estimates/trail-copy";
import type { EstimateResult } from "@/lib/estimates/types";

/**
 * A dollar estimate that opens to its trail: the mid with its range and the analyst estimate
 * label, as a button. Focus returns here when the trail closes.
 */
export function EstimateTrailTrigger({ result, className }: { result: EstimateResult; className?: string }) {
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
        data-estimate-trigger={result.lineId}
      >
        <span className="estimate-trail-trigger-figure">
          {resultFigureText(result)}
          {result.asterisk && result.status === "estimated" ? "*" : null}
        </span>
        <span className="estimate-trail-trigger-label">{result.label}</span>
      </button>
      {open ? <EstimateTrail result={result} onClose={close} /> : null}
    </>
  );
}
