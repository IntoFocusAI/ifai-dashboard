"use client";

import { mutedText } from "@/components/v3/live/ai-search/AiReadGate";
import { AiTerm } from "@/components/v3/live/ai-search/AiTerm";
import { CopyTip } from "@/components/v3/live/ai-search/CopyTip";
import { ExternalLink } from "@/components/v3/live/ai-search/ExternalLink";
import { answerCopy, useAnswerText } from "@/components/v3/live/ai-search/useAnswerText";
import { PROBE_STATE_LABELS, type ProbeEvidence } from "@/lib/ai-search/drift";
import {
  AMAZON_DIFFERS_TITLE,
  CATALOG_PICK_TIP,
  FACT_CHECK_METHOD_TITLE,
  amazonDiffersTip,
  factCheckPickTip,
} from "@/lib/ai-search/fact-check-copy";
import { specFieldLabel } from "@/lib/ai-search/probe-catalog";
import { cleanPrompt, engineLabel, formatRunTime, modelLabel } from "@/lib/ai-search/run-metrics";
import type { AiCallRow } from "@/lib/ai-search/types";
import { formatInt } from "@/lib/fender-canvas/format";
import { amazonHref } from "@/lib/fender-canvas/stock-loss";

const label = { fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4, color: "var(--text-subtle)" } as const;
const value = { fontSize: 13, lineHeight: 1.5, margin: "2px 0 10px" } as const;

function Step({ step, heading, children }: { step: number; heading: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={label}>
        {step}. {heading}
      </div>
      <div style={value}>{children}</div>
    </div>
  );
}

/**
 * One product fact check, read top to bottom: the question, the fact Fender
 * publishes, its source page, the engine's answer, and the result.
 */
export function FactCheckEvidence({
  row,
  probe,
  questionsSent,
}: {
  row: AiCallRow;
  probe: ProbeEvidence | null;
  questionsSent: number;
}) {
  const answer = useAnswerText(row.id, row.answer_text);
  const failed = row.call_status === "error";
  const result = probe ? PROBE_STATE_LABELS[probe.state] : "Result not recorded";

  const catalog = probe?.catalog ? probe : null;
  const listing = catalog?.asin ? amazonHref(catalog.asin) : null;

  return (
    <div data-ai-fact-check-evidence>
      {catalog ? (
        <p style={{ ...mutedText, marginTop: 0 }} data-ai-fact-catalog-intro>
          This is one of {formatInt(questionsSent)}{" "}
          <CopyTip label={FACT_CHECK_METHOD_TITLE} description={CATALOG_PICK_TIP}>
            catalog products
          </CopyTip>{" "}
          checked.
        </p>
      ) : (
        <p style={{ ...mutedText, marginTop: 0 }}>
          This is one of {questionsSent}{" "}
          <CopyTip label={FACT_CHECK_METHOD_TITLE} description={factCheckPickTip(questionsSent)}>
            product questions
          </CopyTip>{" "}
          IntoFocus sends to every engine on purpose.
        </p>
      )}

      <Step step={1} heading="Question checked">
        {cleanPrompt(row.prompt)}
      </Step>

      <Step step={2} heading="Verified Fender fact">
        {probe?.claim ?? PROBE_STATE_LABELS.no_fact}
        {catalog?.amazonDiffers ? (
          <div style={mutedText} data-ai-amazon-differs="">
            <CopyTip label={AMAZON_DIFFERS_TITLE} description={amazonDiffersTip(catalog.amazonValue, catalog.claim)}>
              {AMAZON_DIFFERS_TITLE}
            </CopyTip>
            : {catalog.amazonValue}
          </div>
        ) : null}
      </Step>

      <Step step={3} heading="Official Fender source">
        {probe?.sourceUrl ? (
          <ExternalLink href={probe.sourceUrl}>{probe.sourceUrl}</ExternalLink>
        ) : (
          "No source page recorded"
        )}
      </Step>

      <Step step={4} heading="AI answer">
        {failed ? (
          <span>
            {engineLabel(row.engine)} returned no answer for this call
            {row.error_message ? ` (${row.error_message})` : ""}.
          </span>
        ) : (
          <span style={{ whiteSpace: "pre-wrap" }} data-ai-answer>
            {answerCopy(answer, "No answer text was stored for this call.")}
          </span>
        )}
      </Step>

      <Step step={5} heading="Result">
        <span data-ai-fact-result-row>
          {probe?.state === "no_contradiction" ? <AiTerm term="no contradiction found">{result}</AiTerm> : result}
        </span>
        {probe?.evidence ? <div style={mutedText}>Conflicting text: {probe.evidence}</div> : null}
      </Step>

      <details>
        <summary style={{ ...label, cursor: "pointer" }}>6. Engine and run details</summary>
        <table className="table-sm" style={{ marginTop: 6 }}>
          <tbody>
            <tr><td>Engine</td><td>{engineLabel(row.engine)}</td></tr>
            <tr><td>Model</td><td>{modelLabel(row.model)}</td></tr>
            <tr><td>Question ID</td><td>{row.prompt_key ?? "Not recorded"}</td></tr>
            {catalog ? (
              <>
                <tr data-ai-fact-asin>
                  <td>ASIN</td>
                  <td>{listing ? <ExternalLink href={listing}>{catalog.asin}</ExternalLink> : catalog.asin}</td>
                </tr>
                <tr><td>Fender SKU</td><td>{catalog.sku ?? "Not recorded"}</td></tr>
                <tr><td>Spec checked</td><td>{specFieldLabel(catalog.specField) ?? "Not recorded"}</td></tr>
                <tr><td>Amazon value</td><td>{catalog.amazonValue ?? "Not recorded"}</td></tr>
              </>
            ) : null}
            <tr><td>Checked</td><td>{formatRunTime(row.created_at)}</td></tr>
            <tr><td>Fact verified</td><td>{formatRunTime(probe?.verifiedAt)}</td></tr>
            <tr><td>Attempt</td><td>{row.attempt_no ?? "Not recorded"}</td></tr>
            <tr><td>Run</td><td style={{ wordBreak: "break-all" }}>{row.audit_run_id}</td></tr>
            <tr><td>Answer ID</td><td style={{ wordBreak: "break-all" }}>{row.id}</td></tr>
          </tbody>
        </table>
      </details>
    </div>
  );
}
