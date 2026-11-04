"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { useAiHistoryOptional } from "@/components/v3/live/ai-search/AiHistoryContext";
import { HistoryTrendsPanel } from "@/components/v3/live/ai-search/HistoryTrendsPanel";
import { LegacyRunInspect } from "@/components/v3/live/ai-search/LegacyRunInspect";

const TREND_OPEN_KEY = "ifai-ai-trend-open";

const trendListeners = new Set<() => void>();

function subscribeTrendOpen(listener: () => void) {
  trendListeners.add(listener);
  return () => trendListeners.delete(listener);
}

function readTrendOpen() {
  return window.localStorage.getItem(TREND_OPEN_KEY) !== "0";
}

/** The trend chart opens first on Run Summary. A reader can collapse it, and the choice is kept. */
function CollapsibleTrend() {
  const open = useSyncExternalStore(subscribeTrendOpen, readTrendOpen, () => true);
  return (
    <details
      className="content-box ai-trend-section"
      open={open}
      data-ai-trend-section
      onToggle={(event) => {
        const next = event.currentTarget.open;
        if (next === readTrendOpen()) return;
        window.localStorage.setItem(TREND_OPEN_KEY, next ? "1" : "0");
        trendListeners.forEach((listener) => listener());
      }}
    >
      <summary className="content-box-title">Trend over the selected runs</summary>
      {open ? <HistoryTrendsPanel /> : null}
    </details>
  );
}

/**
 * Month, range, and all open the tab children on the pooled selection. A latest month with no
 * published run skips the trend so the tab opens on that notice and the latest-run choice.
 * Run Summary opens on the collapsible trend chart, then its figures.
 * Citation Ecosystem still follows range and all through followsRange.
 * Legacy stays on LegacyRunInspect. The map stays on the published run.
 */
export function AiSearchSurface({
  children,
  trend = false,
  followsRange = false,
}: {
  children: ReactNode;
  trend?: boolean;
  /** This tab computes its own figures from the runs in All time or a date range. */
  followsRange?: boolean;
}) {
  const history = useAiHistoryOptional();
  const kind = history?.mode.kind;
  const windowed = kind === "month" || kind === "range" || kind === "all";
  const emptyMonth = kind === "month" && history?.trend.phase === "ready" && history.trend.snapshots.length === 0;
  if (windowed && followsRange) return children;
  if (windowed && trend && !emptyMonth) {
    return (
      <>
        <CollapsibleTrend />
        {children}
      </>
    );
  }
  if (windowed) return children;
  if (kind === "legacy") {
    return (
      <div className="ai-search-panel">
        <LegacyRunInspect />
      </div>
    );
  }
  return children;
}
