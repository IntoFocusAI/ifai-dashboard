"use client";

import { AiReadinessLead } from "@/components/v3/live/AiReadinessLead";
import { AmazonSpecsLastChecked } from "@/components/v3/live/AmazonSpecsLastChecked";
import { AmazonSpecsRequiredFields } from "@/components/v3/live/AmazonSpecsRequiredFields";
import { FenderSpecPanel, MissingFieldList, useAmazonSpecRows } from "@/components/v3/live/FenderSpecPanel";
import { HeroBand } from "@/components/v3/live/HeroBand";
import { EstimateLineCard } from "@/components/v3/live/estimates/EstimateLineFigure";
import type { CanvasBundle } from "@/lib/fender-canvas/types";

/**
 * Amazon Specs tab: the shared hero band (X-36). The content-sized completeness hero sits at the
 * top left; Last checked, the required-field lines, and Top missing Amazon fields fill the space
 * beside it; the full-width Amazon listings table follows. One spec read feeds the hero totals,
 * Last checked, and the table.
 */
export function CatalogReadinessSpec({ bundle }: { bundle: CanvasBundle }) {
  const specRows = useAmazonSpecRows();
  return (
    <div className="readiness-surface" data-amazon-specs="">
      <HeroBand
        bandAttrs={{ "data-amazon-specs-band": "" }}
        heroesAttrs={{ "data-amazon-specs-hero-col": "" }}
        heroes={
          <>
            <AiReadinessLead bundle={bundle} specRows={specRows} />
            <EstimateLineCard lineId="missing_specs" />
          </>
        }
        notes={
          <>
            <AmazonSpecsLastChecked read={specRows} />
            <AmazonSpecsRequiredFields read={specRows} />
            <MissingFieldList
              missing={bundle.missing}
              specChecked={bundle.m.spec_checked}
              missingFailure={bundle.unavailable?.missing ?? null}
              metricsFailure={bundle.unavailable?.m ?? null}
            />
          </>
        }
      />
      <FenderSpecPanel catalogReadiness read={specRows} />
    </div>
  );
}
