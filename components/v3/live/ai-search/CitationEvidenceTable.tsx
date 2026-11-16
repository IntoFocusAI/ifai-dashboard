"use client";

import { useState } from "react";
import { clientColumn, ResizableTable } from "@/components/v3/live/ResizableTable";
import { useClientTableSort } from "@/components/v3/live/useClientTableSort";
import { EmptyRows, mutedText } from "@/components/v3/live/ai-search/AiReadGate";
import { EvidenceLink } from "@/components/v3/live/ai-search/EvidenceLink";
import { ExternalLink } from "@/components/v3/live/ai-search/ExternalLink";
import { AI_TABS } from "@/lib/ai-search/canvas-surfaces";
import { SOURCE_CLASS_LABELS, type CitationEvidence } from "@/lib/ai-search/citations";
import { engineLabel, modelLabel } from "@/lib/ai-search/run-metrics";
import type { SortInput } from "@/lib/fender-canvas/table-sort";

const PAGE = 25;

/* Long prompts, links, and domains wrap inside their columns, so the table fits a 1280 px panel. */
const WRAP_COLUMNS = ["prompt", "engine", "link", "domain"] as const;

const COLUMNS = [
  clientColumn("prompt", "Prompt and answer", "text", 240, 140),
  clientColumn("engine", "Engine", "text", 130, 90),
  clientColumn("link", "Cited link", "text", 240, 140),
  clientColumn("domain", "Domain and class", "text", 160, 110),
];

const citationKey = (row: CitationEvidence) => row.key;

function citationSortValue(row: CitationEvidence, columnId: string): SortInput {
  if (columnId === "prompt") return row.prompt.trim() || null;
  if (columnId === "engine") return engineLabel(row.engine);
  if (columnId === "link") return (row.title ?? row.canonicalUrl).trim() || null;
  return `${row.domain} ${SOURCE_CLASS_LABELS[row.sourceClass]}`.trim() || null;
}

export function CitationEvidenceTable({
  rows,
  label,
  onClear,
  exportScope,
  narrowed = false,
}: {
  rows: CitationEvidence[];
  label: string;
  onClear?: () => void;
  /** What the tab shows, sent with Download CSV. Null hides the download. */
  exportScope?: Record<string, unknown> | null;
  /** A picked site, class, or answer group narrows these links; the download names it. */
  narrowed?: boolean;
}) {
  const [limit, setLimit] = useState(PAGE);
  const sorted = useClientTableSort(rows, COLUMNS, citationSortValue, citationKey);
  const shown = sorted.rows.slice(0, limit);
  return (
    <div className="content-box ai-citation-evidence" style={{ marginTop: 12 }}>
      <div className="content-box-title">
        <span>Cited links: {label}</span>
        <span className="tag-badge tag-neutral" data-ai-citation-count>{rows.length} links</span>
      </div>
      {onClear ? (
        <button type="button" className="segmented-btn" onClick={onClear} style={{ marginBottom: 6 }}>
          Show every cited link
        </button>
      ) : null}
      {rows.length === 0 ? <EmptyRows>No cited link matches this selection.</EmptyRows> : null}
      {rows.length ? (
        <ResizableTable
          tableId="citation-evidence"
          columns={COLUMNS}
          fillColumnId="link"
          wrapColumnIds={WRAP_COLUMNS}
          freezeHeader
          maxHeight={520}
          sort={sorted.sort}
          onSort={(columnId) => {
            setLimit(PAGE);
            sorted.onSort(columnId);
          }}
          controls={sorted.controls}
          exportScope={exportScope}
          filterLabel={narrowed ? `Cited links: ${label}` : null}
        >
          <tbody>
            {shown.map((row) => (
              <tr key={row.key} data-domain={row.domain} data-source-class={row.sourceClass}>
                <td style={{ wordBreak: "break-word" }}>
                  <EvidenceLink focus={{ field: "sim", value: row.simulationId }} tab={AI_TABS.simulations}>
                    {row.prompt}
                  </EvidenceLink>
                  <div style={mutedText}>Answer {row.simId}</div>
                </td>
                <td style={{ overflowWrap: "anywhere" }}>{engineLabel(row.engine)}<div style={mutedText}>{modelLabel(row.model)}</div></td>
                <td style={{ wordBreak: "break-all" }}>
                  <ExternalLink href={row.rawUrl}>{row.title ?? row.canonicalUrl}</ExternalLink>
                  <div style={mutedText}>Raw: {row.rawUrl}</div>
                  {row.canonicalUrl !== row.rawUrl ? <div style={mutedText}>Canonical: {row.canonicalUrl}</div> : null}
                </td>
                <td style={{ overflowWrap: "anywhere" }}>{row.domain}<div style={mutedText}>{SOURCE_CLASS_LABELS[row.sourceClass]}</div></td>
              </tr>
            ))}
          </tbody>
        </ResizableTable>
      ) : null}
      {sorted.rows.length > limit ? (
        <button type="button" className="segmented-btn" style={{ marginTop: 6 }} onClick={() => setLimit((n) => n + PAGE)}>
          Show {Math.min(PAGE, sorted.rows.length - limit)} more of {sorted.rows.length - limit}
        </button>
      ) : null}
    </div>
  );
}
