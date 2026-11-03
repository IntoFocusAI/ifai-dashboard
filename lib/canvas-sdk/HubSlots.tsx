"use client";

import type { MouseEvent, ReactNode } from "react";
import { isHubEvidenceSlot, type HubEvidenceSlot, type HubSlotLine } from "@/lib/canvas-sdk/hub-slot-types";
import type { HubSlot, HubSlotChart, HubSlotFeed, HubSlotRole } from "@/lib/canvas-sdk/types";
import "@/lib/canvas-sdk/hub-slots.css";

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
  const part = "var(--accent-cyan)";
  const rest = "color-mix(in srgb, var(--text-subtle) 55%, transparent)";
  if (chart.part <= 0) return rest;
  if (chart.part >= chart.total) return part;
  return `conic-gradient(${part} 0deg ${share}deg, ${rest} ${share}deg 360deg)`;
}

function chartLabel(chart: HubSlotChart): string {
  const rest = chart.total - chart.part;
  return `${chart.part} ${chart.partLabel}. ${rest} ${chart.restLabel}. Total ${chart.total}.`;
}

function SlotChart({ chart }: { chart: HubSlotChart }) {
  const rest = chart.total - chart.part;
  return (
    <div className="hub-slot-chart">
      <div className="hub-slot-pie" style={{ background: pieStyle(chart) }} role="img" aria-label={chartLabel(chart)} />
      <span>
        {chart.part} {chart.partLabel}
        <br />
        {rest} {chart.restLabel}
      </span>
    </div>
  );
}

/** Reading a definition should not open the evidence. */
function stay(event: MouseEvent) {
  event.stopPropagation();
}

type TermProps = { name: string; definition: string; children: ReactNode; hold?: boolean };

function Term({ name, definition, children, hold }: TermProps) {
  return (
    <span
      className="ifai-term"
      data-ifai-tooltip-title={name}
      data-ifai-tooltip-desc={definition}
      tabIndex={0}
      aria-label={`${name}: ${definition}`}
      onClick={hold ? stay : undefined}
    >
      {children}
    </span>
  );
}

function Line({ line, name, className, data }: { line: HubSlotLine; name: string; className: string; data: string }) {
  const attrs = { [`data-hub-slot-${data}`]: "" };
  if (!line.definition) {
    return (
      <span className={className} {...attrs}>
        {line.text}
      </span>
    );
  }
  const term = line.term && line.text.includes(line.term) ? line.term : line.text;
  const at = line.text.indexOf(term);
  return (
    <span className={className} {...attrs}>
      {line.text.slice(0, at)}
      <Term name={name} definition={line.definition}>
        {term}
      </Term>
      {line.text.slice(at + term.length)}
    </span>
  );
}

function EvidenceCard({ slot, onOpen }: { slot: HubEvidenceSlot; onOpen: Props["onOpen"] }) {
  const open = () => onOpen(slot.spokeId, slot.subTab);
  return (
    <div
      className={`hub-slot hub-evidence-slot tone-${slot.tone}`}
      data-hub-slot={slot.role}
      data-hub-slot-tab={slot.subTab ?? ""}
      onClick={open}
    >
      <span className="hub-evidence-head">
        <span className="hub-slot-role" data-hub-slot-rule={slot.rule}>
          <Term name={slot.roleLabel} definition={slot.rule} hold>
            {slot.roleLabel}
          </Term>
        </span>
        <span className="hub-slot-status" data-hub-slot-status>
          {slot.statusWord}
        </span>
      </span>
      <span className="hub-evidence-hero">
        <span className="hub-slot-figure" data-hub-slot-figure>
          {slot.figureDefinition ? (
            <Term name={slot.label} definition={slot.figureDefinition}>
              {slot.figure}
            </Term>
          ) : (
            slot.figure
          )}
        </span>
        {slot.chart ? (
          <span
            className="hub-slot-pie hub-evidence-pie"
            style={{ background: pieStyle(slot.chart) }}
            role="img"
            aria-label={chartLabel(slot.chart)}
            data-hub-slot-chart
          />
        ) : null}
      </span>
      <span className="hub-slot-label hub-evidence-label">{slot.label}</span>
      <Line line={slot.countedOutOf} name="Counted out of" className="hub-evidence-line" data="count" />
      <Line line={slot.target} name="Target" className="hub-evidence-line hub-evidence-target" data="target" />
      {slot.note ? (
        <Line
          line={{ text: slot.note, term: slot.note.match(/Placeholder[^.]*/)?.[0], definition: slot.noteDefinition }}
          name="Placeholder list"
          className="hub-evidence-note"
          data="note"
        />
      ) : null}
      <Line line={slot.lastChecked} name="Last checked" className="hub-evidence-line hub-evidence-checked" data="checked" />
      <button
        type="button"
        className="hub-evidence-link"
        data-hub-slot-link
        onClick={(event) => {
          event.stopPropagation();
          open();
        }}
      >
        {slot.evidenceLabel}
        <span aria-hidden="true"> ›</span>
      </button>
    </div>
  );
}

function SlotCard({ slot, onOpen }: { slot: HubSlot; onOpen: Props["onOpen"] }) {
  if (isHubEvidenceSlot(slot)) return <EvidenceCard slot={slot} onOpen={onOpen} />;
  return (
    <button
      type="button"
      className={`hub-slot tone-${slot.tone}`}
      data-hub-slot={slot.role}
      data-hub-slot-tab={slot.subTab ?? ""}
      onClick={() => onOpen(slot.spokeId, slot.subTab)}
    >
      <span className="hub-slot-role">{ROLE_LABEL[slot.role]}</span>
      <span className="hub-slot-status" data-hub-slot-status>
        {slot.statusWord}
      </span>
      <span className="hub-slot-figure" data-hub-slot-figure>
        {slot.figure}
      </span>
      <span className="hub-slot-label">{slot.label}</span>
      <span className="hub-slot-detail">{slot.detail}</span>
      {slot.chart ? <SlotChart chart={slot.chart} /> : null}
      {slot.note ? <span className="hub-slot-note">{slot.note}</span> : null}
    </button>
  );
}

export function HubSlots({ feeds, bubbleId, onOpen }: Props) {
  const feed = feeds[bubbleId] ?? feeds.hub;
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
