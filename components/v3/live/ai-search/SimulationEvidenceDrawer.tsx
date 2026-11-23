"use client";

import { ModelName } from "@/components/v3/live/ai-search/ModelName";
import { useState } from "react";
import { mutedText } from "@/components/v3/live/ai-search/AiReadGate";
import { AiTerm } from "@/components/v3/live/ai-search/AiTerm";
import { ExternalLink } from "@/components/v3/live/ai-search/ExternalLink";
import { FactCheckEvidence } from "@/components/v3/live/ai-search/FactCheckEvidence";
import { answerCopy, useAnswerText } from "@/components/v3/live/ai-search/useAnswerText";
import { SOURCE_CLASS_LABELS, type CitationEvidence } from "@/lib/ai-search/citations";
import type { ProbeEvidence } from "@/lib/ai-search/drift";
import { factCheckColumnLabel } from "@/lib/ai-search/explorer-filter";
import { genuineGuidance } from "@/lib/ai-search/remediation";
import {
  callOutcome,
  categoryLabel,
  cleanPrompt,
  engineLabel,
  formatRunTime,
  OUTCOME_LABELS,
} from "@/lib/ai-search/run-metrics";
import type { AiCallRow } from "@/lib/ai-search/types";

function CitedPages({ rows, failed }: { rows: CitationEvidence[]; failed: boolean }) {
  return (
    <div style={{ marginTop: 8 }}>
      <strong style={{ fontSize: 12 }}>
        <AiTerm term="cited link">Cited links</AiTerm> ({rows.length})
      </strong>
      {rows.length === 0 ? (
        <p style={mutedText}>
          {failed ? "The call returned no answer, so there is nothing to cite from." : "This answer returned no cited link."}
        </p>
      ) : (
        <ol style={{ fontSize: 11, paddingLeft: 18, margin: "4px 0" }}>
          {rows.map((row) => (
            <li key={row.key} style={{ marginBottom: 4, wordBreak: "break-all" }}>
              <ExternalLink href={row.rawUrl}>{row.title ?? row.canonicalUrl}</ExternalLink>
              <div style={mutedText}>
                {row.domain} · {SOURCE_CLASS_LABELS[row.sourceClass]} · <AiTerm term="canonical URL" />:{" "}
                {row.canonicalUrl}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function ShoppingEvidence({ row, citations }: { row: AiCallRow; citations: CitationEvidence[] }) {
  const answer = useAnswerText(row.id, row.answer_text);
  const [showAnswer, setShowAnswer] = useState(false);
  const outcome = callOutcome(row);
  const answerText = answer.status === "ready" ? answer.text : null;
  const rootCause = answer.status === "ready" ? genuineGuidance(row.root_cause, answerText) : null;
  const remediation = answer.status === "ready" ? genuineGuidance(row.remediation_patch, answerText) : null;

  return (
    <>
      <table className="table-sm">
        <tbody>
          <tr><td>Prompt</td><td>{cleanPrompt(row.prompt)}</td></tr>
          <tr><td>Category</td><td>{categoryLabel(row.category)}</td></tr>
          <tr><td>Engine</td><td>{engineLabel(row.engine)}</td></tr>
          <tr><td>Model</td><td><ModelName model={row.model} /></td></tr>
          <tr><td>Outcome</td><td>{OUTCOME_LABELS[outcome]}</td></tr>
          {row.primary_brand && outcome !== "error" ? (
            <tr><td>Brand named most</td><td>{row.primary_brand}</td></tr>
          ) : null}
          <tr><td>Fact check</td><td>{factCheckColumnLabel(row)}</td></tr>
          {row.hallucination_evidence?.trim() ? (
            <tr><td>Conflicting text</td><td>{row.hallucination_evidence}</td></tr>
          ) : null}
          {row.error_message?.trim() ? <tr><td>Provider message</td><td>{row.error_message}</td></tr> : null}
          <tr><td>Checked</td><td>{formatRunTime(row.created_at)}</td></tr>
          <tr><td>Attempt</td><td>{row.attempt_no ?? "Not recorded"}</td></tr>
          <tr><td>Run</td><td style={{ wordBreak: "break-all" }}>{row.audit_run_id}</td></tr>
          <tr><td>Answer ID</td><td style={{ wordBreak: "break-all" }}>{row.id}</td></tr>
        </tbody>
      </table>

      {rootCause ? (
        <p style={{ fontSize: 12, marginTop: 8 }} data-ai-root-cause>
          <strong>Root cause:</strong> {rootCause}
        </p>
      ) : null}
      {remediation ? (
        <p style={{ fontSize: 12, marginTop: 8 }} data-ai-remediation>
          <strong>Recommended change:</strong> {remediation}
        </p>
      ) : null}

      <CitedPages rows={citations} failed={outcome === "error"} />

      {outcome !== "error" ? (
        <div style={{ marginTop: 8 }}>
          <button type="button" className="segmented-btn" onClick={() => setShowAnswer((v) => !v)} aria-expanded={showAnswer}>
            {showAnswer ? "Hide answer text" : "Show answer text"}
          </button>
          {showAnswer ? (
            <p style={{ ...mutedText, whiteSpace: "pre-wrap", marginTop: 6 }} data-ai-answer>
              {answerCopy(answer, "No answer text was stored for this call.")}
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

export function SimulationEvidenceDrawer({
  row,
  probe,
  citations,
  questionsSent,
  onClose,
}: {
  row: AiCallRow;
  probe: ProbeEvidence | null;
  citations: CitationEvidence[];
  questionsSent: number;
  onClose: () => void;
}) {
  const isFactCheck = row.prompt_kind === "probe";

  return (
    <div
      className="content-box ai-evidence-drawer"
      role="region"
      aria-label={`Evidence for call ${row.sim_id}`}
      data-sim-id={row.sim_id}
      style={{ marginTop: 6, borderColor: "var(--border-glow)" }}
    >
      <div className="content-box-title">
        <span>{isFactCheck ? "Product fact check" : "Shopping answer"} {row.sim_id}</span>
        <button type="button" className="segmented-btn" onClick={onClose}>Close</button>
      </div>
      {isFactCheck ? (
        <>
          <FactCheckEvidence row={row} probe={probe} questionsSent={questionsSent} />
          <CitedPages rows={citations} failed={row.call_status === "error"} />
        </>
      ) : (
        <ShoppingEvidence row={row} citations={citations} />
      )}
    </div>
  );
}
