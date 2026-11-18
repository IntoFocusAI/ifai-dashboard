import "@/components/v3/live/summary.css";
import type { ReactNode } from "react";
import { SCORE_OUT_OF } from "@/lib/fender-canvas/consensus-score-display";

/**
 * A 0 to 100 score hero figure with a small "/100" right after it, in the N of M type, so "4"
 * reads as 4 out of 100 and never as 4 of the target. No "/100" when there is no score.
 */
export function ScoreOutOf100({ show, children }: { show: boolean; children: ReactNode }) {
  return (
    <span className="score-figure-line">
      {children}
      {show ? (
        <span className="score-out-of-100" data-score-out-of="">
          {SCORE_OUT_OF}
        </span>
      ) : null}
    </span>
  );
}
