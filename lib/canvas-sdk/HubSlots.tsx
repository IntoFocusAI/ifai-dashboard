"use client";

import { StatusGlyph } from "@/components/v3/live/StatusMark";
import { dataStatusFromNode } from "@/lib/canvas-sdk/data-status";
import { formatInt } from "@/lib/fender-canvas/format";
import type { HubSlot, HubSlotChart, HubSlotFeed, HubSlotRole } from "@/lib/canvas-sdk/types";

const ROLE_LABEL: Record<HubSlotRole, string> = {
  gap: "Performance gap",
  opportunity: "Opportunity",
  action: "Next action",
};

type Props = {
  feeds: Record<string, HubSlotFeed>;
  bubbleId: string;
  onOpen: (spokeId: string, subTab?: string) => void;
};

function pieStyle(chart: HubSlotChart): string {
  const share = (chart.part / chart.total) * 360;
  const part = chart.part === chart.total ? "var(--accent-cyan)" : "var(--accent-cyan)";
  const rest = "color-mix(in srgb, var(--text-subtle) 55%, transparent)";
  if (chart.part <= 0) return rest;
  if (chart.part >= chart.total) return part;
  return `conic-gradient(${part} 0deg ${share}deg, ${rest} ${share}deg 360deg)`;
}

function SlotChart({ chart }: { chart: HubSlotChart }) {
  const rest = chart.total - chart.part;
  return (
    <div className="hub-slot-chart">
      <div
        className="hub-slot-pie"
        style={{ background: pieStyle(chart) }}
        role="img"
        aria-label={`${chart.part} ${chart.partLabel}. ${rest} ${chart.restLabel}. Total ${chart.total}.`}
      />
      <span>of {formatInt(chart.total)} listings</span>
    </div>
  );
}

function SlotCard({ slot, onOpen }: { slot: HubSlot; onOpen: Props["onOpen"] }) {
  const mark = dataStatusFromNode(slot.tone);
  return (
    <button
      type="button"
      className={`hub-slot tone-${slot.tone}`}
      data-hub-slot={slot.role}
      data-hub-slot-tab={slot.subTab ?? ""}
      onClick={() => onOpen(slot.spokeId, slot.subTab)}
    >
      <span className="hub-slot-role">{ROLE_LABEL[slot.role]}</span>
      <span className="hub-slot-figure-row">
        <span className="hub-slot-figure" data-hub-slot-figure>
          {slot.figure}
        </span>
        {mark ? (
          <span className="hub-slot-glyph">
            <StatusGlyph status={mark} />
          </span>
        ) : null}
        <span className="hub-slot-status" data-hub-slot-status>
          {slot.statusWord}
        </span>
      </span>
      <span className="hub-slot-label">{slot.label}</span>
      {slot.chart ? <SlotChart chart={slot.chart} /> : <span className="hub-slot-detail">{slot.detail}</span>}
      {slot.note?.startsWith("Analyst estimate") ? <span className="hub-slot-note">{slot.note}</span> : null}
    </button>
  );
}

export function HubSlots({ feeds, bubbleId, onOpen }: Props) {
  const feed = feeds[bubbleId];
  if (!feed) return null;
  return (
    <section className="hub-slots" aria-label="Bubble signals" data-hub-slots>
      <p className="hub-slot-source" data-hub-slot-source>
        {feed.title}
      </p>
      {feed.slots.map((slot) => (
        <SlotCard key={slot.role} slot={slot} onOpen={onOpen} />
      ))}
    </section>
  );
}
