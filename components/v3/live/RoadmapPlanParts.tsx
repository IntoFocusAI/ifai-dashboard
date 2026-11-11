"use client";

import "@/components/v3/live/roadmap-plan.css";
import { DefinedCopy } from "@/components/v3/live/DefinedTerm";
import { PartialFigureMark } from "@/components/v3/live/FigureTip";
import { StatusMark } from "@/components/v3/live/StatusMark";
import { ExternalLink } from "@/components/v3/live/ai-search/ExternalLink";
import { formatEvidence, setEvidenceFocus, type EvidenceFocus } from "@/lib/ai-search/evidence-focus";
import { dataStatusColor, dataStatusFromNode } from "@/lib/canvas-sdk/data-status";
import { BRIEFING_LOADING } from "@/lib/fender-canvas/briefing-retail-lead";
import type { PlanItem } from "@/lib/fender-canvas/roadmap-plan";

/** Cited pages listed under a source action (21e). */
const PAGE_LIMIT = 10;

/** The figure in its status color for a finding, plain for an action, then N of M. */
export function PlanFigure({ item }: { item: PlanItem }) {
  const status = item.ratio ? dataStatusFromNode(item.tone) : null;
  return (
    <span>
      <span
        className="plan-cell-figure"
        data-fix-percent=""
        style={{
          whiteSpace: "nowrap",
          color: status ? dataStatusColor(status) : item.ratio ? "var(--text-main)" : "var(--text-muted)",
        }}
      >
        <PartialFigureMark partial={item.partial} testId={`plan-${item.id}`}>
          {item.loading ? BRIEFING_LOADING : item.percent}
        </PartialFigureMark>
      </span>
      {item.ratio ? (
        <span className="plan-cell-ratio" data-fix-ratio="">
          {item.ratio}
        </span>
      ) : null}
    </span>
  );
}

/** StatusMark with the fix list's word for a graded finding; the plain word otherwise. */
export function PlanStatus({ item }: { item: PlanItem }) {
  const status = item.ratio && !item.loading ? dataStatusFromNode(item.tone) : null;
  return (
    <span data-fix-status-label="" data-fix-status-word={item.statusLabel}>
      {status ? <StatusMark status={status} word={item.statusLabel} /> : <span className="plan-cell-sub">{item.statusLabel}</span>}
    </span>
  );
}

/** The stored fact, then the action (21e). A finding's figure column already states its fact. */
export function PlanAction({ item }: { item: PlanItem }) {
  return (
    <>
      {item.kind !== "finding" ? (
        <p className="plan-fact" data-plan-fact="">
          {item.fact}
        </p>
      ) : null}
      <p className="plan-action" data-fix-action="">
        <DefinedCopy text={item.action} />
      </p>
    </>
  );
}

/** Opens the evidence tab; a source action also lists the pages the answers cite. */
export function PlanEvidence({ item }: { item: PlanItem }) {
  // A source action opens Citation Ecosystem on that site's rows, as the tab's own links do.
  const focus: EvidenceFocus | null = item.kind === "source" ? { field: "domain", value: item.label } : null;
  return (
    <span>
      <button
        type="button"
        className="plan-open"
        data-ifai-open={item.open.spokeId}
        data-ifai-tab={item.open.tab}
        data-ifai-evidence={focus ? formatEvidence(focus) : undefined}
        onClickCapture={focus ? () => setEvidenceFocus(focus) : undefined}
        data-fix-open=""
      >
        Open {item.open.tab} →
      </button>
      {item.pages.length ? (
        <details className="plan-pages" data-plan-pages="">
          <summary>
            {item.pages.length} cited page{item.pages.length === 1 ? "" : "s"}
          </summary>
          <ul>
            {item.pages.slice(0, PAGE_LIMIT).map((page) => (
              <li key={page.url}>
                <ExternalLink href={page.url}>{page.title ?? page.url}</ExternalLink>
                <span className="plan-cell-sub">
                  {" "}
                  {page.answers} answer{page.answers === 1 ? "" : "s"}
                </span>
              </li>
            ))}
            {item.pages.length > PAGE_LIMIT ? (
              <li className="plan-cell-sub">
                {item.pages.length - PAGE_LIMIT} more on the {item.open.tab} tab
              </li>
            ) : null}
          </ul>
        </details>
      ) : null}
    </span>
  );
}
