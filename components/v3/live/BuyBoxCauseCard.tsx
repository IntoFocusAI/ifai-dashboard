"use client";

import {
  BUY_BOX_CAUSE_LABELS,
  lowerPricesElsewhere,
  splitBuyBoxCauses,
  type BuyBoxCause,
  type WithheldCauseRow,
} from "@/lib/fender-canvas/buy-box-cause";
import { formatRatio } from "@/lib/fender-canvas/format";

const CARD_STYLE = {
  flex: "0 0 auto",
  width: "fit-content",
  maxWidth: "100%",
  alignSelf: "flex-start" as const,
  display: "flex",
  flexDirection: "column" as const,
  gap: 6,
};

const LINE_STYLE = { display: "flex", alignItems: "baseline", gap: 8 };

const CAUSES: readonly BuyBoxCause[] = ["price", "other"];

/**
 * Suppressed Listings: the withheld listings split by stored cause, each as N of M, and how many
 * of the withheld listings have a lower Walmart or Musician's Friend price on file.
 */
export function BuyBoxCauseCard({ rows }: { rows: readonly WithheldCauseRow[] }) {
  const split = splitBuyBoxCauses(rows);
  if (split.withheld === 0) return null;
  const lower = rows.filter((row) => lowerPricesElsewhere(row).length > 0).length;
  return (
    <div className="content-box findability-lead-card" data-buybox-cause-split="" style={CARD_STYLE}>
      <span>By cause</span>
      {CAUSES.map((cause) => (
        <div key={cause} style={LINE_STYLE} data-buybox-cause={cause} data-buybox-cause-count={split[cause]}>
          <span className="findability-lead-ratio" style={{ whiteSpace: "nowrap" }}>
            {formatRatio(split[cause], split.withheld)}
          </span>
          <span className="metric-card-sub">{BUY_BOX_CAUSE_LABELS[cause]}</span>
        </div>
      ))}
      <div style={LINE_STYLE} data-buybox-lower-count={lower}>
        <span className="findability-lead-ratio" style={{ whiteSpace: "nowrap" }}>
          {formatRatio(lower, split.withheld)}
        </span>
        <span className="metric-card-sub">Lower price on file elsewhere</span>
      </div>
    </div>
  );
}
