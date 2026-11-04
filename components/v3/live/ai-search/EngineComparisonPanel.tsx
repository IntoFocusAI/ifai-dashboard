"use client";

import { clientColumn, ResizableTable, type RetailColumn } from "@/components/v3/live/ResizableTable";
import { useClientTableSort } from "@/components/v3/live/useClientTableSort";
import { useAiHistoryOptional } from "@/components/v3/live/ai-search/AiHistoryContext";
import { AiReadGate } from "@/components/v3/live/ai-search/AiReadGate";
import { EngineGroupScope } from "@/components/v3/live/ai-search/EngineGroupScope";
import { AiTerm } from "@/components/v3/live/ai-search/AiTerm";
import { EngineComparisonLead } from "@/components/v3/live/ai-search/EngineComparisonLead";
import { EngineUnbrandedGraph } from "@/components/v3/live/ai-search/EngineUnbrandedGraph";
import { EvidenceLink } from "@/components/v3/live/ai-search/EvidenceLink";
import { KeptOutNote, RoleCount, RolePair, largestResolved, roleColumn, roleRateSort } from "@/components/v3/live/ai-search/RoleRateTable";
import { AI_TABS } from "@/lib/ai-search/canvas-surfaces";
import { engineGroup } from "@/lib/ai-search/engine-group";
import {
  engineResultRoleTallies,
  headlineAside,
  headlineCompetitorWins,
  roleTally,
  type RoleGroupTally,
} from "@/lib/ai-search/question-role";
import { categoryLabel, engineLabel } from "@/lib/ai-search/run-metrics";
import type { SortInput } from "@/lib/fender-canvas/table-sort";
import type { AiCallRow, AiSearchSnapshot } from "@/lib/ai-search/types";
import { hasMixedScoringMethods, isWindowHistoryKind } from "@/lib/ai-search/window-display";

function brandId(brand: string): string {
  return `brand:${brand}`;
}

function engineColumns(brands: string[]): RetailColumn[] {
  return [
    clientColumn("engine", "Engine", "text", 160, 110),
    roleColumn("unbranded_discovery"),
    roleColumn("branded_consideration"),
    ...brands.map((brand) => clientColumn(brandId(brand), brand, "number", 110, 80)),
    clientColumn("unresolved", "No leader", "number", 110, 80),
    clientColumn("errors", "Errors", "number", 90, 72),
  ];
}

function brandWins(rows: AiCallRow[], engine: string, brand: string): number {
  return headlineCompetitorWins(rows.filter((row) => (row.engine ?? "").toLowerCase() === engine)).find(
    (entry) => entry.brand === brand,
  )?.wins ?? 0;
}

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
  if (columnId.startsWith("brand:")) return brandWins(rows, row.key, columnId.slice("brand:".length));
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
  const brands = headlineCompetitorWins(snapshot.calls).map((entry) => entry.brand);
  const categories = [
    ...new Set(
      snapshot.calls.filter((row) => row.prompt_kind === "commercial").map((row) => row.category ?? ""),
    ),
  ].sort();
  const columns = engineColumns(brands);
  const categoryColumns = [
    clientColumn("category", "Category", "text", 160, 110),
    ...engines.map((engine) => clientColumn(engine.key, engineLabel(engine.key), "number", 210, 160)),
  ];
  const sortedEngines = useClientTableSort(engines, columns, (row, columnId) =>
    engineSortValue(row, columnId, snapshot.calls, largest),
  );
  const cellOf = (category: string, engine: string) => {
    const bucket = snapshot.calls.filter(
      (row) => (row.category ?? "") === category && (row.engine ?? "").toLowerCase() === engine,
    );
    return {
      unbranded: roleTally(bucket, "unbranded_discovery"),
      branded: roleTally(bucket, "branded_consideration"),
    };
  };
  const cellLargest = categories.reduce(
    (max, category) => {
      for (const engine of engines) {
        const cell = cellOf(category, engine.key);
        max.unbranded = Math.max(max.unbranded, cell.unbranded.resolved);
        max.branded = Math.max(max.branded, cell.branded.resolved);
      }
      return max;
    },
    { unbranded: 0, branded: 0 },
  );
  const sortedCategories = useClientTableSort(categories, categoryColumns, (category, columnId) => {
    if (columnId === "category") return categoryLabel(category);
    const cell = cellOf(category, columnId);
    return cell.unbranded.resolved + cell.branded.resolved > 0 ? cell.unbranded.fenderWins : null;
  });

  return (
    <>
      <div className="content-box ai-engine-comparison ai-role-rates">
        <EngineComparisonLead engines={engines} mixed={mixed} />
        <EngineUnbrandedGraph engines={engines} showSmallSample={showSmallSample} />
        <div className="content-box-title">Commercial outcomes by engine</div>
        <ResizableTable
          tableId="engine-comparison"
          columns={columns}
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
                  {brands.map((brand) => (
                    <td key={brand}>{brandWins(snapshot.calls, engine.key, brand)}</td>
                  ))}
                  <td>{aside.unresolved}</td>
                  <td>{aside.errors}</td>
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
          Competitor columns count wins inside <AiTerm term="unbranded discovery">unbranded discovery</AiTerm> only.
        </p>
      </div>

      <div className="content-box ai-engine-category ai-role-rates" style={{ marginTop: 12 }}>
        <div className="content-box-title">Fender leads by engine and category</div>
        <ResizableTable
          tableId="engine-category"
          columns={categoryColumns}
          freezeHeader
          maxHeight={520}
          sort={sortedCategories.sort}
          onSort={sortedCategories.onSort}
        >
          <tbody>
            {sortedCategories.rows.map((category) => (
              <tr key={category} data-category={category}>
                <td>{categoryLabel(category)}</td>
                {engines.map((engine) => {
                  const cell = cellOf(category, engine.key);
                  const errors = cell.unbranded.errors + cell.branded.errors;
                  return (
                    <td key={engine.key}>
                      <RolePair
                        unbranded={cell.unbranded}
                        branded={cell.branded}
                        largestUnbranded={cellLargest.unbranded}
                        largestBranded={cellLargest.branded}
                        showSmallSample={showSmallSample}
                      />
                      {errors ? <div className="ai-role-detail">{errors} provider errors</div> : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </ResizableTable>
        <p className="ai-role-footnote">
          Each cell shows both rates.
          {showSmallSample ? " A small sample is marked beside its percentage, and the two rates are not combined into one." : " The two rates are not combined into one."}
        </p>
        <KeptOutNote snapshot={snapshot} />
      </div>
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
