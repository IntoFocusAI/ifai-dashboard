"use client";

import "@/components/v3/live/ai-search/category-battlecards.css";
import { clientColumn, ResizableTable, type RetailColumn } from "@/components/v3/live/ResizableTable";
import { useClientTableSort } from "@/components/v3/live/useClientTableSort";
import { AiTerm } from "@/components/v3/live/ai-search/AiTerm";
import { EvidenceLink } from "@/components/v3/live/ai-search/EvidenceLink";
import { KeptOutNote } from "@/components/v3/live/ai-search/RoleRateTable";
import { useAiExportScope } from "@/components/v3/live/ai-search/useAiExport";
import { AI_TABS } from "@/lib/ai-search/canvas-surfaces";
import { scopeEvidence } from "@/lib/ai-search/evidence-focus";
import { ROLE_LABELS, type HeadlineRole, type RoleGroupTally, type RoleTally } from "@/lib/ai-search/question-role";
import {
  commercialCategories,
  engineCategoryCell,
  engineCategoryLargest,
  providerErrorsLine,
} from "@/lib/ai-search/radar-tables";
import { categoryLabel, engineLabel, isSmallSample } from "@/lib/ai-search/run-metrics";
import { pct, roleRateSort, SMALL_SAMPLE_LABEL } from "@/lib/ai-search/summary";
import type { AiSearchSnapshot } from "@/lib/ai-search/types";
import { formatInt } from "@/lib/fender-canvas/format";
import { brandName, leadBrand } from "@/lib/brand-copy";

/** Category columns share about 820 px, so six of them and the engine fit a 1280 px window. */
const CATEGORY_GRID_WIDTH = 820;

/** Column ids for the grid. A prefix keeps a category named "engine" apart from the first column. */
const CATEGORY_PREFIX = "category:";
const categoryId = (category: string) => `${CATEGORY_PREFIX}${category}`;

const engineKey = (row: RoleGroupTally) => row.key;

const SHORT_ROLE: Record<HeadlineRole, string> = {
  unbranded_discovery: "Unbranded",
  branded_consideration: "Branded",
};

/**
 * One rate in a grid cell. The percentage and its counts each stay on one line, so a narrow
 * column breaks between them and never inside "(15 of 16)". The counts open this cell's answers.
 */
function GridRate({
  role,
  tally,
  largest,
  showSmallSample,
  engine,
  category,
}: {
  role: HeadlineRole;
  tally: RoleTally;
  largest: number;
  showSmallSample: boolean;
  engine: string;
  category: string;
}) {
  const label = SHORT_ROLE[role];
  if (tally.resolved <= 0) {
    return (
      <div data-ai-role-count={role}>
        {label} No resolved answers
      </div>
    );
  }
  const name = ROLE_LABELS[role];
  const scope = { engine, category };
  const link = (outcome: "fender_win" | "resolved", text: string, aria: string) => (
    <EvidenceLink focus={scopeEvidence({ field: "role", value: `${role}/${outcome}` }, scope)} tab={AI_TABS.simulations} label={aria}>
      {text}
    </EvidenceLink>
  );
  const small = showSmallSample && isSmallSample(tally.resolved, largest);
  return (
    <div data-ai-role-count={role} data-small-sample={small ? "true" : undefined}>
      {label} <span className="ai-grid-rate-part">{pct(tally.fenderWins, tally.resolved)}</span>{" "}
      <span className="ai-grid-rate-part">
        ({link("fender_win", formatInt(tally.fenderWins), `${name}: ${leadBrand()} leads`)} of{" "}
        {link("resolved", formatInt(tally.resolved), `${name}: resolved answers`)})
      </span>
      {small ? (
        <>
          {" "}
          <AiTerm term="small sample">{SMALL_SAMPLE_LABEL}</AiTerm>
        </>
      ) : null}
    </div>
  );
}

/** Brand leads by engine and category: one row per engine, one column per category, both rates in each cell. */
export function EngineCategoryGrid({
  snapshot,
  engines,
  showSmallSample,
}: {
  snapshot: AiSearchSnapshot;
  engines: readonly RoleGroupTally[];
  showSmallSample: boolean;
}) {
  const categories = commercialCategories(snapshot.calls);
  const width = Math.max(96, Math.floor(CATEGORY_GRID_WIDTH / Math.max(1, categories.length)));
  const columns: RetailColumn[] = [
    clientColumn("engine", "Engine", "text", 120, 96),
    ...categories.map((category) => clientColumn(categoryId(category), categoryLabel(category), "number", width, 96)),
  ];
  const cellOf = (engine: string, category: string) => engineCategoryCell(snapshot.calls, engine, category);
  const largest = engineCategoryLargest(
    snapshot.calls,
    engines.map((engine) => engine.key),
    categories,
  );
  const sorted = useClientTableSort(
    engines,
    columns,
    (row, columnId) => {
      if (columnId === "engine") return engineLabel(row.key);
      return roleRateSort(cellOf(row.key, columnId.slice(CATEGORY_PREFIX.length)).unbranded, largest.unbranded);
    },
    engineKey,
  );
  const exportScope = useAiExportScope();

  return (
    <div className="content-box ai-engine-category ai-role-rates" style={{ marginTop: 12 }}>
      <div className="content-box-title">{brandName()} leads by engine and category</div>
      <ResizableTable
        tableId="engine-category"
        columns={columns}
        fillColumnId="engine"
        wrapColumnIds={categories.map(categoryId)}
        exportScope={exportScope}
        freezeHeader
        maxHeight={520}
        sort={sorted.sort}
        onSort={sorted.onSort}
      >
        <tbody>
          {sorted.rows.map((engine) => (
            <tr key={engine.key} data-engine={engine.key}>
              <td>{engineLabel(engine.key)}</td>
              {categories.map((category) => {
                const cell = cellOf(engine.key, category);
                const errors = cell.unbranded.errors + cell.branded.errors;
                return (
                  <td key={category} data-category={category}>
                    <GridRate
                      role="unbranded_discovery"
                      tally={cell.unbranded}
                      largest={largest.unbranded}
                      showSmallSample={showSmallSample}
                      engine={engine.key}
                      category={category}
                    />
                    <GridRate
                      role="branded_consideration"
                      tally={cell.branded}
                      largest={largest.branded}
                      showSmallSample={showSmallSample}
                      engine={engine.key}
                      category={category}
                    />
                    {errors ? <div className="ai-role-detail">{providerErrorsLine(errors)}</div> : null}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </ResizableTable>
      <p className="ai-role-footnote">
        Each cell shows both rates.
        {showSmallSample
          ? " A small sample is marked beside its percentage, and the two rates are not combined into one."
          : " The two rates are not combined into one."}
      </p>
      <KeptOutNote snapshot={snapshot} />
    </div>
  );
}
