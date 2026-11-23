"use client";

import { useMemo } from "react";
import { useAiHistoryOptional } from "@/components/v3/live/ai-search/AiHistoryContext";
import { utcDay } from "@/lib/ai-search/history-eligibility";
import { DEFAULT_PERIOD_DAYS, periodDaysFor } from "@/lib/estimates/period";

/**
 * R-07: the days in the shared date pill's period, for a period-scaled dollar figure (the Buy Box
 * figure). Outside the dashboard's history provider it is the pill's default, 30 days.
 */
export function useEstimatePeriodDays(): number {
  const history = useAiHistoryOptional();
  const mode = history?.mode ?? null;
  const windowEnd = history?.windowEnd ?? null;
  const runs = history?.windowRuns ?? null;
  return useMemo(() => {
    if (!mode) return DEFAULT_PERIOD_DAYS;
    const runDays = (runs ?? []).map((run) => utcDay(run.published_at ?? run.completed_at));
    return periodDaysFor(mode, { windowEnd, runDays });
  }, [mode, runs, windowEnd]);
}
