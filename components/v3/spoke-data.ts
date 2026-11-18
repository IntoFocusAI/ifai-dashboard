import { buildNarrativeSpokes } from "@/lib/fender-canvas/spoke-narrative";

export type { SpokeDefinition, SpokeId } from "@/components/v3/spoke-data-types";

/** Narrative copy and tab HTML templates (`data/canvas-narrative.json`), filled from the client settings. */
export const spokeData = buildNarrativeSpokes();
