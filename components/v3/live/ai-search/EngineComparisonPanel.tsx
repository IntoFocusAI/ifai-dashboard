"use client";

import { clientColumn, ResizableTable, type RetailColumn } from "@/components/v3/live/ResizableTable";
import { useClientTableSort } from "@/components/v3/live/useClientTableSort";
import { useAiHistoryOptional } from "@/components/v3/live/ai-search/AiHistoryContext";
import { AiReadGate } from "@/components/v3/live/ai-search/AiReadGate";
import { EngineGroupScope } from "@/components/v3/live/ai-search/EngineGroupScope";
import { AiTerm } from "@/components/v3/live/ai-search/AiTerm";
import { EngineCategoryGrid } from "@/components/v3/live/ai-search/EngineCategoryGrid";
import { EngineComparisonLead } from "@/components/v3/live/ai-search/EngineComparisonLead";
import { EngineUnbrandedGraph } from "@/components/v3/live/ai-search/EngineUnbrandedGraph";
import { EvidenceLink } from "@/components/v3/live/ai-search/EvidenceLink";
import { RoleCount, largestResolved, roleColumn, roleRateSort } from "@/components/v3/live/ai-search/RoleRateTable";
import { useAiExportScope } from "@/components/v3/live/ai-search/useAiExport";
import { AI_TABS } from "@/lib/ai-search/canvas-surfaces";
import { engineGroup } from "@/lib/ai-search/engine-group";
import { engineResultRoleTallies, headlineAside, type RoleGroupTally } from "@/lib/ai-search/question-role";
import { competitorLeadsLine, engineCompetitorLeads } from "@/lib/ai-search/radar-tables";
import { engineLabel } from "@/lib/ai-search/run-metrics";
import type { SortInput } from "@/lib/fender-canvas/table-sort";
import type { AiCallRow, AiSearchSnapshot } from "@/lib/ai-search/types";
import { hasMixedScoringMethods, isWindowHistoryKind } from "@/lib/ai-search/window-display";
import { formatInt } from "@/lib/fender-canvas/format";

/** One competitor column that wraps, so any number of rival brands fits the panel. */
const ENGINE_COLUMNS: RetailColumn[] = [
  clientColumn("engine", "Engine", "text", 130, 100),
  roleColumn("unbranded_discovery", 170),
  roleColumn("branded_consideration", 170),
  {
    ...clientColumn("competitors", "Competitor leads", "number", 220, 140),
    headerTooltip: {
      title: "Competitor leads",
      description:
        "Each other brand this engine named most in a resolved unbranded discovery answer, with how many it led, most first. Sorting uses the total.",
    },
  },
  clientColumn("unresolved", "No leader", "number", 110, 80),
  clientColumn("errors", "Errors", "number", 90, 72),
];

/** The engine cell carries its model list, and the rates may carry a Small sample mark: all three may wrap. */
const ENGINE_WRAPS = ["engine", "unbranded_discovery", "branded_consideration"];

const engineKey = (row: RoleGroupTally) => row.key;


function engineSortValue(
  row: RoleGroupTally,
  columnId: string,
  rows: AiCallRow[],
  largest: { unbranded: number; branded: number },
): SortInput {
  if (columnId === "engine") return engineLabel(row.key);
  if (columnId === "unbranded_discovery") return roleRateSort(row.roles.unbranded_discovery, largest.unbranded);
  if (columnId === "branded_consideration") return roleRateSort(row.roles.branded_consideration, largest.branded);
  if (columnId === "unresolved") return headlineAside(row).unresolved;
  if (columnId === "errors") return headlineAside(row).errors;
  if (columnId === "competitors") return engineCompetitorLeads(rows, row.key).reduce((sum, lead) => sum + lead.wins, 0);
  return null;
}

function Comparison({ snapshot }: { snapshot: AiSearchSnapshot }) {
  const history = useAiHistoryOptional();
  const showSmallSample = !isWindowHistoryKind(history?.mode.kind);
  const mixed = hasMixedScoringMethods(snapshot);
  const engines = engineResultRoleTallies(snapshot.calls);
  const largest = {
    unbranded: largestResolved(engines, "unbranded_discovery"),
    branded: largestResolved(engines, "branded_consideration"),
  };
  const sortedEngines = useClientTableSort(
    engines,
    ENGINE_COLUMNS,
    (row, columnId) => engineSortValue(row, columnId, snapshot.calls, largest),
    engineKey,
  );
  const exportScope = useAiExportScope();

  return (
    <>
      <div className="content-box ai-engine-comparison ai-role-rates">
        <EngineComparisonLead engines={engines} mixed={mixed} />
        <EngineUnbrandedGraph engines={engines} showSmallSample={showSmallSample} />
        <div className="content-box-title">Commercial outcomes by engine</div>
        <ResizableTable
          tableId="engine-comparison"
          columns={ENGINE_COLUMNS}
          fillColumnId="competitors"
          wrapColumnIds={ENGINE_WRAPS}
          exportScope={exportScope}
          freezeHeader
          maxHeight={520}
          sort={sortedEngines.sort}
          onSort={sortedEngines.onSort}
        >
          <tbody>
            {sortedEngines.rows.map((engine) => {
              const aside = headlineAside(engine);
              return (
                <tr key={engine.key} data-engine={engine.key} data-engine-group={engineGroup(engine.key)}>
                  <td>
                    <EvidenceLink focus={{ field: "engine", value: engine.key }} tab={AI_TABS.simulations}>
                      {engineLabel(engine.key)}
                    </EvidenceLink>
                    <div className="ai-role-detail">{engine.models.join(", ")}</div>
                  </td>
                  <td>
                    <RoleCount
                      role="unbranded_discovery"
                      tally={engine.roles.unbranded_discovery}
                      largestResolved={largest.unbranded}
                      showSmallSample={showSmallSample}
                    />
                  </td>
                  <td>
                    <RoleCount
                      role="branded_consideration"
                      tally={engine.roles.branded_consideration}
                      largestResolved={largest.branded}
                      showSmallSample={showSmallSample}
                    />
                  </td>
                  <td data-ai-engine-competitors="">{competitorLeadsLine(engineCompetitorLeads(snapshot.calls, engine.key))}</td>
                  <td>{formatInt(aside.unresolved)}</td>
                  <td>{formatInt(aside.errors)}</td>
                </tr>
              );
            })}
          </tbody>
        </ResizableTable>
        <p className="ai-role-footnote">
          Each engine is compared on its own for <AiTerm term="unbranded discovery">unbranded discovery</AiTerm> and for{" "}
          <AiTerm term="branded consideration">branded consideration</AiTerm>.
          {showSmallSample ? (
            <>
              {" "}
              A <AiTerm term="small sample" /> keeps its percentage and is not ranked.
            </>
          ) : null}{" "}
          Competitor leads count wins inside <AiTerm term="unbranded discovery">unbranded discovery</AiTerm> only.
        </p>
      </div>

      <EngineCategoryGrid snapshot={snapshot} engines={engines} showSmallSample={showSmallSample} />
    </>
  );
}

export function EngineComparisonPanel() {
  return (
    <EngineGroupScope>
      <AiReadGate>{(snapshot) => <Comparison snapshot={snapshot} />}</AiReadGate>
    </EngineGroupScope>
  );
}
