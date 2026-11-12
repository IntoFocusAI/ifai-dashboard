"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import type { BuilderVariable } from "@/lib/battery-builder/generate";

/** A shopper detail as the page edits it. `addedValues` are the ones typed here, which can be removed again. */
export type Detail = BuilderVariable & { addedValues: string[]; custom: boolean };

type Props = {
  detail: Detail;
  /** Value in the starting question; "" leaves the detail out. */
  picked: string;
  tried: boolean;
  /** How a value reads on its chip. */
  valueLabel?: (value: string) => string;
  onPick: (value: string) => void;
  onToggleTry: () => void;
  onAddValue: (value: string) => void;
  onRemoveValue: (value: string) => void;
  onRemoveDetail: () => void;
};

export function DetailRow({ detail, picked, tried, valueLabel, onPick, onToggleTry, onAddValue, onRemoveValue, onRemoveDetail }: Props) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const show = valueLabel ?? ((v: string) => v);

  function commit() {
    const value = draft.trim();
    if (value) onAddValue(value);
    setDraft("");
    setAdding(false);
  }

  return (
    <li className={`bb-detail${tried ? " is-tried" : ""}`}>
      <div className="bb-detail-head">
        <span className="bb-detail-name">{detail.label}</span>
        <label className="bb-try">
          <input type="checkbox" checked={tried} onChange={onToggleTry} />
          <span>Try each</span>
        </label>
        {detail.custom ? (
          <button type="button" className="bb-icon-btn" onClick={onRemoveDetail} aria-label={`Remove ${detail.label}`} title="Remove this detail">
            <X size={14} />
          </button>
        ) : null}
      </div>
      <div className="bb-chips" role="group" aria-label={`${detail.label} values`}>
        {detail.values.map((value) => {
          const on = picked === value;
          return (
            <span key={value} className={`bb-pick-wrap${on ? " is-on" : ""}`}>
              <button type="button" className="bb-pick" aria-pressed={on} onClick={() => onPick(on ? "" : value)}>
                {show(value)}
              </button>
              {detail.addedValues.includes(value) ? (
                <button type="button" className="bb-pick-x" onClick={() => onRemoveValue(value)} aria-label={`Remove ${value}`}>
                  <X size={11} />
                </button>
              ) : null}
            </span>
          );
        })}
        {adding ? (
          <input
            autoFocus
            className="bb-pick-input"
            value={draft}
            placeholder="Type a value, then Enter"
            aria-label={`New ${detail.label} value`}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              } else if (e.key === "Escape") {
                setDraft("");
                setAdding(false);
              }
            }}
          />
        ) : (
          <button type="button" className="bb-pick bb-pick-add" onClick={() => setAdding(true)}>
            <Plus size={12} aria-hidden /> Add
          </button>
        )}
      </div>
    </li>
  );
}
