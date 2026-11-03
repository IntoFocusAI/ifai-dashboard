"use client";

import type { ReactNode } from "react";
import { CopyTip } from "@/components/v3/live/ai-search/CopyTip";
import { MIXED_SCORING_NOTE, MIXED_SCORING_TITLE } from "@/lib/ai-search/window-display";

/** The figure alone when every run in the selection scored leads the same way. */
export function MixedScoringTip({ mixed, children }: { mixed: boolean; children: ReactNode }) {
  if (!mixed) return <>{children}</>;
  return (
    <span data-ai-mixed-scoring="">
      <CopyTip label={MIXED_SCORING_TITLE} description={MIXED_SCORING_NOTE}>
        {children}
      </CopyTip>
    </span>
  );
}
