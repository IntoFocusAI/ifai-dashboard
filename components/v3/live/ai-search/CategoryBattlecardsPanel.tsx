"use client";

import "@/components/v3/live/ai-search/category-battlecards.css";
import { useState } from "react";
import { clientColumn, ResizableTable } from "@/components/v3/live/ResizableTable";
import { useClientTableSort } from "@/components/v3/live/useClientTableSort";
import { useAiHistoryOptional } from "@/components/v3/live/ai-search/AiHistoryContext";
import { AiReadGate } from "@/components/v3/live/ai-search/AiReadGate";
import { AiTerm } from "@/components/v3/live/ai-search/AiTerm";
import { CategoryBattleChips } from "@/components/v3/live/ai-search/CategoryBattleChips";
import { CategoryOnTrackVisual, LeadStatusBadge } from "@/components/v3/live/ai-search/CategoryOnTrackVisual";
import { EvidenceLink } from "@/components/v3/live/ai-search/EvidenceLink";
import { KeptOutNote, RoleCount, largestResolved, roleColumn, roleRateSort } from "@/components/v3/live/ai-search/RoleRateTable";
import { RunDetailsLead } from "@/components/v3/live/ai-search/RunDetailsLead";
import { AI_TABS } from "@/lib/ai-search/canvas-surfaces";
import {
  battlecardEngines,
  callsForEngine,
  categoryLeads,
  categoryLeadSummary,
  effectiveBattlecardFilter,
  LEAD_STATUS_LABELS,
  leadMatches,
  NO_BATTLECARD_FILTER,
  type BattlecardFilter,
  type CategoryLead,
} from "@/lib/ai-search/category-on-track";
import {
  categoryRoleTallies,
  headlineAside,
  headlineCompetitorWins,
  type RoleGroupTally,
} from "@/lib/ai-search/question-role";
import { categoryLabel, engineLabel } from "@/lib/ai-search/run-metrics";
import type { SortInput } from "@/lib/fender-canvas/table-sort";
import type { AiSearchSnapshot } from "@/lib/ai-search/types";
import { hasMixedScoringMethods, isWindowHistoryKind, MIXED_SCORING_NOTE } from "@/lib/ai-search/window-display";

const COLUMNS = [
  clientColumn("category", "Category", "text", 160, 110),
  clientColumn("status", "Who leads", "text", 150, 120),
  roleColumn("unbranded_discovery"),
  roleColumn("branded_consideration"),
  clientColumn("competitor", "Top competitor", "text", 170, 120),
  clientColumn("leads", "Competitor leads", "number", 150, 110),
  clientColumn("leader", "No leader", "number", 110, 80),
  clientColumn("errors", "Errors", "number", 90, 72),
];

function battleSortValue(
  row: RoleGroupTally,
  columnId: string,
  top: { brand: string; wins: number } | undefined,
  lead: CategoryLead | undefined,
  largest: { unbranded: number; branded: number },
): SortInput {
  const aside = headlineAside(row);
  if (columnId === "category") return categoryLabel(row.key);
  if (columnId === "status") return lead ? LEAD_STATUS_LABELS[lead.status] : null;
  if (columnId === "unbranded_discovery") return roleRateSort(row.roles.unbranded_discovery, largest.unbranded);
  if (columnId === "branded_consideration") return roleRateSort(row.roles.branded_consideration, largest.branded);
  if (columnId === "competitor") return top ? `${top.brand} (${top.wins})` : "None";
  if (columnId === "leads") return aside.competitorWins;
  if (columnId === "leader") return aside.unresolved;
  return aside.errors;
}

function ratesScope(engineName: string | null, leadFiltered: boolean): string | null {
  if (engineName && leadFiltered) return `Both rates cover ${engineName} answers in every category, including any the filter hides.`;
  if (engineName) return `Both rates cover ${engineName} answers only.`;
  if (leadFiltered) return "Both rates cover every category, including any the filter hides.";
  return null;
}

function Battlecards({ snapshot }: { snapshot: AiSearchSnapshot }) {
  const history = useAiHistoryOptional();
  const showSmallSample = !isWindowHistoryKind(history?.mode.kind);
  const mixed = hasMixedScoringMethods(snapshot);
  const [chosen, setChosen] = useState<BattlecardFilter>(NO_BATTLECARD_FILTER);
  const engines = battlecardEngines(snapshot.calls);
  const filter = effectiveBattlecardFilter(chosen, engines);
  const engineName = filter.engine ? engineLabel(filter.engine) : null;

  const calls = callsForEngine(snapshot.calls, filter.engine);
  const scoped = { ...snapshot, calls };
  const groups = categoryRoleTallies(calls);
  const leads = categoryLeads(groups, calls);
  const leadByKey = new Map(leads.map((lead) => [lead.key, lead]));
  const shownLeads = leads.filter((lead) => leadMatches(lead.status, filter.lead));
  const battles = groups
    .filter((group) => leadMatches(leadByKey.get(group.key)?.status ?? "not_available", filter.lead))
    .sort((a, b) => headlineAside(b).competitorWins - headlineAside(a).competitorWins || a.key.localeCompare(b.key));
  const largest = {
    unbranded: largestResolved(groups, "unbranded_discovery"),
    branded: largestResolved(groups, "branded_consideration"),
  };
  const leadersFor = (category: string) =>
    headlineCompetitorWins(calls.filter((row) => (row.category ?? "") === category));
  const sorted = useClientTableSort(battles, COLUMNS, (row, columnId) =>
    battleSortValue(row, columnId, leadersFor(row.key)[0], leadByKey.get(row.key), largest),
  );
  const scope = ratesScope(engineName, filter.lead !== "all");

  return (
    <div className="ai-role-rates">
      <div className="content-box ai-battlecards">
        <CategoryOnTrackVisual
          leads={shownLeads}
          summary={categoryLeadSummary(leads)}
          engineName={engineName}
          largestResolved={largest.unbranded}
          showSmallSample={showSmallSample}
          onClear={() => setChosen(NO_BATTLECARD_FILTER)}
          chips={
            <CategoryBattleChips
              engines={engines}
              filter={filter}
              onChange={setChosen}
              shown={shownLeads.length}
              total={leads.length}
            />
          }
        />
        <RunDetailsLead snapshot={scoped} />
        {scope ? (
          <p className="ai-battle-rates-scope" data-ai-battle-rates-scope="">
            {scope}
          </p>
        ) : null}
        {mixed ? (
          <p className="ai-role-footnote" data-ai-mixed-scoring>
            {MIXED_SCORING_NOTE}
          </p>
        ) : null}
        <div className="content-box-title">Category battlecards</div>
        <ResizableTable
          tableId="category-battlecards"
          columns={COLUMNS}
          freezeHeader
          maxHeight={520}
          sort={sorted.sort}
          onSort={sorted.onSort}
        >
          <tbody>
            {sorted.rows.length === 0 ? (
              <tr data-ai-battle-empty="">
                <td colSpan={COLUMNS.length}>No category matches these filters.</td>
              </tr>
            ) : null}
            {sorted.rows.map((battle) => {
              const top = leadersFor(battle.key)[0];
              const aside = headlineAside(battle);
              const lead = leadByKey.get(battle.key);
              return (
                <tr key={battle.key} data-category={battle.key} data-ai-on-track-status={lead?.status}>
                  <td>
                    <EvidenceLink focus={{ field: "category", value: battle.key }} tab={AI_TABS.simulations}>
                      {categoryLabel(battle.key)}
                    </EvidenceLink>
                  </td>
                  <td>{lead ? <LeadStatusBadge lead={lead} /> : null}</td>
                  <td>
                    <RoleCount
                      role="unbranded_discovery"
                      tally={battle.roles.unbranded_discovery}
                      largestResolved={largest.unbranded}
                      showSmallSample={showSmallSample}
                    />
                  </td>
                  <td>
                    <RoleCount
                      role="branded_consideration"
                      tally={battle.roles.branded_consideration}
                      largestResolved={largest.branded}
                      showSmallSample={showSmallSample}
                    />
                  </td>
                  <td>{top ? `${top.brand} (${top.wins})` : "None"}</td>
                  <td>{aside.competitorWins}</td>
                  <td>{aside.unresolved}</td>
                  <td>{aside.errors}</td>
                </tr>
              );
            })}
          </tbody>
        </ResizableTable>
        <p className="ai-role-footnote">
          Who leads and Competitor leads count inside <AiTerm term="unbranded discovery">unbranded discovery</AiTerm>{" "}
          only. Branded consideration stays in its Fender-lead column and is not part of either. A competitor win on a
          question kept out below does not appear in these columns.
        </p>
        <KeptOutNote snapshot={scoped} />
      </div>

      <div className="ceo-callout" style={{ marginTop: 12 }}>
        <div className="ceo-callout-header">
          <span>Who out-mentions Fender/Squier in AI buying answers?</span>
        </div>
        <div className="ceo-callout-body">
          A category is on track when Fender/Squier leads more of its resolved{" "}
          <AiTerm term="unbranded discovery">unbranded discovery</AiTerm> answers than every other brand together, and
          behind when other brands lead more. Each category also shows two Fender-lead rates, unbranded discovery and{" "}
          <AiTerm term="branded consideration">branded consideration</AiTerm>. A <AiTerm term="Fender lead" /> means
          Fender or Squier was named more than any other brand. Squier counts with Fender because it is Fender&apos;s
          entry-level line against Yamaha and Ibanez. The top competitor and Competitor leads columns use unbranded
          discovery only.
        </div>
      </div>
    </div>
  );
}

export function CategoryBattlecardsPanel() {
  return <AiReadGate>{(snapshot) => <Battlecards snapshot={snapshot} />}</AiReadGate>;
}
