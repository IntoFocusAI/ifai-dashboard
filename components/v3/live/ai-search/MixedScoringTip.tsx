"use client";

import type { ReactNode } from "react";
import { CopyTip } from "@/components/v3/live/ai-search/CopyTip";
import { MIXED_SCORING_NOTE, MIXED_SCORING_TITLE } from "@/lib/ai-search/window-display";

/** What a figure counts, shown in its tooltip ahead of the mixed scoring note. */
export type FigureBasis = { label: string; note: string };

/**
 * The figure alone when every run in the selection scored leads the same way and it has no basis.
 * A figure with a basis keeps one tooltip, so the mixed scoring note joins it instead of nesting.
 */
export function MixedScoringTip({
  mixed,
  basis,
  children,
}: {
  mixed: boolean;
  basis?: FigureBasis;
  children: ReactNode;
}) {
  if (basis) {
    const tip = (
      <CopyTip label={basis.label} description={mixed ? `${basis.note} ${MIXED_SCORING_NOTE}` : basis.note}>
        {children}
      </CopyTip>
    );
    return mixed ? <span data-ai-mixed-scoring="">{tip}</span> : tip;
  }
  if (!mixed) return <>{children}</>;
  return (
    <span data-ai-mixed-scoring="">
      <CopyTip label={MIXED_SCORING_TITLE} description={MIXED_SCORING_NOTE}>
        {children}
      </CopyTip>
    </span>
  );
}
