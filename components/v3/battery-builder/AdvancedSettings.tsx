"use client";

import { useState, type ReactNode } from "react";
import { ChevronRight, Plus } from "lucide-react";
import type { DesignMode } from "@/lib/battery-builder/generate";
import { SLOTS, SLOT_EXAMPLES, SLOT_LABELS, type Slot } from "@/lib/battery-builder/render";

type Props = {
  /** Question style rows, rendered by the page. */
  styleRows: ReactNode;
  mode: DesignMode;
  onMode: (mode: DesignMode) => void;
  item: string;
  onItem: (item: string) => void;
  personaNoun: string;
  onPersonaNoun: (noun: string) => void;
  onAddDetail: (label: string, slot: Slot) => void;
};

export function AdvancedSettings({ styleRows, mode, onMode, item, onItem, personaNoun, onPersonaNoun, onAddDetail }: Props) {
  const [label, setLabel] = useState("");
  const [slot, setSlot] = useState<Slot>("clause");

  function add() {
    if (!label.trim()) return;
    onAddDetail(label.trim(), slot);
    setLabel("");
  }

  return (
    <details className="bb-advanced">
      <summary>
        <ChevronRight size={14} aria-hidden className="bb-advanced-chevron" /> Advanced: question style, mode, new details
      </summary>
      <div className="bb-advanced-body">
        <ul className="bb-details">{styleRows}</ul>
        <p className="bb-hint">
          In a question style, {"{request}"} becomes the product with its details, such as “electric guitar under $1,000 for an
          intermediate player”. {"{a_request}"} adds “a” or “an” in front.
        </p>

        <fieldset className="bb-mode">
          <legend>Questions to make</legend>
          <label>
            <input type="radio" checked={mode === "one_at_a_time"} onChange={() => onMode("one_at_a_time")} />
            One detail at a time
          </label>
          <label>
            <input type="radio" checked={mode === "combination"} onChange={() => onMode("combination")} />
            Every combination
          </label>
        </fieldset>

        <div className="bb-row">
          <label className="bb-field">
            <span>Product</span>
            <input value={item} onChange={(e) => onItem(e.target.value)} />
          </label>
          <label className="bb-field">
            <span>Shopper word</span>
            <input value={personaNoun} onChange={(e) => onPersonaNoun(e.target.value)} />
          </label>
        </div>

        <div className="bb-field">
          <span>New shopper detail</span>
          <div className="bb-add-detail">
            <input placeholder="e.g. Pickups" value={label} onChange={(e) => setLabel(e.target.value)} aria-label="Detail name" />
            <select value={slot} onChange={(e) => setSlot(e.target.value as Slot)} aria-label="Where it goes in the question">
              {SLOTS.filter((s) => s !== "frame").map((s) => (
                <option key={s} value={s}>
                  {SLOT_LABELS[s]} ({SLOT_EXAMPLES[s]})
                </option>
              ))}
            </select>
            <button type="button" className="bb-btn" onClick={add} disabled={!label.trim()}>
              <Plus size={14} aria-hidden /> Add
            </button>
          </div>
        </div>
      </div>
    </details>
  );
}
