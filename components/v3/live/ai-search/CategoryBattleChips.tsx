"use client";

import type { ReactNode } from "react";
import { Check, X, type LucideIcon } from "lucide-react";
import { LEAD_STATUS_ICONS } from "@/components/v3/live/ai-search/CategoryLeadPies";
import {
  isBattlecardFiltered,
  LEAD_FILTER_LABELS,
  NO_BATTLECARD_FILTER,
  type BattlecardFilter,
  type LeadFilter,
} from "@/lib/ai-search/category-on-track";
import { engineLabel } from "@/lib/ai-search/run-metrics";

const LEAD_CHIPS: Array<[LeadFilter, LucideIcon | null]> = [
  ["all", null],
  ["fender", LEAD_STATUS_ICONS.on_track],
  ["other", LEAD_STATUS_ICONS.behind],
];

function Chip({
  id,
  pressed,
  icon: Icon,
  onClick,
  children,
}: {
  id: string;
  pressed: boolean;
  icon?: LucideIcon | null;
  onClick: () => void;
  children: ReactNode;
}) {
  const Mark = pressed ? Check : Icon;
  return (
    <button type="button" className="ai-battle-chip" aria-pressed={pressed} data-ai-battle-chip={id} onClick={onClick}>
      {Mark ? <Mark size={13} strokeWidth={2.6} aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

function ActiveChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      className="ai-battle-active-chip"
      aria-label={`Remove filter: ${label}`}
      data-ai-battle-active-chip={label}
      onClick={onRemove}
    >
      {label}
      <X size={13} strokeWidth={2.6} aria-hidden="true" />
    </button>
  );
}

/** Engine and who-leads chips. A pressed chip again, its x, or Clear filters goes back to everything. */
export function CategoryBattleChips({
  engines,
  filter,
  onChange,
  shown,
  total,
}: {
  engines: readonly string[];
  filter: BattlecardFilter;
  onChange: (next: BattlecardFilter) => void;
  shown: number;
  total: number;
}) {
  const set = (patch: Partial<BattlecardFilter>) => onChange({ ...filter, ...patch });
  const filtered = isBattlecardFiltered(filter);

  return (
    <div className="ai-battle-chips" data-ai-battle-chips="">
      <div className="ai-battle-chip-group" role="group" aria-label="Engine">
        <span className="ai-battle-chip-group-label" aria-hidden="true">
          Engine
        </span>
        <Chip id="engine:all" pressed={filter.engine === ""} onClick={() => set({ engine: "" })}>
          All engines
        </Chip>
        {engines.map((engine) => (
          <Chip
            key={engine}
            id={`engine:${engine}`}
            pressed={filter.engine === engine}
            onClick={() => set({ engine: filter.engine === engine ? "" : engine })}
          >
            {engineLabel(engine)}
          </Chip>
        ))}
      </div>
      <div className="ai-battle-chip-group" role="group" aria-label="Who leads">
        <span className="ai-battle-chip-group-label" aria-hidden="true">
          Who leads
        </span>
        {LEAD_CHIPS.map(([lead, icon]) => (
          <Chip
            key={lead}
            id={`lead:${lead}`}
            pressed={filter.lead === lead}
            icon={icon}
            onClick={() => set({ lead: filter.lead === lead ? "all" : lead })}
          >
            {LEAD_FILTER_LABELS[lead]}
          </Chip>
        ))}
      </div>
      <div className="ai-battle-active" aria-live="polite" data-ai-battle-active="">
        <span data-ai-battle-shown="">
          Showing {shown} of {total} categories.
        </span>
        {filtered ? (
          <>
            <span>Filtered by</span>
            {filter.engine ? <ActiveChip label={engineLabel(filter.engine)} onRemove={() => set({ engine: "" })} /> : null}
            {filter.lead !== "all" ? (
              <ActiveChip label={LEAD_FILTER_LABELS[filter.lead]} onRemove={() => set({ lead: "all" })} />
            ) : null}
            <button
              type="button"
              className="ai-battle-clear"
              data-ai-battle-clear=""
              onClick={() => onChange(NO_BATTLECARD_FILTER)}
            >
              Clear filters
            </button>
          </>
        ) : (
          <span>No filter is on.</span>
        )}
      </div>
    </div>
  );
}
