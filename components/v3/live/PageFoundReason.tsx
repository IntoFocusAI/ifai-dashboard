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
import { storedReasonTooltip } from "@/lib/fender-canvas/page-found-stored-reason";
import { setFindabilityRowFocus, type FindabilityRowLink } from "@/lib/findability/row-focus";

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

/**
 * The listing's Findability result as a link to its row on that tab. The panel's
 * `data-ifai-open` handler switches tabs; the capture click names the row first.
 */
function FindabilityResultLink({
  result,
  link,
}: {
  result: Extract<FindabilityResult, { kind: "outcome" }>;
  link: FindabilityRowLink;
}) {
  const { label, definition } = result;
  const opens = `Opens ${link.asin} on the ${link.tab} tab.`;
  const tooltip = definition
    ? { "data-ifai-tooltip-title": label, "data-ifai-tooltip-desc": `${definition} ${opens}` }
    : {};
  return (
    <button
      type="button"
      {...tooltip}
      className={`page-found-findability-link${definition ? " ifai-term" : ""}`}
      data-ifai-open={link.spokeId}
      data-ifai-tab={link.tab}
      data-page-found-findability-link={link.evidence}
      aria-label={definition ? `${label}: ${definition} ${opens}` : `${label}. ${opens}`}
      onClickCapture={() => setFindabilityRowFocus(link.asin)}
    >
      {label}
    </button>
  );
}

function FindabilityResultText({ result, link }: { result: FindabilityResult; link: FindabilityRowLink | null }) {
  const label = findabilityResultLabel(result);
  if (result.kind === "outcome" && link) return <FindabilityResultLink result={result} link={link} />;
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
        <span className="page-found-reason-line" data-page-found-stored-reason={stored.code}>
          <Term name={stored.label} description={storedReasonTooltip(stored)}>
            {stored.label}
          </Term>
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
          <FindabilityResultText result={findability} link={reason.link} />
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
