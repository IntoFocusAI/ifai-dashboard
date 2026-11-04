"use client";

import { CopyTip } from "@/components/v3/live/ai-search/CopyTip";
import { API_ENGINES, API_ENGINE_LABELS, ENGINE_GROUP_CHOICES, type EngineGroupChoice } from "@/lib/ai-search/engine-group";
import { API_NOT_AVAILABLE_TIPS, type EngineSwitchState } from "@/lib/ai-search/engine-group-read";

const API_ENGINE_LIST = API_ENGINES.map((engine) => API_ENGINE_LABELS[engine]).join(", ");

const API_TIP = `API engines are assistants asked directly through their developer APIs: ${API_ENGINE_LIST}. Search engines are the assistants in the regular AI Search battery. Both get the same questions and the same scoring.`;

/** All · Without API · API only. Every figure on the tab follows it; the date pill still names the period. */
export function EngineGroupSwitch({
  state,
  onChoose,
}: {
  state: EngineSwitchState;
  onChoose: (choice: EngineGroupChoice) => void;
}) {
  const ready = state.kind === "ready";
  const active: EngineGroupChoice = ready ? state.choice : "all";
  return (
    <div className="ai-engine-switch" data-ai-engine-switch={state.kind}>
      <span className="ai-engine-switch-label">
        <CopyTip label="API engines" description={API_TIP}>
          Engines
        </CopyTip>
      </span>
      <div className="segmented-control" role="group" aria-label="Engines">
        {ENGINE_GROUP_CHOICES.map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`segmented-btn${active === value ? " active" : ""}`}
            aria-pressed={active === value}
            disabled={!ready}
            data-ai-engine-choice={value}
            onClick={() => onChoose(value)}
          >
            {label}
          </button>
        ))}
      </div>
      {state.kind === "unavailable" ? (
        <span className="ai-engine-switch-na" data-ai-engine-na={state.reason}>
          <CopyTip
            label="API engines"
            description={state.message ? `${API_NOT_AVAILABLE_TIPS[state.reason]} ${state.message}` : API_NOT_AVAILABLE_TIPS[state.reason]}
          >
            API engines: Not available*
          </CopyTip>
        </span>
      ) : null}
      {state.kind === "loading" ? <span className="ai-engine-switch-na">Loading API engines</span> : null}
    </div>
  );
}
