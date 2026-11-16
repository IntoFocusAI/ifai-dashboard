"use client";

import { CitationNotAvailable } from "@/components/v3/live/ai-search/CitationNotAvailable";
import { MODEL_NOT_RECORDED, modelLabel } from "@/lib/ai-search/run-metrics";

/**
 * An answer's model as the engine reported it, or Not available* with the reason in its tooltip.
 * `name` (from modelNamer) shows every spelling of one model the same way across a table.
 */
export function ModelName({
  model,
  name = modelLabel,
}: {
  model: string | null | undefined;
  name?: (model: string | null | undefined) => string;
}) {
  const label = name(model);
  return label === MODEL_NOT_RECORDED ? (
    <CitationNotAvailable description="The engine did not report which model wrote this answer." />
  ) : (
    <>{label}</>
  );
}
