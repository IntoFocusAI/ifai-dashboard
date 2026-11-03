"use client";

import { useMemo, useState, type ReactNode } from "react";
import { clientColumn } from "@/components/v3/live/ResizableTable";
import { AiReadGate, EmptyRows, mutedText } from "@/components/v3/live/ai-search/AiReadGate";
import { useAiHistoryOptional } from "@/components/v3/live/ai-search/AiHistoryContext";
import { useCitationAggregate } from "@/components/v3/live/ai-search/useCitationAggregate";
import { AiTerm } from "@/components/v3/live/ai-search/AiTerm";
import { CountTable, PickButton } from "@/components/v3/live/ai-search/CitationCountTable";
import { CitationEvidenceTable } from "@/components/v3/live/ai-search/CitationEvidenceTable";
import {
  CitationInterpretationNote,
  CitationRoleNote,
} from "@/components/v3/live/ai-search/CitationRoleNote";
import { CitationHero } from "@/components/v3/live/ai-search/CitationHero";
import { useEvidenceFocus } from "@/components/v3/live/ai-search/useEvidenceFocus";
import {
  citationPickLabel,
  citationPickMatches,
  pickAfterCategoryChange,
  type CitationPick,
} from "@/lib/ai-search/citation-pick";
import {
  categoryForScope,
  citationCategoryLabel,
  citationCategoryOptions,
  snapshotInCategory,
} from "@/lib/ai-search/citation-top-sources";
import { citationEvidence, citedAnswers, groupCitations, type CitationScope } from "@/lib/ai-search/citations";
import { engineLabel } from "@/lib/ai-search/run-metrics";
import { citationStorageCaution } from "@/lib/ai-search/review-runs";
import type { AiSearchSnapshot } from "@/lib/ai-search/types";

const ENGINE_COLUMNS = [
  clientColumn("engine", "Engine", "text", 140, 100),
  clientColumn("cited", "Cited answers", "number", 140, 110),
  clientColumn("links", "Links", "number", 90, 72),
  clientColumn("owned", "Fender-owned", "number", 130, 100),
];

const CATEGORY_COLUMNS = [
  clientColumn("category", "Category", "text", 180, 120),
  clientColumn("cited", "Cited answers", "number", 140, 110),
  clientColumn("links", "Links", "number", 90, 72),
  clientColumn("owned", "Fender-owned", "number", 130, 100),
];

function Ecosystem({
  snapshot,
  copy,
  singleRun,
}: {
  snapshot: AiSearchSnapshot;
  copy: string;
  singleRun: boolean;
}) {
  const focus = useEvidenceFocus();
  const [scope, setScope] = useState<CitationScope>("commercial");
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

  const [category, setCategory] = useState<string | null>(null);
  const full = useMemo(
    () => citationEvidence(snapshot.calls, snapshot.citations, scope),
    [snapshot, scope],
  );
  // Every figure, chart, and table follows the category filter, the Fender-owned lead included.
  const view = useMemo(() => snapshotInCategory(snapshot, category), [snapshot, category]);
  const read = useMemo(
    () => (category == null ? full : citationEvidence(view.calls, view.citations, scope)),
    [full, view, scope, category],
  );
  const fender = read.rows.filter((row) => row.sourceClass === "fender_owned");
  const fenderAnswers = new Set(fender.map((row) => row.simulationId)).size;
  const byEngine = citedAnswers(view.calls, read.rows, scope, (call) =>
    (call.engine ?? "").toLowerCase(),
  );
  const engineLinks = new Map(
    groupCitations(read.rows, (row) => row.engine).map((g) => [g.key, g]),
  );
  const byCategory = citedAnswers(view.calls, read.rows, scope, (call) => call.category ?? "");
  const categoryLinks = new Map(
    groupCitations(read.rows, (row) => row.category).map((g) => [g.key, g]),
  );
  const scopeNoun =
    scope === "probe" ? "fact-check answers" : scope === "all" ? "answers" : "shopping answers";
  const filtered = read.rows.filter((row) => citationPickMatches(row, pick));

  const caution = citationStorageCaution(snapshot.run.audit_run_id);
  const declaredCitations = snapshot.storedCitationCount ?? snapshot.citations.length;
  const citationUrlsLoaded = snapshot.citations.length >= declaredCitations;

  return (
    <>
      <div className="content-box ai-citation-summary">
        {caution ? (
          <p style={{ fontSize: 13, lineHeight: 1.5, margin: "0 0 6px" }} data-ai-citation-caution>
            {caution}
          </p>
        ) : citationUrlsLoaded ? (
          <>
            <CitationHero
              snapshot={view}
              read={read}
              scope={scope}
              scopeNoun={scopeNoun}
              showSmallSample={singleRun}
              lead={{
                owned: fender.length,
                total: read.rows.length,
                within: category ? citationCategoryLabel(category) : null,
              }}
              note={copy}
              categories={citationCategoryOptions(snapshot.calls, scope)}
              category={category}
              onCategory={(next) => {
                setCategory(next);
                setPick(pickAfterCategoryChange);
              }}
              activeDomain={pick?.field === "domain" ? pick.value : null}
              onScope={(next) => {
                setScope(next);
                setPick(null);
                setCategory(categoryForScope(snapshot.calls, next, category));
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
                  Fender-owned links appear in {fenderAnswers} of those answers. The other{" "}
                  {read.rows.length - fender.length} links point to sites Fender does not control.
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
                caused the recommendation, and a citation is not an endorsement of Fender by that source.
              </p>
            </details>
          </>
        ) : (
          <p style={{ fontSize: 13, lineHeight: 1.5, margin: "0 0 6px" }} data-ai-citation-count>
            This run stores {declaredCitations} citation rows. This copy does not list each URL, so those
            rows are not read as a change in the citation ecosystem.
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
            <CitationInterpretationNote />
            <CountTable
              tableId="citation-engines"
              columns={ENGINE_COLUMNS}
              rows={byEngine}
              value={(g, id) => {
                if (id === "engine") return engineLabel(g.key);
                if (id === "cited") return g.cited;
                if (id === "links") return engineLinks.get(g.key)?.rows ?? 0;
                return engineLinks.get(g.key)?.fenderOwnedRows ?? 0;
              }}
              renderRow={(g) => (
                <tr key={g.key} data-engine={g.key}>
                  <td>
                    <PickButton pick={{ field: "engine", value: g.key }} onPick={setPick}>
                      {engineLabel(g.key)}
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
        />
      ) : null}

      {!caution && citationUrlsLoaded && read.rows.length > 0 ? (
        <p style={{ ...mutedText, marginTop: 10 }} data-citation-reconcile>
          Cited links by source totals {read.rows.length}. Fender-owned and other links totals{" "}
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

function CitationAggregateBody() {
  const aggregate = useCitationAggregate();
  if (aggregate.phase === "loading") {
    return (
      <RangeNotice heading="Adding the runs in this selection" tone="loading">
        Reading each stored run. Figures appear when those runs load. They are added together, not shown as one snapshot.
      </RangeNotice>
    );
  }
  if (aggregate.phase === "error") {
    return (
      <RangeNotice heading="These runs did not load" tone="error">
        {aggregate.message} No citation figure is shown for this selection.
      </RangeNotice>
    );
  }
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
    />
  );
}

export function CitationEcosystemPanel() {
  const history = useAiHistoryOptional();
  if (history?.mode.kind === "run") {
    return (
      <AiReadGate showFreshness={false}>
        {(snapshot) => <Ecosystem snapshot={snapshot} copy="" singleRun />}
      </AiReadGate>
    );
  }
  return (
    <div className="ai-search-panel">
      <CitationAggregateBody />
    </div>
  );
}
