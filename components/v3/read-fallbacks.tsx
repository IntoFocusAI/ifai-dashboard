import type { ReactNode } from "react";
import { ConsensusScoresPanel } from "@/components/v3/live/ConsensusScoresPanel";
import { ReadNotAvailableBox, ReadNotAvailableMark } from "@/components/v3/live/ReadNotAvailable";
import type { SpokeId } from "@/components/v3/spoke-data-types";
import type { RetailCanvasRead } from "@/lib/fender-canvas/portfolio-retail-display";
import { bindCopy } from "@/lib/fender-canvas/template-vars";
import type { CanvasBundle } from "@/lib/fender-canvas/types";

const DESC_SLOT = "\u0001";

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

/** Summary description: the division count reads Not available* when the division read failed. */
export function readFallbackDesc(
  id: SpokeId,
  template: string,
  vars: Record<string, string>,
  bundle: CanvasBundle,
): { descSlot: ReactNode } | null {
  const divisions = bundle.unavailable?.divisions;
  if (id !== "hub" || !divisions) return null;
  const parts = bindCopy(template, { ...vars, division_count: DESC_SLOT }).split(DESC_SLOT);
  if (parts.length !== 2) return null;
  return {
    descSlot: (
      <>
        {parts[0]}
        <ReadNotAvailableMark failure={divisions} />
        {parts[1]}
      </>
    ),
  };
}
