"use client";

import { useMemo } from "react";
import { useAiHistoryOptional } from "@/components/v3/live/ai-search/AiHistoryContext";
import { useAiSearch } from "@/components/v3/live/ai-search/AiSearchContext";
import {
  citationAggregateCopy,
  citationMonthBounds,
  citationSnapshotUsable,
  poolCitationSnapshots,
  type CitationWindow,
} from "@/lib/ai-search/citation-aggregate";
import type { CitationFailedRead } from "@/lib/ai-search/citation-read-failure";
import { utcDay } from "@/lib/ai-search/history-eligibility";
import type { AiSearchSnapshot } from "@/lib/ai-search/types";

export type CitationAggregate =
  | { phase: "loading" }
  | { phase: "error"; message: string; failed: CitationFailedRead }
  | { phase: "empty"; message: string }
  | { phase: "ready"; snapshot: AiSearchSnapshot; copy: string; singleRun: boolean };

function finish(
  window: CitationWindow,
  snapshots: AiSearchSnapshot[],
  singleRun: boolean,
): CitationAggregate {
  const included = snapshots.filter(citationSnapshotUsable);
  const omitted = snapshots.length - included.length;
  const snapshot = poolCitationSnapshots(included);
  if (!snapshot) {
    return {
      phase: "empty",
      message:
        omitted > 0
          ? "No run in this selection stored a citation list, so no citation figure is shown."
          : "No stored review runs fall in this selection.",
    };
  }
  return {
    phase: "ready",
    snapshot,
    singleRun,
    copy: singleRun ? "" : citationAggregateCopy({ window, included, omitted }),
  };
}

export function useCitationAggregate(): CitationAggregate {
  const history = useAiHistoryOptional();
  const read = useAiSearch();
  const mode = history?.mode;
  const trend = history?.trend;
  const current = history?.current;

  const window = useMemo<CitationWindow | null>(() => {
    if (!mode || mode.kind === "legacy") return null;
    if (mode.kind === "run") return { kind: "run" };
    if (mode.kind === "all") return { kind: "all" };
    if (mode.kind === "range") return { kind: "range", from: mode.from, to: mode.to };
    if (current?.phase !== "ready") return null;
    const endDay = utcDay(current.snapshot.run.published_at ?? current.snapshot.run.completed_at);
    if (!endDay) return null;
    const bounds = citationMonthBounds(endDay);
    return bounds ? { kind: "month", ...bounds } : null;
  }, [current, mode]);

  const trendAggregate = useMemo<CitationAggregate | null>(() => {
    if (!window || window.kind === "run") return null;
    if (!trend || trend.phase === "loading" || trend.phase === "idle") return { phase: "loading" };
    if (trend.phase === "error" || trend.phase === "unavailable") {
      return { phase: "error", message: trend.message, failed: "period" };
    }
    return finish(window, trend.snapshots, false);
  }, [trend, window]);

  if (!history || !mode || mode.kind === "run") {
    if (read.phase === "loading") return { phase: "loading" };
    if (read.phase === "error") return { phase: "error", message: read.message, failed: "published" };
    if (read.phase === "no-run") return { phase: "empty", message: "No AI run has been published yet." };
    return finish({ kind: "run" }, [read.snapshot], true);
  }
  if (mode.kind === "legacy") {
    return { phase: "empty", message: "Legacy test runs stay out of the citation totals." };
  }
  if (mode.kind === "month" && !window) {
    if (!current || current.phase === "loading") return { phase: "loading" };
    if (current.phase === "error") return { phase: "error", message: current.message, failed: "published" };
    if (current.phase === "no-run") return { phase: "empty", message: "No AI run has been published yet." };
    return { phase: "loading" };
  }
  if (trendAggregate) return trendAggregate;
  return { phase: "loading" };
}
