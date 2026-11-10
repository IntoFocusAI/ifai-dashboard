"use client";

import { useMemo, useState } from "react";
import { clientColumn, ResizableTable } from "@/components/v3/live/ResizableTable";
import { useClientTableSort } from "@/components/v3/live/useClientTableSort";
import { useAiHistoryOptional } from "@/components/v3/live/ai-search/AiHistoryContext";
import { AiReadGate, EmptyRows, mutedText } from "@/components/v3/live/ai-search/AiReadGate";
import { EngineGroupScope } from "@/components/v3/live/ai-search/EngineGroupScope";
import { AiTerm } from "@/components/v3/live/ai-search/AiTerm";
import { CompetitorWinsHero } from "@/components/v3/live/ai-search/CompetitorWinsHero";
import { EvidenceLink } from "@/components/v3/live/ai-search/EvidenceLink";
import { WhyNotFender } from "@/components/v3/live/ai-search/WhyNotFender";
import { useAiExportScope } from "@/components/v3/live/ai-search/useAiExport";
import { useEvidenceFocus } from "@/components/v3/live/ai-search/useEvidenceFocus";
import { AI_TABS } from "@/lib/ai-search/canvas-surfaces";
import { citationEvidence } from "@/lib/ai-search/citations";
import { competitorTallies, isUnbrandedDiscovery, type CompetitorTally } from "@/lib/ai-search/competitors";
import {
  competitorCategoryLine,
  competitorEngineLine,
  competitorLeadsCell,
} from "@/lib/ai-search/radar-tables";
import { callOutcome, categoryLabel, cleanPrompt, engineLabel, modelLabel } from "@/lib/ai-search/run-metrics";
import { summarizeRun } from "@/lib/ai-search/summary";
import { formatInt } from "@/lib/fender-canvas/format";
import type { SortInput } from "@/lib/fender-canvas/table-sort";
import type { AiSearchSnapshot } from "@/lib/ai-search/types";
import { hasMixedScoringMethods, isWindowHistoryKind } from "@/lib/ai-search/window-display";
import { leadBrand } from "@/lib/brand-copy";

const COLUMNS = [
  clientColumn("competitor", "Competitor", "text", 160, 110),
  clientColumn("leads", "Leads", "number", 140, 100),
  clientColumn("categories", "Categories", "text", 280, 140),
  clientColumn("engines", "Engines", "text", 240, 120),
];

/** Categories takes the panel's spare width; both long lists wrap so the table never scrolls sideways. */
const FILL_COLUMN = "categories";
const WRAP_COLUMNS = ["engines"];

function tallySortValue(row: CompetitorTally, columnId: string): SortInput {
  if (columnId === "competitor") return row.brand;
  if (columnId === "leads") return row.wins;
  if (columnId === "categories") return competitorCategoryLine(row) || null;
  return competitorEngineLine(row) || null;
}

const tallyKey = (row: CompetitorTally) => row.brand;

function Wins({ snapshot }: { snapshot: AiSearchSnapshot }) {
  const history = useAiHistoryOptional();
  const windowed = isWindowHistoryKind(history?.mode.kind);
  const mixed = hasMixedScoringMethods(snapshot);
  const focus = useEvidenceFocus();
  const [brand, setBrand] = useState(focus?.field === "competitor" ? focus.value : "");

  const [appliedFocus, setAppliedFocus] = useState(focus);
  if (focus !== appliedFocus) {
    setAppliedFocus(focus);
    if (focus?.field === "competitor") setBrand(focus.value);
    if (focus?.field === "outcome" && focus.value === "competitor_win") setBrand("");
  }

  const tallies = competitorTallies(snapshot.calls);
  const sorted = useClientTableSort(tallies, COLUMNS, tallySortValue, tallyKey);
  const exportScope = useAiExportScope();
  const losses = useMemo(
    () =>
      snapshot.calls
        .filter((row) => isUnbrandedDiscovery(row) && callOutcome(row) === "competitor_win")
        .sort((a, b) => (a.category ?? "").localeCompare(b.category ?? "") || a.sim_id - b.sim_id),
    [snapshot.calls],
  );
  const cited = useMemo(
    () => citationEvidence(snapshot.calls, snapshot.citations, "commercial").rows,
    [snapshot],
  );
  const shown = brand ? losses.filter((row) => row.primary_brand === brand) : losses;
  const emptyUnit = windowed ? "selection" : "run";
  const competitorWins = summarizeRun(snapshot).competitorWins;

  return (
    <>
      <CompetitorWinsHero snapshot={snapshot} mixed={mixed} />

      {competitorWins === 0 ? (
        <div className="content-box" style={{ marginTop: 12 }}>
          <EmptyRows>
            No competitor was named most in a resolved <AiTerm term="unbranded discovery">unbranded discovery</AiTerm>{" "}
            answer in this {emptyUnit}.
          </EmptyRows>
        </div>
      ) : (
        <>
          <div className="content-box ai-competitor-tallies" style={{ marginTop: 12 }}>
            <div className="content-box-title">Competitors named more than {leadBrand()}</div>
            <ResizableTable
              tableId="competitor-wins"
              columns={COLUMNS}
              fillColumnId={FILL_COLUMN}
              wrapColumnIds={WRAP_COLUMNS}
              exportScope={exportScope}
              freezeHeader
              maxHeight={520}
              sort={sorted.sort}
              onSort={sorted.onSort}
            >
              <tbody>
                {sorted.rows.map((t) => (
                  <tr key={t.brand} data-competitor={t.brand}>
                    <td>
                      <button
                        type="button"
                        className={`segmented-btn${brand === t.brand ? " active" : ""}`}
                        aria-pressed={brand === t.brand}
                        onClick={() => setBrand(brand === t.brand ? "" : t.brand)}
                      >
                        {t.brand}
                      </button>
                    </td>
                    <td>{competitorLeadsCell(t)}</td>
                    <td>{competitorCategoryLine(t)}</td>
                    <td>{competitorEngineLine(t)}</td>
                  </tr>
                ))}
              </tbody>
            </ResizableTable>
            <p style={mutedText}>
              Each lead is a win of that many resolved <AiTerm term="unbranded discovery">unbranded discovery</AiTerm>{" "}
              answers. Branded consideration is not in this rate.
            </p>
          </div>

          <div className="content-box ai-competitor-answers" style={{ marginTop: 12 }}>
            <div className="content-box-title">
              <span>{brand ? `Answers where ${brand} led` : "Every answer a competitor led"}</span>
              <span className="tag-badge tag-neutral">{formatInt(shown.length)} answers</span>
            </div>
            {shown.map((row) => (
              <div key={row.id} className="action-card" data-sim-id={row.sim_id} style={{ marginTop: 6 }}>
                <div className="action-head">
                  <EvidenceLink focus={{ field: "sim", value: row.id }} tab={AI_TABS.simulations}>
                    {cleanPrompt(row.prompt)}
                  </EvidenceLink>
                </div>
                <div className="action-details" style={{ fontSize: 12 }}>
                  {categoryLabel(row.category)} · {engineLabel(row.engine)} · {modelLabel(row.model)}
                </div>
                <WhyNotFender row={row} pages={cited.filter((citation) => citation.simulationId === row.id)} />
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

export function CompetitorWinsPanel() {
  return (
    <EngineGroupScope>
      <AiReadGate>{(snapshot) => <Wins snapshot={snapshot} />}</AiReadGate>
    </EngineGroupScope>
  );
}
