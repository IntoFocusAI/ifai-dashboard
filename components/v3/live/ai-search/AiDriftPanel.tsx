"use client";

import { useAiHistoryOptional } from "@/components/v3/live/ai-search/AiHistoryContext";
import { AiReadGate, mutedText } from "@/components/v3/live/ai-search/AiReadGate";
import { AiTerm } from "@/components/v3/live/ai-search/AiTerm";
import { CitationPieDisc } from "@/components/v3/live/ai-search/CitationPieDisc";
import { CopyTip } from "@/components/v3/live/ai-search/CopyTip";
import { FactCheckTable } from "@/components/v3/live/ai-search/FactCheckTable";
import { driftRead } from "@/lib/ai-search/drift";
import {
  FACT_CHECK_METHOD_TITLE,
  FACT_CHECK_SCOPE_LINE,
  FACT_CHECK_SCOPE_TITLE,
  UNVERIFIED_FLAG_TIP,
  contradictionCount,
  factCheckAccuracyColor,
  factCheckAccuracyLead,
  factCheckAccuracyPie,
  factCheckAccuracyPieTip,
  factCheckCoverageNote,
  factCheckHeadline,
  factCheckMethodLine,
  factCheckPendingNote,
  factCheckScopeTip,
} from "@/lib/ai-search/fact-check-copy";
import { engineLabel, formatRunTime, modelLabel } from "@/lib/ai-search/run-metrics";
import type { AiSearchSnapshot } from "@/lib/ai-search/types";
import { isWindowHistoryKind } from "@/lib/ai-search/window-display";

function FactChecks({ snapshot }: { snapshot: AiSearchSnapshot }) {
  const history = useAiHistoryOptional();
  const windowed = isWindowHistoryKind(history?.mode.kind);
  const drift = driftRead(snapshot.calls, snapshot.probes);
  const { coverage } = drift;
  const accuracy = factCheckAccuracyLead(coverage);
  const pie = factCheckAccuracyPie(coverage);
  const contradictions = drift.probes.filter((row) => row.state === "confirmed");
  const coverageNote = factCheckCoverageNote(coverage);
  const pendingNote = factCheckPendingNote(coverage);
  const headline = factCheckHeadline(coverage, windowed);
  const method = factCheckMethodLine(coverage, windowed);
  const rateColor = factCheckAccuracyColor(accuracy.tone);

  const explainer = (
    <div className="ai-lead-explainer" data-ai-accuracy-lead style={{ marginTop: 0 }}>
      <div className="content-box-title" style={{ marginTop: 0 }}>
        <span>
          Do AI answers match Fender&apos;s published <AiTerm term="product fact check">product facts</AiTerm>?
        </span>
        <span
          className={`tag-badge ${coverage.contradictions ? "tag-danger" : "tag-success"}`}
          data-ai-fact-result
        >
          {coverage.contradictions ? contradictionCount(coverage.contradictions) : "No contradictions found"}
        </span>
      </div>
      <p style={{ fontSize: 13, lineHeight: 1.5, margin: "0 0 6px" }} data-ai-fact-headline>
        {headline}
      </p>
      {method ? (
        <p style={{ fontSize: 12, lineHeight: 1.45, margin: "0 0 6px" }} data-ai-fact-method>
          <CopyTip label={FACT_CHECK_METHOD_TITLE} description={method.tip}>
            {method.products}
          </CopyTip>{" "}
          · {method.verified}
        </p>
      ) : null}
      <p style={{ ...mutedText, margin: 0 }} data-ai-fact-scope>
        <CopyTip label={FACT_CHECK_SCOPE_TITLE} description={factCheckScopeTip(windowed)}>
          {FACT_CHECK_SCOPE_LINE}
        </CopyTip>
      </p>
    </div>
  );

  return (
    <>
      <div className="content-box ai-drift-summary">
        {accuracy.rate && pie ? (
          <div
            data-ai-accuracy-row
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "flex-start",
              gap: "20px 28px",
            }}
          >
            <div
              data-ai-accuracy-figure-col
              style={{
                display: "flex",
                flex: "0 0 auto",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 12,
                maxWidth: "100%",
              }}
            >
              <span
                className="ai-lead-figure"
                data-ai-accuracy-figure
                style={{
                  color: rateColor,
                  fontSize: "clamp(22px, 2.2vw, 28px)",
                  fontWeight: 800,
                  lineHeight: 1.05,
                }}
              >
                {accuracy.rate} Accuracy
              </span>
              <CitationPieDisc
                pie={pie}
                sizeClass="citation-pie-disc citation-pie-disc-accuracy"
                tip={factCheckAccuracyPieTip(coverage)}
              />
            </div>
            <div style={{ flex: "1 1 280px", minWidth: 0 }}>{explainer}</div>
          </div>
        ) : (
          explainer
        )}
      </div>

      {contradictions.length ? (
        <div className="content-box" style={{ marginTop: 12 }}>
          <div className="content-box-title">Answers that contradict a Fender fact</div>
          {contradictions.map((row) => (
            <div key={row.key} className="action-card critical" style={{ marginTop: 6 }}>
              <div className="action-head">{row.prompt}</div>
              <div className="action-details">
                {engineLabel(row.engine)} · {modelLabel(row.model)}. Fender publishes: {row.claim}. The answer said:{" "}
                {row.evidence}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <FactCheckTable rows={drift.probes} windowed={windowed} />

      {pendingNote || coverageNote || drift.unverified > 0 || drift.facts.length ? (
        <div className="content-box" style={{ marginTop: 12 }}>
          <div className="content-box-title">Coverage notes</div>
          <ul style={{ ...mutedText, paddingLeft: 16, margin: 0 }}>
            {pendingNote ? <li data-ai-pending-fact>{pendingNote}</li> : null}
            {coverageNote ? <li data-ai-coverage-note>{coverageNote}</li> : null}
            {drift.unverified > 0 ? (
              <li data-ai-unverified-note>
                {drift.unverified} {drift.unverified === 1 ? "answer carries an" : "answers carry an"}{" "}
                <CopyTip label="Unverified flag" description={UNVERIFIED_FLAG_TIP}>
                  unverified flag
                </CopyTip>
                .
              </li>
            ) : null}
            {drift.facts.length ? (
              <li>
                Each verified fact was read from the linked Fender page on {formatRunTime(drift.facts[0].verifiedAt)}.
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </>
  );
}

export function AiDriftPanel() {
  return <AiReadGate>{(snapshot) => <FactChecks snapshot={snapshot} />}</AiReadGate>;
}
