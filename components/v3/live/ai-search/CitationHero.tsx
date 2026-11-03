"use client";

import "@/components/v3/live/ai-search/citation-glance.css";
import { useState } from "react";
import { CitationCategoryFilter } from "@/components/v3/live/ai-search/CitationCategoryFilter";
import { CitationControlsStrip } from "@/components/v3/live/ai-search/CitationControlsStrip";
import { CitationExecutiveGrid } from "@/components/v3/live/ai-search/CitationExecutiveGrid";
import { CitationFigureTiles, type CitationLeadInput } from "@/components/v3/live/ai-search/CitationFigureTiles";
import { GapsCard } from "@/components/v3/live/ai-search/CitationGapsCard";
import { CitationTopSources } from "@/components/v3/live/ai-search/CitationTopSources";
import {
  citationGaps,
  ownedByQuestionType,
  ownedPresence,
  type CitationGap,
  type RoleOwnedGroup,
  type RoleOwnedPresence,
} from "@/lib/ai-search/citation-insights";
import type { CitationPick } from "@/lib/ai-search/citation-pick";
import { citationPies, unbrandedAnswerPie, unbrandedBrandPie } from "@/lib/ai-search/citation-pies";
import { citationCategoryLabel, type CitationCategoryOption } from "@/lib/ai-search/citation-top-sources";
import type { CitationRead, CitationScope } from "@/lib/ai-search/citations";
import { engineLabel } from "@/lib/ai-search/run-metrics";
import type { AiSearchSnapshot } from "@/lib/ai-search/types";

export type { CitationPick } from "@/lib/ai-search/citation-pick";

/** First screen of Citation Ecosystem: figure tiles, one control row, then the chart beside the tiles. */
export function CitationHero({
  snapshot,
  read,
  scope,
  scopeNoun,
  onScope,
  onPick,
  showSmallSample,
  lead,
  note,
  categories,
  category,
  onCategory,
  activeDomain,
}: {
  snapshot: AiSearchSnapshot;
  read: CitationRead;
  scope: CitationScope;
  scopeNoun: string;
  onScope: (scope: CitationScope) => void;
  onPick: (pick: CitationPick) => void;
  /** A single run still marks a thin lead-rate group. A month total does not. */
  showSmallSample: boolean;
  lead: CitationLeadInput;
  /** Window note, e.g. runs left out because citations were not stored. */
  note: string;
  categories: CitationCategoryOption[];
  category: string | null;
  onCategory: (category: string | null) => void;
  activeDomain: string | null;
}) {
  const [showAllGaps, setShowAllGaps] = useState(false);
  const presence = ownedPresence(read);
  const pies = citationPies(read);
  const mixPie = pies?.find((pie) => pie.id === "classes") ?? null;
  const byQuestionType = ownedByQuestionType(snapshot.calls, read, scope);
  const gapResult = citationGaps(snapshot.calls, read, scope);
  const shoppingScope = scope !== "probe";
  const engines = [
    ...new Set(
      snapshot.calls.filter((call) => call.call_status === "answered").map((call) => engineLabel(call.engine)),
    ),
  ].sort();

  const onPickGap = (gap: CitationGap) => {
    onPick({ field: "gap", value: gap.category, simulationIds: gap.simulationIds });
  };

  const onPickRoleGroup = (role: RoleOwnedPresence, group: RoleOwnedGroup) => {
    onPick({
      field: "role_owned",
      value: `${role.role}:${group.key}`,
      simulationIds: group.simulationIds,
    });
  };

  return (
    <div className="citation-hero citation-glance" data-citation-hero>
      <CitationFigureTiles
        lead={lead}
        read={read}
        scopeNoun={scopeNoun}
        engines={engines}
        note={note}
        category={category ? citationCategoryLabel(category) : null}
      />
      <div className="citation-control-row" data-citation-control-row>
        <CitationControlsStrip scope={scope} onScope={onScope} />
        <CitationCategoryFilter options={categories} value={category} scopeNoun={scopeNoun} onChange={onCategory} />
      </div>
      {pies == null ? (
        <p data-citation-reconcile>
          The charts are hidden because their slices do not match the table totals.
        </p>
      ) : null}
      <div className="citation-glance-grid">
        <CitationTopSources
          read={read}
          scopeNoun={scopeNoun}
          category={category}
          activeDomain={activeDomain}
          onPickDomain={(domain) => onPick({ field: "domain", value: domain })}
          onShowAll={() => onPick(null)}
        />
        <CitationExecutiveGrid
          presence={presence}
          scopeNoun={scopeNoun}
          unbrandedPie={unbrandedAnswerPie(byQuestionType)}
          mixPie={mixPie}
          brandPie={unbrandedBrandPie(snapshot.calls, read)}
          byQuestionType={byQuestionType}
          rolesApplicable={shoppingScope}
          showSmallSample={showSmallSample}
          onPickRoleGroup={onPickRoleGroup}
        >
          <GapsCard
            gaps={gapResult?.gaps ?? []}
            ok={gapResult?.ok ?? false}
            applicable={shoppingScope}
            showAll={showAllGaps}
            onToggleAll={() => setShowAllGaps((value) => !value)}
            onPickGap={onPickGap}
          />
        </CitationExecutiveGrid>
      </div>
    </div>
  );
}
