"use client";

import { AiReadinessLead } from "@/components/v3/live/AiReadinessLead";
import { FenderSpecPanel } from "@/components/v3/live/FenderSpecPanel";
import type { CanvasBundle } from "@/lib/fender-canvas/types";

/** Amazon Specs tab: Amazon completeness, missing Amazon fields, and per-listing table. */
export function CatalogReadinessSpec({ bundle }: { bundle: CanvasBundle }) {
  return (
    <div className="readiness-surface" data-amazon-specs="">
      <AiReadinessLead bundle={bundle} />
      <FenderSpecPanel
        missing={bundle.missing}
        specChecked={bundle.m.spec_checked}
        catalogReadiness
      />
    </div>
  );
}
