"use client";

import { useMemo, useState, type ReactNode } from "react";
import { clientColumn } from "@/components/v3/live/ResizableTable";
import { AiTerm } from "@/components/v3/live/ai-search/AiTerm";
import { AiReadGate, EmptyRows, mutedText } from "@/components/v3/live/ai-search/AiReadGate";
import { useAiHistoryOptional } from "@/components/v3/live/ai-search/AiHistoryContext";
import { useCitationAggregate } from "@/components/v3/live/ai-search/useCitationAggregate";
import { useAiExportScope } from "@/components/v3/live/ai-search/useAiExport";
import { CountTable, PickButton } from "@/components/v3/live/ai-search/CitationCountTable";
import { CitationEvidenceTable } from "@/components/v3/live/ai-search/CitationEvidenceTable";
import { CITED_LINK_COUNT_CAVEAT, CitationRoleNote } from "@/components/v3/live/ai-search/CitationRoleNote";
import { CitationHero } from "@/components/v3/live/ai-search/CitationHero";
import { CitationNotAvailable } from "@/components/v3/live/ai-search/CitationNotAvailable";
import { CitationReadFailed } from "@/components/v3/live/ai-search/CitationReadFailed";
import { CitationEngineChips } from "@/components/v3/live/ai-search/CitationEngineChips";
import { EngineGroupScope } from "@/components/v3/live/ai-search/EngineGroupScope";
import { EngineGroupSwitch } from "@/components/v3/live/ai-search/EngineGroupSwitch";
import { useCitationFilters, type EcosystemFilters } from "@/components/v3/live/ai-search/useCitationFilters";
import { NoWindowRunNotice } from "@/components/v3/live/ai-search/NoWindowRunNotice";
import { useEvidenceFocus } from "@/components/v3/live/ai-search/useEvidenceFocus";
import {
  citationPickLabel,
  citationPickMatches,
  pickAfterCategoryChange,
  type CitationPick,
} from "@/lib/ai-search/citation-pick";
import {
  engineKindLabel,
  questionNoun,
  questionScope,
  snapshotForEngines,
  snapshotForQuestion,
} from "@/lib/ai-search/citation-filters";
import {
  categoryForScope,
  citationCategoryLabel,
  citationCategoryOptions,
  snapshotInCategory,
} from "@/lib/ai-search/citation-top-sources";
import { citationEvidence, citedAnswers, groupCitations, type CitationScope } from "@/lib/ai-search/citations";
import { citationPopulation } from "@/lib/ai-search/engine-group";
import { citationStorageCaution } from "@/lib/ai-search/review-runs";
import type { AiSearchSnapshot } from "@/lib/ai-search/types";
import { brandName, brandOwned, isFenderClient } from "@/lib/brand-copy";

const LINK_COLUMNS = [
  {
    ...clientColumn("links", "Links", "number", 90, 72),
    headerTooltip: {
      title: "Links",
      description: `Explicit links the engines returned with these answers. ${CITED_LINK_COUNT_CAVEAT}`,
    },
  },
  {
    ...clientColumn("owned", brandOwned(), "number", 130, 100),
    headerTooltip: {
      title: `${brandOwned()} links`,
      description: `Links to sites controlled by ${isFenderClient() ? "Fender or another FMIC brand" : brandName()}. ${CITED_LINK_COUNT_CAVEAT}`,
    },
  },
];

const groupKey = (group: { key: string }) => group.key;

const ENGINE_COLUMNS = [
  clientColumn("engine", "Engine", "text", 140, 100),
  clientColumn("cited", "Cited answers", "number", 140, 110),
  ...LINK_COLUMNS,
];

const CATEGORY_COLUMNS = [
  clientColumn("category", "Category", "text", 180, 120),
  clientColumn("cited", "Cited answers", "number", 140, 110),
  ...LINK_COLUMNS,
];

function Ecosystem({
  snapshot,
  copy,
  singleRun,
  filters,
}: {
  snapshot: AiSearchSnapshot;
  copy: string;
  singleRun: boolean;
  filters: EcosystemFilters;
}) {
  const focus = useEvidenceFocus();
  const { question, narrowTo } = filters;
  const scope: CitationScope = questionScope(question);
  const [pick, setPick] = useState<CitationPick>(() =>
    focus?.field === "domain" || focus?.field === "class"
      ? { field: focus.field, value: focus.value }
      : null,
  );

  const [appliedFocus, setAppliedFocus] = useState(focus);
  if (focus !== appliedFocus) {
    setAppliedFocus(focus);
    if (focus?.field === "domain" || focus?.field === "class") {
      setPick({ field: focus.field, value: focus.value });
    }
  }

  // Engine chips, then the question control, then the category: every figure, chart, and table follows them.
  const asked = useMemo(
    () => snapshotForQuestion(snapshotForEngines(snapshot, narrowTo), question),
    [snapshot, narrowTo, question],
  );
  const category = categoryForScope(asked.calls, scope, filters.category);
  const engineFilter = narrowTo ? narrowTo.map(engineKindLabel).join(", ") : null;
  const exportScope = useAiExportScope(
    { citations: { question, scope, category, engines: narrowTo } },
    filters.readChoice,
  );
  const view = useMemo(() => snapshotInCategory(asked, category), [asked, category]);
  const read = useMemo(() => citationEvidence(view.calls, view.citations, scope), [view, scope]);
  const fender = read.rows.filter((row) => row.sourceClass === "fender_owned");
  const fenderAnswers = new Set(fender.map((row) => row.simulationId)).size;
  const byEngine = citedAnswers(view.calls, read.rows, scope, (call) => (call.engine ?? "").toLowerCase());
  const engineLinks = new Map(groupCitations(read.rows, (row) => row.engine).map((g) => [g.key, g]));
  const byCategory = citedAnswers(view.calls, read.rows, scope, (call) => call.category ?? "");
  const categoryLinks = new Map(groupCitations(read.rows, (row) => row.category).map((g) => [g.key, g]));
  const scopeNoun = questionNoun(question);
  const filtered = read.rows.filter((row) => citationPickMatches(row, pick));

  const caution = citationStorageCaution(snapshot.run.audit_run_id);
  const declaredCitations = snapshot.storedCitationCount ?? snapshot.citations.length;
  const citationUrlsLoaded = snapshot.citations.length >= declaredCitations;

  return (
    <>
      <div className="content-box ai-citation-summary">
        {caution ? (
          <p style={{ fontSize: 13, lineHeight: 1.5, margin: "0 0 6px" }} data-ai-citation-caution>
            Cited sites for this run: <CitationNotAvailable description={caution} />
          </p>
        ) : citationUrlsLoaded ? (
          <>
            <CitationHero
              snapshot={view}
              read={read}
              question={question}
              scopeNoun={scopeNoun}
              showSmallSample={singleRun}
              lead={{ owned: fender.length, total: read.rows.length }}
              note={copy}
              categories={citationCategoryOptions(asked.calls, scope)}
              category={category}
              engineFilter={engineFilter}
              onCategory={(next) => {
                filters.onCategory(next);
                setPick(pickAfterCategoryChange);
              }}
              activeDomain={pick?.field === "domain" ? pick.value : null}
              onQuestion={(next) => {
                filters.onQuestion(next);
                setPick(null);
              }}
              onPick={setPick}
            />
            <details className="citation-method-notes">
              <summary>How these counts work</summary>
              <ul style={{ ...mutedText, paddingLeft: 16, margin: "8px 0 0" }}>
                <li>
                  Answers and links are separate counts. {read.answersWithCitation} {scopeNoun} produced{" "}
                  {read.rows.length} links, so one answer can cite several pages.
                </li>
                <li>
                  {brandOwned()} links appear in {fenderAnswers} of those answers. The other{" "}
                  {read.rows.length - fender.length} links point to sites {brandName()} does not control.
                </li>
                {read.duplicates + read.invalid > 0 ? (
                  <li>
                    {read.stored} stored rows in this view. Left out:{" "}
                    {read.duplicates > 0 ? (
                      <>
                        {read.duplicates} that repeat the same <AiTerm term="canonical URL" /> inside one
                        answer
                      </>
                    ) : null}
                    {read.duplicates > 0 && read.invalid > 0 ? ", and " : null}
                    {read.invalid > 0 ? `${read.invalid} with no usable address` : null}.
                  </li>
                ) : null}
              </ul>
              <p style={{ ...mutedText, marginTop: 8 }}>
                A cited link appears alongside an answer. This read does not measure whether the page
                caused the recommendation, and a citation is not an endorsement of {brandName()} by that source.
              </p>
            </details>
          </>
        ) : (
          <p style={{ fontSize: 13, lineHeight: 1.5, margin: "0 0 6px" }} data-ai-citation-count>
            This run stores {declaredCitations} citation rows. Cited sites:{" "}
            <CitationNotAvailable description="This copy does not list each URL, so these rows are not read as a change in the citation ecosystem." />
          </p>
        )}
      </div>

      {caution ? null : <CitationRoleNote />}

      {caution || !citationUrlsLoaded ? null : read.rows.length === 0 ? (
        <div className="content-box" style={{ marginTop: 12 }}>
          <EmptyRows>No answer in this view returned a cited link.</EmptyRows>
        </div>
      ) : (
        <div className="citation-tables-row" style={{ marginTop: 12 }}>
          <div className="content-box">
            <div className="content-box-title">
              <span>By engine</span>
            </div>
            <CountTable
              tableId="citation-engines"
              columns={ENGINE_COLUMNS}
              rows={byEngine}
              keyOf={groupKey}
              exportScope={exportScope}
              value={(g, id) => {
                if (id === "engine") return engineKindLabel(g.key);
                if (id === "cited") return g.cited;
                if (id === "links") return engineLinks.get(g.key)?.rows ?? 0;
                return engineLinks.get(g.key)?.fenderOwnedRows ?? 0;
              }}
              renderRow={(g) => (
                <tr key={g.key} data-engine={g.key}>
                  <td>
                    <PickButton pick={{ field: "engine", value: g.key }} onPick={setPick}>
                      {engineKindLabel(g.key)}
                    </PickButton>
                  </td>
                  <td>
                    {g.cited} of {g.answered}
                  </td>
                  <td>{engineLinks.get(g.key)?.rows ?? 0}</td>
                  <td>{engineLinks.get(g.key)?.fenderOwnedRows ?? 0}</td>
                </tr>
              )}
            />
          </div>
          {scope !== "probe" ? (
            <div className="content-box">
              <div className="content-box-title">
                <span>By category</span>
              </div>
              <CountTable
                tableId="citation-categories"
                columns={CATEGORY_COLUMNS}
                rows={byCategory}
                keyOf={groupKey}
                exportScope={exportScope}
                value={(g, id) => {
                  if (id === "category") return citationCategoryLabel(g.key);
                  if (id === "cited") return g.cited;
                  if (id === "links") return categoryLinks.get(g.key)?.rows ?? 0;
                  return categoryLinks.get(g.key)?.fenderOwnedRows ?? 0;
                }}
                renderRow={(g) => (
                  <tr key={g.key} data-category={g.key}>
                    <td>
                      <PickButton pick={{ field: "category", value: g.key }} onPick={setPick}>
                        {citationCategoryLabel(g.key)}
                      </PickButton>
                    </td>
                    <td>
                      {g.cited} of {g.answered}
                    </td>
                    <td>{categoryLinks.get(g.key)?.rows ?? 0}</td>
                    <td>{categoryLinks.get(g.key)?.fenderOwnedRows ?? 0}</td>
                  </tr>
                )}
              />
            </div>
          ) : null}
        </div>
      )}

      {!caution && citationUrlsLoaded ? (
        <CitationEvidenceTable
          rows={filtered}
          label={citationPickLabel(pick, category)}
          onClear={pick ? () => setPick(null) : undefined}
          exportScope={exportScope}
          narrowed={pick != null}
        />
      ) : null}

      {!caution && citationUrlsLoaded && read.rows.length > 0 ? (
        <p style={{ ...mutedText, marginTop: 10 }} data-citation-reconcile>
          Cited links by source totals {read.rows.length}. {brandOwned()} and other links totals{" "}
          {read.rows.length}.
        </p>
      ) : null}
    </>
  );
}

function RangeNotice({ heading, children, tone }: { heading: string; children: ReactNode; tone: string }) {
  return (
    <div className="content-box" data-ai-state={tone}>
      <div className="content-box-title">{heading}</div>
      <p style={mutedText}>{children}</p>
    </div>
  );
}

function CitationAggregateBody({ filters }: { filters: EcosystemFilters }) {
  const aggregate = useCitationAggregate(filters.readChoice);
  if (aggregate.phase === "loading") {
    return (
      <RangeNotice heading="Adding the runs in this selection" tone="loading">
        Reading each stored run. Figures appear when those runs load and add every run together.
      </RangeNotice>
    );
  }
  if (aggregate.phase === "error") {
    return <CitationReadFailed failed={aggregate.failed} message={aggregate.message} />;
  }
  if (aggregate.phase === "empty" && aggregate.noWindowRun) return <NoWindowRunNotice />;
  if (aggregate.phase === "empty") {
    return (
      <RangeNotice heading="No citation total" tone="empty">
        {aggregate.message}
      </RangeNotice>
    );
  }
  return (
    <Ecosystem
      key={`${aggregate.snapshot.run.audit_run_id}:${aggregate.snapshot.calls.length}`}
      snapshot={aggregate.snapshot}
      copy={aggregate.copy}
      singleRun={aggregate.singleRun}
      filters={filters}
    />
  );
}

/**
 * Citation Ecosystem. Engine chips sit beside the shared presets and a question control leads
 * the hero (decision 86); both, the category, and the date pill narrow every figure and table.
 */
export function CitationEcosystemPanel() {
  const filters = useCitationFilters();
  const [category, setCategory] = useState<string | null>(null);
  const { engineSwitch } = filters;
  const ecosystem: EcosystemFilters = {
    question: filters.question,
    onQuestion: filters.setQuestion,
    narrowTo: filters.narrowTo,
    readChoice: filters.readChoice,
    category,
    onCategory: setCategory,
  };
  return (
    <>
      <EngineGroupSwitch
        state={engineSwitch.state}
        onChoose={filters.choosePreset}
        pairedDay={engineSwitch.pairedDay}
        custom={filters.custom}
        chips={<CitationEngineChips available={filters.available} selected={filters.selected} onToggle={filters.toggle} />}
      />
      <EngineGroupScope showSwitch={false} readChoice={filters.readChoice}>
        <CitationEcosystemBody filters={ecosystem} />
      </EngineGroupScope>
    </>
  );
}

function CitationEcosystemBody({ filters }: { filters: EcosystemFilters }) {
  const history = useAiHistoryOptional();
  if (history?.mode.kind === "run") {
    return (
      <AiReadGate showFreshness={false}>
        {(snapshot) => <Ecosystem snapshot={citationPopulation(snapshot)} copy="" singleRun filters={filters} />}
      </AiReadGate>
    );
  }
  return (
    <div className="ai-search-panel">
      <CitationAggregateBody filters={filters} />
    </div>
  );
}
