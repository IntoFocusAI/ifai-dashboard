"use client";

import { clientColumn, ResizableTable } from "@/components/v3/live/ResizableTable";
import { useClientTableSort } from "@/components/v3/live/useClientTableSort";
import { useAiHistoryOptional } from "@/components/v3/live/ai-search/AiHistoryContext";
import { AiReadGate, mutedText } from "@/components/v3/live/ai-search/AiReadGate";
import { AiTerm } from "@/components/v3/live/ai-search/AiTerm";
import { EvidenceLink } from "@/components/v3/live/ai-search/EvidenceLink";
import { MixedScoringTip } from "@/components/v3/live/ai-search/MixedScoringTip";
import { RunCompletenessCard } from "@/components/v3/live/ai-search/RunCompletenessCard";
import { KeptOutNote, RoleCount, RoleSumLine, largestResolved, roleColumn, roleRateSort } from "@/components/v3/live/ai-search/RoleRateTable";
import { AI_TABS } from "@/lib/ai-search/canvas-surfaces";
import { categoryRoleTallies, engineResultRoleTallies, headlineAside, ROLE_LABELS, type RoleGroupTally, type RoleTally } from "@/lib/ai-search/question-role";
import { categoryLabel, engineLabel } from "@/lib/ai-search/run-metrics";
import { pct, resolvedPhrase, summarizeRun } from "@/lib/ai-search/summary";
import type { AiSearchSnapshot } from "@/lib/ai-search/types";
import type { SortInput } from "@/lib/fender-canvas/table-sort";
import { hasMixedScoringMethods, isWindowHistoryKind } from "@/lib/ai-search/window-display";

const ENGINE_COLUMNS = [
  clientColumn("engine", "Engine", "text", 140, 100),
  clientColumn("model", "Model", "text", 180, 110),
  roleColumn("unbranded_discovery"),
  roleColumn("branded_consideration"),
  clientColumn("leader", "No leader", "number", 110, 80),
  clientColumn("errors", "Errors", "number", 90, 72),
];

const CATEGORY_COLUMNS = [
  clientColumn("category", "Category", "text", 160, 110),
  roleColumn("unbranded_discovery"),
  roleColumn("branded_consideration"),
  clientColumn("leader", "No leader", "number", 110, 80),
  clientColumn("errors", "Errors", "number", 90, 72),
];

function groupSortValue(
  row: RoleGroupTally,
  columnId: string,
  label: string,
  largest: { unbranded: number; branded: number },
): SortInput {
  const aside = headlineAside(row);
  if (columnId === "engine" || columnId === "category") return label;
  if (columnId === "model") return row.models.join(", ") || null;
  if (columnId === "unbranded_discovery") return roleRateSort(row.roles.unbranded_discovery, largest.unbranded);
  if (columnId === "branded_consideration") return roleRateSort(row.roles.branded_consideration, largest.branded);
  if (columnId === "leader") return aside.unresolved;
  return aside.errors;
}

const SIM = AI_TABS.simulations;

function RoleRate({
  tally,
  term,
  unit,
  mixed,
}: {
  tally: RoleTally;
  term: "unbranded discovery" | "branded consideration";
  unit: "run" | "selection";
  mixed: boolean;
}) {
  const rate = tally.resolved > 0 ? pct(tally.fenderWins, tally.resolved) : "No resolved answers";
  return (
    <div className="metric-card-sm" data-ai-role={tally.role}>
      <div className="metric-card-val" data-ai-lead-figure={tally.role}>
        {tally.resolved > 0 ? (
          <MixedScoringTip mixed={mixed}>{`${tally.fenderWins} of ${tally.resolved}`}</MixedScoringTip>
        ) : (
          "No resolved answers"
        )}
      </div>
      <span className="metric-card-label"><AiTerm term={term}>{ROLE_LABELS[tally.role]}</AiTerm></span>
      <span className="metric-card-sub">
        {tally.resolved > 0 ? (
          <>
            <EvidenceLink focus={{ field: "role", value: `${tally.role}/fender_win` }} tab={SIM}>
              {tally.fenderWins} Fender/Squier leads
            </EvidenceLink>{" "}
            of{" "}
            <EvidenceLink focus={{ field: "role", value: `${tally.role}/resolved` }} tab={SIM}>
              {tally.resolved}
            </EvidenceLink>{" "}
            <AiTerm term="resolved" /> answers (<span data-ai-win-rate={tally.role}>{rate}</span>)
          </>
        ) : (
          `No resolved answers in this ${unit}`
        )}
      </span>
    </div>
  );
}

function keptOut(tally: RoleTally): string {
  const parts = [resolvedPhrase(tally)];
  if (tally.unresolved > 0) parts.push(`${tally.unresolved} with no clear leader`);
  if (tally.errors > 0) parts.push(`${tally.errors} provider errors`);
  return parts.join(", ");
}

function WinCard({ snapshot, unit, mixed }: { snapshot: AiSearchSnapshot; unit: "run" | "selection"; mixed: boolean }) {
  const s = summarizeRun(snapshot);
  return (
    <div className="content-box ai-win-card">
      <div className="metric-grid-2">
        <RoleRate tally={s.roles.unbranded} term="unbranded discovery" unit={unit} mixed={mixed} />
        <RoleRate tally={s.roles.branded} term="branded consideration" unit={unit} mixed={mixed} />
      </div>
      <div className="content-box-title">
        <span>How often Fender/Squier is named, by the kind of question</span>
      </div>
      <ul style={{ ...mutedText, margin: "10px 0 0", paddingLeft: 16 }}>
        <li>
          <AiTerm term="brand-associated discovery">Brand-associated discovery</AiTerm>:{" "}
          <EvidenceLink focus={{ field: "role", value: "brand_associated_discovery/resolved" }} tab={SIM}>
            {keptOut(s.roles.associated)}
          </EvidenceLink>
          . Counted on its own, not inside unbranded discovery.
        </li>
        <li>
          <AiTerm term="shopping guidance">Shopping guidance</AiTerm>:{" "}
          <EvidenceLink focus={{ field: "role", value: "shopping_guidance" }} tab={SIM}>
            {keptOut(s.roles.guidance)}
          </EvidenceLink>
          . Not in either rate above.
        </li>
        <li>
          <AiTerm term="product-fact question">Product-fact questions</AiTerm>:{" "}
          <EvidenceLink focus={{ field: "role", value: "product_fact" }} tab={SIM}>
            {keptOut(s.roles.productFact)}
          </EvidenceLink>
          . These are still stored as shopping prompts, and they are not in either rate above.
        </li>
        <li>
          <EvidenceLink focus={{ field: "kind", value: "probe" }} tab={SIM}>
            {s.probesAnswered} answered
          </EvidenceLink>{" "}
          <AiTerm term="product fact check">product fact checks</AiTerm> stay on their own tab.
        </li>
        {s.commercial.disqualified > 0 ? (
          <li>
            {s.commercial.disqualified} Fender leads with a <AiTerm term="confirmed contradiction" />, not counted as wins
          </li>
        ) : null}
      </ul>
    </div>
  );
}

function EngineTable({ snapshot, showSmallSample }: { snapshot: AiSearchSnapshot; showSmallSample: boolean }) {
  const engines = engineResultRoleTallies(snapshot.calls);
  const largest = {
    unbranded: largestResolved(engines, "unbranded_discovery"),
    branded: largestResolved(engines, "branded_consideration"),
  };
  const sorted = useClientTableSort(engines, ENGINE_COLUMNS, (row, columnId) =>
    groupSortValue(row, columnId, engineLabel(row.key), largest),
  );
  return (
    <div className="content-box ai-engine-table ai-role-rates" style={{ marginTop: 12 }}>
      <div className="content-box-title">By engine and model</div>
      <RoleSumLine groups={engines} preface="These rows add up to the two rates above." />
      <ResizableTable
        tableId="ai-run-engines"
        columns={ENGINE_COLUMNS}
        freezeHeader
        maxHeight={520}
        sort={sorted.sort}
        onSort={sorted.onSort}
      >
        <tbody>
          {sorted.rows.map((engine) => {
            const aside = headlineAside(engine);
            return (
              <tr key={engine.key} data-engine={engine.key}>
                <td>
                  <EvidenceLink focus={{ field: "engine", value: engine.key }} tab={SIM}>
                    {engineLabel(engine.key)}
                  </EvidenceLink>
                </td>
                <td>{engine.models.join(", ")}</td>
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
                <td>{aside.unresolved}</td>
                <td>{aside.errors}</td>
              </tr>
            );
          })}
        </tbody>
      </ResizableTable>
    </div>
  );
}

function CategoryTable({ snapshot, showSmallSample }: { snapshot: AiSearchSnapshot; showSmallSample: boolean }) {
  const categories = categoryRoleTallies(snapshot.calls);
  const largest = {
    unbranded: largestResolved(categories, "unbranded_discovery"),
    branded: largestResolved(categories, "branded_consideration"),
  };
  const sorted = useClientTableSort(categories, CATEGORY_COLUMNS, (row, columnId) =>
    groupSortValue(row, columnId, categoryLabel(row.key), largest),
  );
  return (
    <div className="content-box ai-category-table ai-role-rates" style={{ marginTop: 12 }}>
      <div className="content-box-title">By commercial category</div>
      <RoleSumLine groups={categories} preface="These rows add up to the two rates above." />
      <ResizableTable
        tableId="ai-run-categories"
        columns={CATEGORY_COLUMNS}
        freezeHeader
        maxHeight={520}
        sort={sorted.sort}
        onSort={sorted.onSort}
      >
        <tbody>
          {sorted.rows.map((row) => {
            const aside = headlineAside(row);
            return (
              <tr key={row.key} data-category={row.key}>
                <td>
                  <EvidenceLink focus={{ field: "category", value: row.key }} tab={SIM}>
                    {categoryLabel(row.key)}
                  </EvidenceLink>
                </td>
                <td>
                  <RoleCount
                    role="unbranded_discovery"
                    tally={row.roles.unbranded_discovery}
                    largestResolved={largest.unbranded}
                    showSmallSample={showSmallSample}
                  />
                </td>
                <td>
                  <RoleCount
                    role="branded_consideration"
                    tally={row.roles.branded_consideration}
                    largestResolved={largest.branded}
                    showSmallSample={showSmallSample}
                  />
                </td>
                <td>{aside.unresolved}</td>
                <td>{aside.errors}</td>
              </tr>
            );
          })}
        </tbody>
      </ResizableTable>
      <KeptOutNote snapshot={snapshot} />
    </div>
  );
}

function SummaryBody({ snapshot }: { snapshot: AiSearchSnapshot }) {
  const history = useAiHistoryOptional();
  const windowed = isWindowHistoryKind(history?.mode.kind);
  const showSmallSample = !windowed;
  const unit = windowed ? "selection" : "run";
  const mixed = hasMixedScoringMethods(snapshot);
  return (
    <>
      <WinCard snapshot={snapshot} unit={unit} mixed={mixed} />
      <EngineTable snapshot={snapshot} showSmallSample={showSmallSample} />
      <CategoryTable snapshot={snapshot} showSmallSample={showSmallSample} />
      <div style={{ marginTop: 12 }}>
        <RunCompletenessCard snapshot={snapshot} />
      </div>
    </>
  );
}

export function RunSummaryPanel() {
  return <AiReadGate>{(snapshot) => <SummaryBody snapshot={snapshot} />}</AiReadGate>;
}
