"use client";

import { formatInt } from "@/lib/fender-canvas/format";
import {
  FINDABILITY_SOURCE,
  FINDABILITY_UNAVAILABLE,
  FINDABILITY_UNAVAILABLE_TIP,
  findabilityResultLabel,
  type FindabilityResult,
  type NotFoundReason,
  type ReasonGroup,
} from "@/lib/fender-canvas/page-found-reasons";

export const ALL_REASONS = "all";

function Term({ name, description, children }: { name: string; description: string; children: string }) {
  return (
    <span
      className="ifai-term"
      data-ifai-tooltip-title={name}
      data-ifai-tooltip-desc={description}
      tabIndex={0}
      aria-label={`${name}: ${description}`}
    >
      {children}
    </span>
  );
}

function FindabilityResultText({ result }: { result: FindabilityResult }) {
  const label = findabilityResultLabel(result);
  if (result.kind === "outcome" && result.definition) {
    return (
      <Term name={label} description={result.definition}>
        {label}
      </Term>
    );
  }
  if (result.kind === "unavailable") {
    return (
      <Term name={FINDABILITY_UNAVAILABLE} description={FINDABILITY_UNAVAILABLE_TIP}>
        {label}
      </Term>
    );
  }
  return <>{label}</>;
}

/** A not-found row: the stored spec-check reason first, then the listing's Findability result. */
export function NotFoundReasonCell({ reason }: { reason: NotFoundReason }) {
  const { stored, findability } = reason;
  const showFindability = findability.kind !== "no_row" || !stored;
  return (
    <span className="page-found-reason" data-page-found-reason={reason.group}>
      {stored ? (
        <span className="page-found-reason-line" data-page-found-stored-reason="">
          {stored}
        </span>
      ) : null}
      {showFindability ? (
        <span
          className="page-found-reason-line"
          data-page-found-findability={findability.kind === "outcome" ? findability.bucket : findability.kind}
        >
          {findability.kind === "outcome" || findability.kind === "unavailable" ? (
            <span className="page-found-reason-source">{FINDABILITY_SOURCE}:</span>
          ) : null}
          <FindabilityResultText result={findability} />
        </span>
      ) : null}
    </span>
  );
}

/** Groups the not-found rows by the first reason each one shows. */
export function ReasonFilter({
  groups,
  total,
  value,
  onChange,
}: {
  groups: readonly ReasonGroup[];
  total: number;
  value: string;
  onChange: (next: string) => void;
}) {
  const options: Array<[string, string, number]> = [
    [ALL_REASONS, "All reasons", total],
    ...groups.map((group): [string, string, number] => [group.key, group.key, group.count]),
  ];
  return (
    <div className="page-found-filters page-found-reason-filters">
      <div className="segmented-control" role="group" aria-label="Reason">
        {options.map(([key, label, count]) => (
          <button
            key={key}
            type="button"
            className={`segmented-btn${value === key ? " active" : ""}`}
            aria-pressed={value === key}
            data-page-found-reason-filter={key}
            data-page-found-reason-filter-count={count}
            onClick={() => onChange(key)}
          >
            {label} {formatInt(count)}
          </button>
        ))}
      </div>
    </div>
  );
}
