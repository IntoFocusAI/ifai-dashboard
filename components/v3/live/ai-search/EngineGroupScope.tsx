"use client";

import { useMemo, type ReactNode } from "react";
import { AiSearchProvider, useAiSearch } from "@/components/v3/live/ai-search/AiSearchContext";
import { EngineGroupSwitch } from "@/components/v3/live/ai-search/EngineGroupSwitch";
import { useEngineGroupChoice } from "@/components/v3/live/ai-search/engine-group-store";
import { useApiEngineLoad } from "@/components/v3/live/ai-search/useApiEngineLoad";
import { engineGroupRead, engineSwitchState, type EngineSwitchState } from "@/lib/ai-search/engine-group-read";
import type { EngineGroupChoice } from "@/lib/ai-search/engine-group";
import type { AiSearchRead } from "@/lib/ai-search/types";
import "@/components/v3/live/ai-search/engine-group.css";

/** The displayed selection with the API runs beside it, narrowed by the shared switch. */
export function useEngineGroupRead(): {
  read: AiSearchRead;
  state: EngineSwitchState;
  choose: (choice: EngineGroupChoice) => void;
} {
  const displayed = useAiSearch();
  const load = useApiEngineLoad();
  const [choice, setChoice] = useEngineGroupChoice();
  const read = useMemo(() => engineGroupRead(displayed, load, choice), [choice, displayed, load]);
  return { read, state: engineSwitchState(load, choice), choose: setChoice };
}

/**
 * Wraps an AI Search or Competitive Radar tab body. The tab's figures read the narrowed selection.
 * The map keeps the published run.
 */
export function EngineGroupScope({ children, showSwitch = true }: { children: ReactNode; showSwitch?: boolean }) {
  const { read, state, choose } = useEngineGroupRead();
  return (
    <>
      {showSwitch ? <EngineGroupSwitch state={state} onChoose={choose} /> : null}
      <AiSearchProvider read={read}>{children}</AiSearchProvider>
    </>
  );
}
