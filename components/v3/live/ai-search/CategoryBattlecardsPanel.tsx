"use client";

import "@/components/v3/live/ai-search/category-battlecards.css";
import { useState } from "react";
import { clientColumn, ResizableTable } from "@/components/v3/live/ResizableTable";
import { useClientTableSort } from "@/components/v3/live/useClientTableSort";
import { useAiHistoryOptional } from "@/components/v3/live/ai-search/AiHistoryContext";
import { AiReadGate } from "@/components/v3/live/ai-search/AiReadGate";
import { AiTerm } from "@/components/v3/live/ai-search/AiTerm";
import { CategoryBattleChips } from "@/components/v3/live/ai-search/CategoryBattleChips";
import { CategoryBattleHeroes } from "@/components/v3/live/ai-search/CategoryBattleHeroes";
import { CategoryLeadPies, EngineMark, LeadStatusBadge } from "@/components/v3/live/ai-search/CategoryLeadPies";
import { EvidenceLink } from "@/components/v3/live/ai-search/EvidenceLink";
import { KeptOutNote, RoleCount, largestResolved, roleColumn, roleRateSort } from "@/components/v3/live/ai-search/RoleRateTable";
import { AI_TABS } from "@/lib/ai-search/canvas-surfaces";
import { scopeEvidence } from "@/lib/ai-search/evidence-focus";
import {
  BATTLE_COLUMN_NOTES,
  battlecardEngines,
  callsForEngine,
  categoryLeads,
  categoryLeadSummary,
  effectiveBattlecardFilter,
  leadMatches,
  NO_BATTLECARD_FILTER,
  type BattlecardFilter,
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

function notedColumn(id: keyof typeof BATTLE_COLUMN_NOTES, name: string, sort: "text" | "number", width: number, min: number) {
  return { ...clientColumn(id, name, sort, width, min), headerTooltip: { title: name, description: BATTLE_COLUMN_NOTES[id] } };
}

const COLUMNS = [
  clientColumn("category", "Category", "text", 160, 110),
  roleColumn("unbranded_discovery"),
  roleColumn("branded_consideration"),
  notedColumn("competitor", "Top competitor", "text", 170, 120),
  notedColumn("leads", "Competitor leads", "number", 150, 110),
  notedColumn("leader", "No leader", "number", 110, 80),
  notedColumn("errors", "Errors", "number", 90, 72),
];

function battleSortValue(
  row: RoleGroupTally,
  columnId: string,
  top: { brand: string; wins: number } | undefined,
  largest: { unbranded: number; branded: number },
): SortInput {
  const aside = headlineAside(row);
  if (columnId === "category") return categoryLabel(row.key);
  if (columnId === "unbranded_discovery") return roleRateSort(row.roles.unbranded_discovery, largest.unbranded);
  if (columnId === "branded_consideration") return roleRateSort(row.roles.branded_consideration, largest.branded);
  if (columnId === "competitor") return top ? `${top.brand} (${top.wins})` : "None";
  if (columnId === "leads") return aside.competitorWins;
  if (columnId === "leader") return aside.unresolved;
  return aside.errors;
}

function Battlecards({ snapshot }: { snapshot: AiSearchSnapshot }) {
  const history = useAiHistoryOptional();
  const showSmallSample = !isWindowHistoryKind(history?.mode.kind);
  const mixed = hasMixedScoringMethods(snapshot);
  const [chosen, setChosen] = useState<BattlecardFilter>(NO_BATTLECARD_FILTER);
  const engines = battlecardEngines(snapshot.calls);
  const filter = effectiveBattlecardFilter(chosen, engines);
  const engineName = filter.engine ? engineLabel(filter.engine) : null;

  const engineScope = filter.engine ? { engine: filter.engine } : undefined;
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
    battleSortValue(row, columnId, leadersFor(row.key)[0], largest),
  );
  return (
    <div className="ai-role-rates">
      <div className="content-box ai-battlecards">
        <CategoryBattleHeroes
          snapshot={scoped}
          summary={categoryLeadSummary(leads)}
          engineScope={engineScope}
          engineName={engineName}
        />
        <CategoryBattleChips
          engines={engines}
          filter={filter}
          onChange={setChosen}
          shown={shownLeads.length}
          total={leads.length}
        />
        <CategoryLeadPies
          leads={shownLeads}
          largestResolved={largest.unbranded}
          showSmallSample={showSmallSample}
          onClear={() => setChosen(NO_BATTLECARD_FILTER)}
          scope={engineScope}
          engineName={engineName}
        />
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
              const rowScope = { category: battle.key, ...engineScope };
              return (
                <tr key={battle.key} data-category={battle.key} data-ai-on-track-status={lead?.status}>
                  <td>
                    <EvidenceLink
                      focus={scopeEvidence({ field: "category", value: battle.key }, engineScope)}
                      tab={AI_TABS.simulations}
                    >
                      {categoryLabel(battle.key)}
                    </EvidenceLink>
                    <EngineMark engineName={engineName} />
                    {lead ? (
                      <div className="ai-battle-row-status">
                        <LeadStatusBadge lead={lead} />
                      </div>
                    ) : null}
                  </td>
                  <td>
                    <RoleCount
                      role="unbranded_discovery"
                      tally={battle.roles.unbranded_discovery}
                      largestResolved={largest.unbranded}
                      showSmallSample={showSmallSample}
                      scope={rowScope}
                    />
                    <EngineMark engineName={battle.roles.unbranded_discovery.resolved > 0 ? engineName : null} />
                  </td>
                  <td>
                    <RoleCount
                      role="branded_consideration"
                      tally={battle.roles.branded_consideration}
                      largestResolved={largest.branded}
                      showSmallSample={showSmallSample}
                      scope={rowScope}
                    />
                    <EngineMark engineName={battle.roles.branded_consideration.resolved > 0 ? engineName : null} />
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
        <KeptOutNote snapshot={scoped} inlineCaveats={false} />
      </div>

      <div className="ceo-callout" style={{ marginTop: 12 }}>
        <div className="ceo-callout-header">
          <span>Who out-mentions Fender/Squier in AI buying answers?</span>
        </div>
        <div className="ceo-callout-body">
          A category is on track when Fender/Squier leads more of its resolved{" "}
          <AiTerm term="unbranded discovery">unbranded discovery</AiTerm> answers than any single other brand, tied when
          the top other brand leads as many, and behind when one other brand leads more. Each category also shows two
          Fender-lead rates, unbranded discovery and{" "}
          <AiTerm term="branded consideration">branded consideration</AiTerm>. A <AiTerm term="Fender lead" /> means
          Fender or Squier was named more than any other brand. Squier counts with Fender because it is Fender&apos;s
          entry-level line against Yamaha and Ibanez.
        </div>
      </div>
    </div>
  );
}

export function CategoryBattlecardsPanel() {
  return (
    <div className="ai-battlecards-tab" data-ai-battlecards-tab="">
      <AiReadGate>{(snapshot) => <Battlecards snapshot={snapshot} />}</AiReadGate>
    </div>
  );
}
