import type { EvidenceFocus } from "@/lib/ai-search/evidence-focus";
import { filterFromEvidence, type ExplorerFilter } from "@/lib/ai-search/explorer-filter";

/** The Run Details filter for a link, including the category and engine a filtered tab adds. */
export function explorerFilterFor(focus: EvidenceFocus | null): ExplorerFilter {
  const filter = filterFromEvidence(focus);
  if (!focus?.category && !focus?.engine) return filter;
  return {
    ...filter,
    ...(focus.category ? { category: focus.category } : {}),
    ...(focus.engine ? { engine: focus.engine.toLowerCase() } : {}),
  };
}
