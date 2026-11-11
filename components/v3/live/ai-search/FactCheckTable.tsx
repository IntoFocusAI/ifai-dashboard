"use client";

import { clientColumn, ResizableTable } from "@/components/v3/live/ResizableTable";
import { useClientTableSort } from "@/components/v3/live/useClientTableSort";
import { EmptyRows, mutedText } from "@/components/v3/live/ai-search/AiReadGate";
import { AiStatusTag, tagToneOf } from "@/components/v3/live/ai-search/AiStatusTag";
import { CopyTip } from "@/components/v3/live/ai-search/CopyTip";
import { EvidenceLink } from "@/components/v3/live/ai-search/EvidenceLink";
import { ExternalLink } from "@/components/v3/live/ai-search/ExternalLink";
import { useAiExportScope } from "@/components/v3/live/ai-search/useAiExport";
import { AI_TABS } from "@/lib/ai-search/canvas-surfaces";
import { PROBE_STATE_LABELS, type ProbeEvidence, type ProbeState } from "@/lib/ai-search/drift";
import { AMAZON_DIFFERS_TITLE, ANCHOR_TIP, ANCHOR_TITLE, amazonDiffersTip } from "@/lib/ai-search/fact-check-copy";
import { engineLabel, formatRunTime, modelLabel } from "@/lib/ai-search/run-metrics";
import type { SortInput } from "@/lib/fender-canvas/table-sort";
import { brandName } from "@/lib/brand-copy";

const STATE_TONE: Record<ProbeState, string> = {
  confirmed: "tag-danger",
  no_contradiction: "tag-success",
  no_fact: "tag-neutral",
  provider_error: "tag-warning",
  unverified: "tag-warning",
};

/**
 * Defaults sized so the representative one-line cells fit:
 * question, uppercase result badge, verified fact + Fender source, and checked date.
 * Fact absorbs leftover width on a wider panel until someone drags a column.
 * Cells wrap inside the column when a drag makes it narrower than one line.
 */
const COLUMNS = [
  clientColumn("question", "Question checked", "text", 390, 240),
  clientColumn("engine", "Engine", "text", 130, 100),
  clientColumn("result", "Result", "text", 340, 240),
  clientColumn("fact", `Verified ${brandName()} fact`, "text", 700, 280),
  clientColumn("checked", "Checked", "date", 200, 160),
];

const probeKey = (row: ProbeEvidence) => row.key;

function factSortValue(row: ProbeEvidence, columnId: string): SortInput {
  if (columnId === "question") return row.prompt.trim() || null;
  if (columnId === "engine") return engineLabel(row.engine);
  if (columnId === "result") return PROBE_STATE_LABELS[row.state];
  if (columnId === "fact") return row.claim?.trim() || null;
  return row.checkedAt;
}

export function FactCheckTable({ rows, windowed = false }: { rows: ProbeEvidence[]; windowed?: boolean }) {
  const sorted = useClientTableSort(rows, COLUMNS, factSortValue, probeKey);
  const exportScope = useAiExportScope();
  const unit = windowed ? "selection" : "run";
  return (
    <div className="content-box ai-probe-table" style={{ marginTop: 12 }}>
      <div className="content-box-title">Every product fact check in this {unit}</div>
      {rows.length === 0 ? <EmptyRows>This {unit} sent no product fact checks.</EmptyRows> : null}
      {rows.length ? (
        <ResizableTable
          tableId="product-fact-checks"
          columns={COLUMNS}
          fillColumnId="fact"
          freezeHeader
          maxHeight={520}
          sort={sorted.sort}
          onSort={sorted.onSort}
          exportScope={exportScope}
        >
          <tbody>
            {sorted.rows.map((row) => (
              <tr key={row.key} data-probe-state={row.state} data-sim-id={row.simId}>
                <td>
                  <EvidenceLink
                    focus={{ field: "sim", value: row.callId ?? String(row.simId) }}
                    tab={AI_TABS.simulations}
                  >
                    {row.prompt}
                  </EvidenceLink>
                  {row.anchor ? (
                    <div data-ai-anchor="">
                      <span className="tag-badge tag-neutral">
                        <CopyTip label={ANCHOR_TITLE} description={ANCHOR_TIP}>
                          {ANCHOR_TITLE}
                        </CopyTip>
                      </span>
                    </div>
                  ) : null}
                </td>
                <td>
                  {engineLabel(row.engine)}
                  <div style={mutedText}>{modelLabel(row.model)}</div>
                </td>
                <td>
                  <AiStatusTag tone={tagToneOf(STATE_TONE[row.state])}>{PROBE_STATE_LABELS[row.state]}</AiStatusTag>
                </td>
                <td>
                  {row.claim ? (
                    <>
                      {row.claim} <ExternalLink href={row.sourceUrl}>{brandName()} source</ExternalLink>
                    </>
                  ) : (
                    "Not verified yet"
                  )}
                  {row.amazonDiffers ? (
                    <div data-ai-amazon-differs="">
                      <AiStatusTag tone="warning">
                        <CopyTip label={AMAZON_DIFFERS_TITLE} description={amazonDiffersTip(row.amazonValue, row.claim)}>
                          {AMAZON_DIFFERS_TITLE}
                        </CopyTip>
                      </AiStatusTag>
                    </div>
                  ) : null}
                  {row.evidence ? <div style={mutedText}>Conflicting text: {row.evidence}</div> : null}
                </td>
                <td>{formatRunTime(row.checkedAt)}</td>
              </tr>
            ))}
          </tbody>
        </ResizableTable>
      ) : null}
    </div>
  );
}
