"use client";

import { useMemo, useState } from "react";
import { useAiHistoryOptional } from "@/components/v3/live/ai-search/AiHistoryContext";
import { useAiSearch } from "@/components/v3/live/ai-search/AiSearchContext";
import { useEngineSwitch, type EngineSwitch } from "@/components/v3/live/ai-search/EngineGroupScope";
import { useApiEngineLoad } from "@/components/v3/live/ai-search/useApiEngineLoad";
import { citationSnapshotUsable } from "@/lib/ai-search/citation-aggregate";
import {
  DEFAULT_CITATION_QUESTION,
  answeredEngines,
  coveringChoice,
  presetEngines,
  presetForEngines,
  toggleEngine,
  type CitationQuestion,
} from "@/lib/ai-search/citation-filters";
import { isApiEngine, type EngineGroupChoice } from "@/lib/ai-search/engine-group";
import type { AiSearchSnapshot } from "@/lib/ai-search/types";

export type CitationFilters = {
  engineSwitch: EngineSwitch;
  /** Engines with answers in the selection: one chip each. */
  available: string[];
  /** The chips that are on. */
  selected: string[];
  /** The chips match no preset. */
  custom: boolean;
  /** The engine group the tab reads before the chips narrow it. */
  readChoice: EngineGroupChoice;
  /** The chip set to narrow by, or null when the chips match the group the tab reads. */
  narrowTo: string[] | null;
  choosePreset: (choice: EngineGroupChoice) => void;
  toggle: (engine: string) => void;
  question: CitationQuestion;
  setQuestion: (question: CitationQuestion) => void;
};

/** What the Citation Ecosystem body reads from the filters. */
export type EcosystemFilters = {
  question: CitationQuestion;
  onQuestion: (question: CitationQuestion) => void;
  /** The engine chips when they match no preset; null leaves the read as it is. */
  narrowTo: string[] | null;
  /** The engine group the tab reads, sent with Download CSV. */
  readChoice: EngineGroupChoice;
  category: string | null;
  onCategory: (category: string | null) => void;
};

/**
 * Citation Ecosystem's engine chips and question control (decision 86). Call it outside the tab's
 * EngineGroupScope: the chips list every engine in the selection, whatever the preset.
 */
export function useCitationFilters(): CitationFilters {
  const engineSwitch = useEngineSwitch();
  const displayed = useAiSearch();
  const history = useAiHistoryOptional();
  const load = useApiEngineLoad();
  const [chips, setChips] = useState<string[] | null>(null);
  const [question, setQuestion] = useState<CitationQuestion>(DEFAULT_CITATION_QUESTION);
  const { state, choose } = engineSwitch;
  const ready = state.kind === "ready";

  const windowed = history != null && history.mode.kind !== "run" && history.mode.kind !== "legacy";
  const trend = history?.trend;
  const available = useMemo(() => {
    const search: AiSearchSnapshot[] = windowed
      ? trend?.phase === "ready"
        ? trend.snapshots.filter(citationSnapshotUsable)
        : []
      : displayed.phase === "ready"
        ? [displayed.snapshot]
        : [];
    const searchEngines = answeredEngines(search).filter((engine) => !isApiEngine(engine));
    const apiEngines =
      ready && load.phase === "ready" ? answeredEngines(load.snapshots).filter((engine) => isApiEngine(engine)) : [];
    return [...searchEngines, ...apiEngines];
  }, [displayed, load, ready, trend, windowed]);

  const presets: EngineGroupChoice[] = ready ? ["all", "search", "api"] : ["all"];
  const preset: EngineGroupChoice = ready ? state.choice : "all";
  const kept = chips?.filter((engine) => available.includes(engine)) ?? [];
  const selected = kept.length > 0 ? kept : presetEngines(preset, available);
  const match = presetForEngines(selected, available, presets);
  const custom = kept.length > 0 && match === "custom";
  const readChoice: EngineGroupChoice = !ready ? preset : custom ? coveringChoice(selected) : preset;

  return {
    engineSwitch,
    available,
    selected,
    custom,
    readChoice,
    narrowTo: custom ? selected : null,
    choosePreset: (choice) => {
      setChips(null);
      choose(choice);
    },
    toggle: (engine) => {
      const next = toggleEngine(selected, engine);
      const nextMatch = presetForEngines(next, available, presets);
      if (nextMatch === "custom") {
        setChips(next);
        return;
      }
      setChips(null);
      if (ready) choose(nextMatch);
    },
    question,
    setQuestion,
  };
}
