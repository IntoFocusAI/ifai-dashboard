"use client";

import { useAiHistoryOptional } from "@/components/v3/live/ai-search/AiHistoryContext";
import { AiReadGate, mutedText } from "@/components/v3/live/ai-search/AiReadGate";
import { EngineGroupScope } from "@/components/v3/live/ai-search/EngineGroupScope";
import { CatalogCoverageTable } from "@/components/v3/live/ai-search/CatalogCoverageTable";
import { CopyTip } from "@/components/v3/live/ai-search/CopyTip";
import { ExternalLink } from "@/components/v3/live/ai-search/ExternalLink";
import { FactCheckLead } from "@/components/v3/live/ai-search/FactCheckLead";
import { FactCheckTable } from "@/components/v3/live/ai-search/FactCheckTable";
import { driftRead } from "@/lib/ai-search/drift";
import {
  UNVERIFIED_FLAG_TIP,
  amazonMismatchNote,
  factCheckCoverageNote,
  factCheckPendingNote,
} from "@/lib/ai-search/fact-check-copy";
import { engineLabel, formatRunTime, modelLabel } from "@/lib/ai-search/run-metrics";
import type { AiSearchSnapshot } from "@/lib/ai-search/types";
import { isWindowHistoryKind } from "@/lib/ai-search/window-display";
import { brandName, brandSite } from "@/lib/brand-copy";

/** The stored fact as one sentence: a claim that already ends in a period gets no second one. */
function sentence(text: string | null): string {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return "";
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function FactChecks({ snapshot }: { snapshot: AiSearchSnapshot }) {
  const history = useAiHistoryOptional();
  const windowed = isWindowHistoryKind(history?.mode.kind);
  const drift = driftRead(snapshot.calls, snapshot.probes);
  const { coverage } = drift;
  const contradictions = drift.probes.filter((row) => row.state === "confirmed");
  const coverageNote = factCheckCoverageNote(coverage);
  const pendingNote = factCheckPendingNote(coverage);
  const amazonNote = amazonMismatchNote(coverage);

  return (
    <>
      <FactCheckLead snapshot={snapshot} drift={drift} windowed={windowed} />

      {contradictions.length ? (
        <div className="content-box" style={{ marginTop: 12 }}>
          <div className="content-box-title">Answers that contradict a {brandName()} fact</div>
          {contradictions.map((row) => (
            <div key={row.key} className="action-card critical" style={{ marginTop: 6 }}>
              <div className="action-head">{row.prompt}</div>
              <div className="action-details">
                {engineLabel(row.engine)} · {modelLabel(row.model)}. {brandName()} publishes: {sentence(row.claim)} The answer said:{" "}
                {row.evidence}
                {row.catalog && row.sourceUrl ? (
                  <>
                    {" "}
                    <ExternalLink href={row.sourceUrl}>{brandSite()} spec page</ExternalLink>
                  </>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <CatalogCoverageTable snapshot={snapshot} windowed={windowed} />

      <FactCheckTable rows={drift.probes} windowed={windowed} />

      {pendingNote || coverageNote || amazonNote || drift.unverified > 0 || drift.facts.length ? (
        <div className="content-box" style={{ marginTop: 12 }}>
          <div className="content-box-title">Coverage notes</div>
          <ul style={{ ...mutedText, paddingLeft: 16, margin: 0 }}>
            {amazonNote ? <li data-ai-amazon-mismatch>{amazonNote}</li> : null}
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
                Each verified fact was read from the linked {brandName()} page on {formatRunTime(drift.facts[0].verifiedAt)}.
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </>
  );
}

export function AiDriftPanel() {
  return (
    <EngineGroupScope>
      <AiReadGate>{(snapshot) => <FactChecks snapshot={snapshot} />}</AiReadGate>
    </EngineGroupScope>
  );
}
