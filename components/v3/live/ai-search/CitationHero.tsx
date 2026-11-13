"use client";

import "@/components/v3/live/ai-search/citation-glance.css";
import { useState } from "react";
import { CitationCategoryFilter } from "@/components/v3/live/ai-search/CitationCategoryFilter";
import { CitationChain, type CitationLeadInput } from "@/components/v3/live/ai-search/CitationChain";
import { CitationControlsStrip } from "@/components/v3/live/ai-search/CitationControlsStrip";
import { CitationExecutiveGrid } from "@/components/v3/live/ai-search/CitationExecutiveGrid";
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
import { engineKindLabel, questionScope, type CitationQuestion } from "@/lib/ai-search/citation-filters";
import type { CitationRead } from "@/lib/ai-search/citations";
import type { QuestionSetKind } from "@/lib/ai-search/history-trends";
import type { AiSearchSnapshot } from "@/lib/ai-search/types";

export type { CitationPick } from "@/lib/ai-search/citation-pick";

const QUESTION_SET_KIND: Record<ReturnType<typeof questionScope>, QuestionSetKind> = {
  commercial: "commercial",
  probe: "probe",
  all: "all",
};

/** First screen of Citation Ecosystem: the headline chain, one control row, then the chart beside the tiles. */
export function CitationHero({
  snapshot,
  read,
  question,
  scopeNoun,
  onQuestion,
  onPick,
  showSmallSample,
  lead,
  note,
  categories,
  category,
  onCategory,
  activeDomain,
  engineFilter,
}: {
  snapshot: AiSearchSnapshot;
  read: CitationRead;
  question: CitationQuestion;
  scopeNoun: string;
  onQuestion: (question: CitationQuestion) => void;
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
  /** The engine chips when they match no preset, as one label. */
  engineFilter: string | null;
}) {
  const scope = questionScope(question);
  const [showAllGaps, setShowAllGaps] = useState(false);
  const presence = ownedPresence(read);
  const pies = citationPies(read);
  const mixPie = pies?.find((pie) => pie.id === "classes") ?? null;
  const allRoles = ownedByQuestionType(snapshot.calls, read, scope);
  // Unbranded or branded shopping keeps only its own role; the other would read 0 of 0.
  const byQuestionType =
    allRoles && (question === "unbranded" || question === "branded")
      ? { ...allRoles, roles: allRoles.roles.filter((role) => role.role === (question === "unbranded" ? "unbranded_discovery" : "branded_consideration")) }
      : allRoles;
  // The owned-pages-in-unbranded figure stays in its tile; Branded shopping has no unbranded answer.
  const unbrandedApplies = question !== "branded";
  const gapResult = citationGaps(snapshot.calls, read, scope);
  const shoppingScope = scope !== "probe";
  const engines = [
    ...new Set(
      snapshot.calls.filter((call) => call.call_status === "answered").map((call) => engineKindLabel(call.engine)),
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
      <CitationChain
        lead={lead}
        read={read}
        scopeNoun={scopeNoun}
        engines={engines}
        note={note}
        category={category ? citationCategoryLabel(category) : null}
        engineFilter={engineFilter}
        questions={QUESTION_SET_KIND[scope]}
      />
      <div className="citation-control-row" data-citation-control-row>
        <CitationControlsStrip question={question} onQuestion={onQuestion} />
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
          unbrandedPie={unbrandedApplies ? unbrandedAnswerPie(allRoles) : null}
          mixPie={mixPie}
          brandPie={unbrandedBrandPie(snapshot.calls, read)}
          byQuestionType={byQuestionType}
          unbrandedApplies={unbrandedApplies}
          rolesApplicable={shoppingScope}
          showSmallSample={showSmallSample}
          onPickRoleGroup={onPickRoleGroup}
          onPickClass={(key) => onPick({ field: "class", value: key })}
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
