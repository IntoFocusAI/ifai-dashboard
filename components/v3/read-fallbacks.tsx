import type { ReactNode } from "react";
import { ConsensusScoresPanel } from "@/components/v3/live/ConsensusScoresPanel";
import { ReadNotAvailableBox } from "@/components/v3/live/ReadNotAvailable";
import type { SpokeId } from "@/components/v3/spoke-data-types";
import type { RetailCanvasRead } from "@/lib/fender-canvas/portfolio-retail-display";
import type { CanvasBundle } from "@/lib/fender-canvas/types";

/**
 * A tab whose table comes from one failed bundle read. The table becomes Not available*;
 * the rest of the tab renders as usual. Null keeps the normal tab.
 */
export function readFallbackTab(
  id: SpokeId,
  tabIdx: number,
  bundle: CanvasBundle,
  retail: RetailCanvasRead,
): ReactNode | null {
  const divisions = bundle.unavailable?.divisions;
  if (id === "hub" && tabIdx === 1 && divisions) {
    return (
      <>
        <ConsensusScoresPanel bundle={bundle} retail={retail} />
        <ReadNotAvailableBox title="FMIC Catalog Division Performance Matrix" failure={divisions} />
      </>
    );
  }
  return null;
}
