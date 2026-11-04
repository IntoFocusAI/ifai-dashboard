"use client";

import { AiReadinessLead } from "@/components/v3/live/AiReadinessLead";
import { FenderSpecPanel, MissingFieldList, useAmazonSpecRows } from "@/components/v3/live/FenderSpecPanel";
import type { CanvasBundle } from "@/lib/fender-canvas/types";

/**
 * Amazon Specs tab: content-sized completeness hero beside Top missing Amazon fields,
 * then the full-width Amazon listings table (same band pattern as Brand-Site Specs).
 * One spec read feeds the hero totals, Last checked, and the table.
 */
export function CatalogReadinessSpec({ bundle }: { bundle: CanvasBundle }) {
  const specRows = useAmazonSpecRows();
  return (
    <div className="readiness-surface" data-amazon-specs="">
      <div
        data-amazon-specs-band=""
        style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-start" }}
      >
        <div
          data-amazon-specs-hero-col=""
          style={{
            flex: "0 0 auto",
            width: "max-content",
            maxWidth: "100%",
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            alignItems: "stretch",
          }}
        >
          <AiReadinessLead bundle={bundle} specRows={specRows} />
        </div>
        <MissingFieldList missing={bundle.missing} specChecked={bundle.m.spec_checked} />
      </div>
      <FenderSpecPanel catalogReadiness read={specRows} />
    </div>
  );
}
