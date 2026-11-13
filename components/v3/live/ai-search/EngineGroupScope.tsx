"use client";

import { useMemo, type ReactNode } from "react";
import { useAiHistoryOptional } from "@/components/v3/live/ai-search/AiHistoryContext";
import { AiSearchProvider, useAiSearch } from "@/components/v3/live/ai-search/AiSearchContext";
import { EngineGroupSwitch } from "@/components/v3/live/ai-search/EngineGroupSwitch";
import { useEngineGroupChoice } from "@/components/v3/live/ai-search/engine-group-store";
import { useApiEngineLoad } from "@/components/v3/live/ai-search/useApiEngineLoad";
import { apiRunDay } from "@/lib/ai-search/api-runs";
import type { EngineGroupChoice } from "@/lib/ai-search/engine-group";
import { engineGroupRead, engineSwitchState, type EngineSwitchState } from "@/lib/ai-search/engine-group-read";
import { engineGroupTrend, type EngineWindowLoad, type EngineWindowReader } from "@/lib/ai-search/engine-group-window";
import type { AiSearchRead, AiSearchSnapshot } from "@/lib/ai-search/types";
import "@/components/v3/live/ai-search/engine-group.css";

export type EngineSwitch = {
  state: EngineSwitchState;
  choose: (choice: EngineGroupChoice) => void;
  /** The API run's day beside a single run. */
  pairedDay: string | null;
};

/** The shared switch's position and what it can choose, without reading the selection. */
export function useEngineSwitch(): EngineSwitch {
  const history = useAiHistoryOptional();
  const load = useApiEngineLoad();
  const [choice, setChoice] = useEngineGroupChoice();
  const state = engineSwitchState(load, choice);
  const pairedDay =
    history?.mode.kind === "run" && state.kind === "ready" && load.phase === "ready" && load.snapshots[0]
      ? apiRunDay(load.snapshots[0].run)
      : null;
  return { state, choose: setChoice, pairedDay };
}

/**
 * The displayed selection with the API runs beside it, narrowed by the shared switch, or by
 * `readChoice` when a tab narrows further itself (Citation Ecosystem's engine chips).
 */
export function useEngineGroupRead(readChoice?: EngineGroupChoice): EngineSwitch & { read: AiSearchRead } {
  const displayed = useAiSearch();
  const load = useApiEngineLoad();
  const engineSwitch = useEngineSwitch();
  const [choice] = useEngineGroupChoice();
  const narrowBy = readChoice ?? choice;
  const read = useMemo(() => engineGroupRead(displayed, load, narrowBy), [narrowBy, displayed, load]);
  return { ...engineSwitch, read };
}

const NO_HISTORY: EngineWindowLoad<AiSearchSnapshot> = { phase: "idle" };

/**
 * The window's battery runs for the trend and the citation totals, each with the API runs nearest
 * its day, narrowed by the shared switch. `runCount` is the number of points the trend can draw.
 */
export function useEngineGroupWindow(
  reader: EngineWindowReader = "trend",
  /** A tab that narrows further itself reads this group instead of the switch's. */
  readChoice?: EngineGroupChoice,
): {
  trend: EngineWindowLoad<AiSearchSnapshot>;
  apiDays: ReadonlyMap<string, string[]>;
  runCount: number;
} {
  const history = useAiHistoryOptional();
  const load = useApiEngineLoad();
  const [switchChoice] = useEngineGroupChoice();
  const choice = readChoice ?? switchChoice;
  const trend = history?.trend ?? NO_HISTORY;
  const windowRuns = history?.windowRuns.length ?? 0;
  return useMemo(() => {
    const narrowed = engineGroupTrend(trend, load, choice, reader);
    const runCount =
      narrowed.trend === trend || narrowed.trend.phase !== "ready" ? windowRuns : narrowed.trend.snapshots.length;
    return { ...narrowed, runCount };
  }, [choice, load, reader, trend, windowRuns]);
}

/**
 * Wraps an AI Search or Competitive Radar tab body. The tab's figures read the narrowed selection.
 * The map keeps the published run.
 */
export function EngineGroupScope({
  children,
  showSwitch = true,
  trailing = null,
  readChoice,
}: {
  children: ReactNode;
  showSwitch?: boolean;
  /** Sits at the right end of the switch row. It reads the same narrowed selection as the tab. */
  trailing?: ReactNode;
  /** The group the tab body reads, when the tab narrows further itself and draws its own switch. */
  readChoice?: EngineGroupChoice;
}) {
  const { read, state, choose, pairedDay } = useEngineGroupRead(readChoice);
  return (
    <>
      {showSwitch ? (
        <EngineGroupSwitch
          state={state}
          onChoose={choose}
          pairedDay={pairedDay}
          trailing={trailing ? <AiSearchProvider read={read}>{trailing}</AiSearchProvider> : null}
        />
      ) : null}
      <AiSearchProvider read={read}>{children}</AiSearchProvider>
    </>
  );
}
