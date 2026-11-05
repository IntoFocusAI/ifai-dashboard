"use client";

import { useMemo, useState, type ReactNode } from "react";
import { FindabilityLead } from "@/components/v3/live/findability/FindabilityLead";
import { FindabilityTable } from "@/components/v3/live/findability/FindabilityTable";
import { useFindability } from "@/components/v3/live/findability/FindabilityContext";
import { useFindabilityRowLanding } from "@/components/v3/live/findability/useFindabilityRowLanding";
import {
  DEALER_BUNDLE_NOTE,
  FAMILY_IS_NOT_EXACT,
  MACHINE_READABILITY_POINTER,
  OUTCOME_DEFINITION,
  OUTCOME_LABEL,
  bucketLabel,
} from "@/lib/findability/copy";
import { formatInt } from "@/lib/fender-canvas/format";
import {
  FINDABILITY_OUTCOMES,
  countFindability,
  findabilityShape,
  rowsForOutcome,
  type FindabilityBucket,
} from "@/lib/findability/outcomes";

function Term({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <span
      className="ifai-term"
      data-ifai-tooltip-title={title}
      data-ifai-tooltip-desc={description}
      tabIndex={0}
      aria-label={`${title}: ${description}`}
    >
      {children}
    </span>
  );
}

function OutcomeChevron() {
  return (
    <svg
      className="retail-explore-chevron"
      viewBox="0 0 12 12"
      width="12"
      height="12"
      aria-hidden="true"
    >
      <path
        d="M2.2 4.2 6 8l3.8-3.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function OutcomeCount({
  outcome,
  count,
  label,
  description,
  selected,
  onSelect,
}: {
  outcome: FindabilityBucket;
  count: number;
  label: string;
  description?: string;
  selected: boolean;
  onSelect: (outcome: FindabilityBucket) => void;
}) {
  return (
    <div className="metric-card-sm findability-outcome" data-selected={selected ? "true" : "false"} data-findability-outcome={outcome}>
      <span className="metric-card-label">
        {description ? (
          <Term title={label} description={description}>
            {label}
          </Term>
        ) : (
          label
        )}
      </span>
      <button
        type="button"
        className="findability-count"
        aria-pressed={selected}
        aria-expanded={selected}
        data-findability-count={count}
        aria-label={description ? `${formatInt(count)} ${label}. ${description}` : undefined}
        onClick={() => onSelect(outcome)}
      >
        <span className="findability-count-value">{formatInt(count)}</span>
        <OutcomeChevron />
      </button>
    </div>
  );
}

export function FindabilityPanel() {
  const read = useFindability();
  const [selected, setSelected] = useState<FindabilityBucket | null>("exact_official_product");
  const { landAsin, clearLanding } = useFindabilityRowLanding(read, setSelected);

  const counts = useMemo(
    () => (read.phase === "ready" ? countFindability(read.rows) : null),
    [read],
  );
  const filtered = useMemo(() => {
    if (read.phase !== "ready" || !selected) return [];
    return rowsForOutcome(read.rows, selected);
  }, [read, selected]);

  if (read.phase === "loading") {
    return (
      <div className="findability-panel">
        <p className="findability-note">Reading official pages…</p>
      </div>
    );
  }
  if (read.phase === "error") {
    return (
      <div className="findability-panel">
        <p className="findability-note">The official-page read did not load.</p>
      </div>
    );
  }

  const shape = findabilityShape(counts!);

  const choose = (outcome: FindabilityBucket) => {
    clearLanding();
    setSelected((current) => (current === outcome ? null : outcome));
  };

  return (
    <div className="findability-panel" data-findability-shape={shape} data-findability-total={counts!.total}>
      <FindabilityLead counts={counts!} rows={read.rows} />
      <p className="findability-note" style={{ marginTop: 12 }}>
        Each listing is one outcome. {FAMILY_IS_NOT_EXACT} Open a count to see the listings, titles,
        and official pages behind it.
      </p>
      <div className="findability-outcomes">
        {FINDABILITY_OUTCOMES.map((outcome) => (
          <OutcomeCount
            key={outcome}
            outcome={outcome}
            count={counts![outcome]}
            label={OUTCOME_LABEL[outcome]}
            description={OUTCOME_DEFINITION[outcome]}
            selected={selected === outcome}
            onSelect={choose}
          />
        ))}
        {counts!.other > 0 ? (
          <OutcomeCount
            outcome="other"
            count={counts!.other}
            label={bucketLabel("other")}
            selected={selected === "other"}
            onSelect={choose}
          />
        ) : null}
      </div>
      {shape === "partial" ? (
        <p className="findability-note">Some outcomes are zero in this read. A zero is a real count.</p>
      ) : null}
      <p className="findability-note">{MACHINE_READABILITY_POINTER}</p>
      {selected ? (
        <div className="content-box" style={{ marginTop: 4 }}>
          <div className="content-box-title">
            <span>{bucketLabel(selected)}</span>
            <span className="tag-badge tag-neutral">{formatInt(filtered.length)} listings</span>
          </div>
          <p className="findability-note">
            {read.dealerBundleLoaded ? DEALER_BUNDLE_NOTE : "Dealer bundle status did not load with this read."}
          </p>
          <FindabilityTable key={selected} outcome={selected} rows={filtered} landAsin={landAsin} />
        </div>
      ) : null}
    </div>
  );
}
