"use client";

import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import { useAiHistoryOptional } from "@/components/v3/live/ai-search/AiHistoryContext";
import { useAiSearch } from "@/components/v3/live/ai-search/AiSearchContext";
import { HistoryTrendsPanel } from "@/components/v3/live/ai-search/HistoryTrendsPanel";
import { LegacyRunInspect } from "@/components/v3/live/ai-search/LegacyRunInspect";

const TREND_OPEN_KEY = "ifai-ai-trend-open";

const TrendSlot = createContext<ReactNode>(null);

/** The collapsible trend, placed by Run Summary under its lead rates. Null when the tab has no trend. */
export function useTrendSlot(): ReactNode {
  return useContext(TrendSlot);
}

const trendListeners = new Set<() => void>();

function subscribeTrendOpen(listener: () => void) {
  trendListeners.add(listener);
  return () => trendListeners.delete(listener);
}

function readTrendOpen() {
  return window.localStorage.getItem(TREND_OPEN_KEY) !== "0";
}

/** The trend chart sits under Run Summary's lead rates. A reader can collapse it, and the choice is kept. */
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
 * The last 30 days, range, and all open the tab children on the pooled selection. A default window
 * with no published run skips the trend so the tab opens on that notice and the latest-run choice.
 * Once the selection loads, Run Summary opens on its two lead rates and places the collapsible
 * trend under them through useTrendSlot. While it loads or fails, the trend sits above the notice.
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
  const read = useAiSearch();
  const kind = history?.mode.kind;
  const windowed = kind === "month" || kind === "range" || kind === "all";
  const emptyWindow = kind === "month" && history?.trend.phase === "ready" && history.trend.snapshots.length === 0;
  if (windowed && followsRange) return children;
  if (windowed && trend && !emptyWindow) {
    if (read.phase === "ready") return <TrendSlot value={<CollapsibleTrend />}>{children}</TrendSlot>;
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
