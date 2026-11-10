"use client";

import { Fragment, useMemo, useState } from "react";
import { clientColumn, ResizableTable } from "@/components/v3/live/ResizableTable";
import { useClientTableSort } from "@/components/v3/live/useClientTableSort";
import { useAiHistoryOptional } from "@/components/v3/live/ai-search/AiHistoryContext";
import { AiReadGate, EmptyRows, mutedText } from "@/components/v3/live/ai-search/AiReadGate";
import { EngineGroupScope } from "@/components/v3/live/ai-search/EngineGroupScope";
import { AiStatusTag, tagToneOf } from "@/components/v3/live/ai-search/AiStatusTag";
import { AiTerm } from "@/components/v3/live/ai-search/AiTerm";
import { RunDetailsLead } from "@/components/v3/live/ai-search/RunDetailsLead";
import { SimulationEvidenceDrawer } from "@/components/v3/live/ai-search/SimulationEvidenceDrawer";
import { SimulationFilters } from "@/components/v3/live/ai-search/SimulationFilters";
import { useAiExportScope } from "@/components/v3/live/ai-search/useAiExport";
import { useEvidenceFocus } from "@/components/v3/live/ai-search/useEvidenceFocus";
import { citationEvidence, type CitationEvidence } from "@/lib/ai-search/citations";
import { driftRead } from "@/lib/ai-search/drift";
import { ENGINE_GROUP_LABELS, engineGroup } from "@/lib/ai-search/engine-group";
import { explorerFilterFor } from "@/lib/ai-search/evidence-filter";
import { setEvidenceFocus } from "@/lib/ai-search/evidence-focus";
import {
  applyExplorerFilter,
  factCheckColumnLabel,
  sortExplorerRows,
  type ExplorerFilter,
} from "@/lib/ai-search/explorer-filter";
import { questionRole, ROLE_LABELS } from "@/lib/ai-search/question-role";
import {
  callOutcome,
  categoryLabel,
  cleanPrompt,
  engineLabel,
  formatRunTime,
  modelLabel,
  OUTCOME_LABELS,
  type CallOutcome,
} from "@/lib/ai-search/run-metrics";
import type { AiCallRow, AiSearchSnapshot } from "@/lib/ai-search/types";
import { isWindowHistoryKind } from "@/lib/ai-search/window-display";
import type { SortInput } from "@/lib/fender-canvas/table-sort";
import { brandName, leadBrand } from "@/lib/brand-copy";

const SIM_COLUMNS = [
  clientColumn("prompt", "Prompt", "text", 280, 160),
  clientColumn("outcome", "Outcome", "text", 220, 140),
  clientColumn("engine", "Engine", "text", 120, 90),
  clientColumn("model", "Model", "text", 150, 100),
  clientColumn("category", "Category", "text", 160, 110),
  clientColumn("fact", "Fact check", "text", 180, 120),
  clientColumn("cited", "Cited links", "number", 110, 90),
  clientColumn("checked", "Checked", "date", 180, 130),
];

function simulationSortValue(row: AiCallRow, columnId: string, cited: number): SortInput {
  const outcome = callOutcome(row);
  if (columnId === "prompt") return cleanPrompt(row.prompt).trim() || null;
  if (columnId === "outcome") {
    return outcome === "competitor_win" && row.primary_brand
      ? `${row.primary_brand} named most`
      : OUTCOME_LABELS[outcome];
  }
  if (columnId === "engine") return engineLabel(row.engine);
  if (columnId === "model") return modelLabel(row.model);
  if (columnId === "category") {
    return row.prompt_kind === "probe" ? "Product fact check" : categoryLabel(row.category);
  }
  if (columnId === "fact") return factCheckColumnLabel(row);
  if (columnId === "cited") return cited;
  return row.created_at;
}

const callKey = (row: AiCallRow) => row.id;

const OUTCOME_TONE: Record<CallOutcome, string> = {
  fender_win: "tag-success",
  fender_win_disqualified: "tag-danger",
  competitor_win: "tag-danger",
  unresolved: "tag-neutral",
  error: "tag-warning",
  probe: "tag-neutral",
  unsupported: "tag-neutral",
};

function Explorer({ snapshot }: { snapshot: AiSearchSnapshot }) {
  const history = useAiHistoryOptional();
  const unit = isWindowHistoryKind(history?.mode.kind) ? "selection" : "run";
  const focus = useEvidenceFocus();
  const [filter, setFilter] = useState<ExplorerFilter>(() => explorerFilterFor(focus));
  const openFromFilter = (next: ExplorerFilter): string | null => {
    if (next.callId != null) {
      return snapshot.calls.some((call) => call.id === next.callId) ? next.callId : null;
    }
    if (next.simId != null) {
      return snapshot.calls.find((call) => call.sim_id === next.simId)?.id ?? null;
    }
    return null;
  };

  const [openId, setOpenId] = useState<string | null>(() => openFromFilter(explorerFilterFor(focus)));

  const [appliedFocus, setAppliedFocus] = useState(focus);
  if (focus !== appliedFocus) {
    setAppliedFocus(focus);
    if (focus) {
      const next = explorerFilterFor(focus);
      setFilter(next);
      setOpenId(openFromFilter(next));
    }
  }

  const citations = useMemo(() => {
    const byCall = new Map<string, CitationEvidence[]>();
    for (const row of citationEvidence(snapshot.calls, snapshot.citations, "all").rows) {
      byCall.set(row.simulationId, [...(byCall.get(row.simulationId) ?? []), row]);
    }
    return byCall;
  }, [snapshot]);

  const drift = useMemo(() => driftRead(snapshot.calls, snapshot.probes), [snapshot]);

  const rows = useMemo(
    () => sortExplorerRows(applyExplorerFilter(snapshot.calls, filter)),
    [snapshot.calls, filter],
  );
  const sorted = useClientTableSort(
    rows,
    SIM_COLUMNS,
    (row, columnId) => simulationSortValue(row, columnId, citations.get(row.id)?.length ?? 0),
    callKey,
  );
  const exportScope = useAiExportScope({ filter });

  const changeFilter = (next: ExplorerFilter) => {
    setOpenId(null);
    setFilter(next);
    if (focus) setEvidenceFocus(null);
  };

  return (
    <div className="content-box ai-simulations">
      <RunDetailsLead snapshot={snapshot} />
      <p className="ai-lead-explainer" style={mutedText}>
        Shopping prompts are buying questions, scored by which brand the answer names most. A{" "}
        <AiTerm term="product fact check">product fact check</AiTerm> tests one published {brandName()} fact instead.
      </p>
      <SimulationFilters rows={snapshot.calls} filter={filter} onChange={changeFilter} />
      {filter.role ? (
        <p style={mutedText} data-ai-role-filter={filter.role}>
          Showing {ROLE_LABELS[filter.role]}
          {filter.outcome === "resolved" ? " with a clear leader" : filter.outcome === "fender_win" ? ` where ${leadBrand()} was named most` : ""}.
        </p>
      ) : null}
      {filter.brand ? (
        <p style={mutedText}>
          Showing answers where {filter.brand} was named most.{" "}
          <button type="button" className="segmented-btn" onClick={() => changeFilter({ ...filter, brand: "" })}>
            Clear brand
          </button>
        </p>
      ) : null}
      {rows.length === 0 ? <EmptyRows>No call in this {unit} matches these filters.</EmptyRows> : null}
      {rows.length ? (
        <div id="ai-simulation-list">
          <ResizableTable
            tableId="ai-simulations"
            columns={SIM_COLUMNS}
            freezeHeader
            maxHeight={520}
            sort={sorted.sort}
            onSort={sorted.onSort}
            exportScope={exportScope}
          >
            <tbody>
              {sorted.rows.map((row) => {
                const outcome = callOutcome(row);
                const open = openId === row.id;
                const cited = citations.get(row.id) ?? [];
                const outcomeLabel =
                  outcome === "competitor_win" && row.primary_brand
                    ? `${row.primary_brand} named most`
                    : OUTCOME_LABELS[outcome];
                return (
                  <Fragment key={row.id}>
                    <tr
                      className="ai-sim-row"
                      data-sim-id={row.sim_id}
                      data-outcome={outcome}
                      data-kind={row.prompt_kind ?? ""}
                      data-role={questionRole(row)}
                      aria-expanded={open}
                      tabIndex={0}
                      onClick={() => setOpenId(open ? null : row.id)}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter" && event.key !== " ") return;
                        event.preventDefault();
                        setOpenId(open ? null : row.id);
                      }}
                    >
                      <td>
                        <span data-ai-prompt>{cleanPrompt(row.prompt)}</span>
                      </td>
                      <td>
                        <AiStatusTag tone={tagToneOf(OUTCOME_TONE[outcome])}>{outcomeLabel}</AiStatusTag>
                      </td>
                      <td data-engine-group={engineGroup(row.engine)}>
                        {engineLabel(row.engine)}
                        {snapshot.engineScope ? (
                          <span className="ai-engine-group-tag">{ENGINE_GROUP_LABELS[engineGroup(row.engine)]}</span>
                        ) : null}
                      </td>
                      <td>{modelLabel(row.model)}</td>
                      <td>{row.prompt_kind === "probe" ? "Product fact check" : categoryLabel(row.category)}</td>
                      <td>{factCheckColumnLabel(row)}</td>
                      <td>{cited.length} cited links</td>
                      <td>{formatRunTime(row.created_at)}</td>
                    </tr>
                    {open ? (
                      <tr>
                        <td colSpan={SIM_COLUMNS.length}>
                          <SimulationEvidenceDrawer
                            row={row}
                            probe={
                              drift.probes.find(
                                (p) => p.auditRunId === row.audit_run_id && p.simId === row.sim_id,
                              ) ?? null
                            }
                            citations={cited}
                            questionsSent={drift.coverage.questionsSent}
                            onClose={() => setOpenId(null)}
                          />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </ResizableTable>
        </div>
      ) : null}
    </div>
  );
}

export function SimulationsExplorer() {
  return (
    <EngineGroupScope>
      <AiReadGate>{(snapshot) => <Explorer snapshot={snapshot} />}</AiReadGate>
    </EngineGroupScope>
  );
}
