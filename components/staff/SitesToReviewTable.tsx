"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { saveSiteType } from "@/components/staff/site-review-actions";
import { ResizableTable, type RetailColumn } from "@/components/v3/live/ResizableTable";
import { useClientTableSort } from "@/components/v3/live/useClientTableSort";
import {
  formatConfidence,
  SITE_TYPE_LABELS,
  SITES_TO_REVIEW_TABLE,
  type ReviewRow,
} from "@/lib/ai-search/site-review";
import { STORED_SITE_TYPES, type StoredSiteType } from "@/lib/ai-search/site-types";
import { CLIENTS, type ClientKey } from "@/lib/client/active-client";
import { formatInt } from "@/lib/fender-canvas/format";
import type { SortInput } from "@/lib/fender-canvas/table-sort";

const READ_ONLY_TIP =
  "Saving opens once the staff override function (supabase/migrations/20261112160000_site_type_staff_review.sql) is applied to the database. Until then this list is read only.";

/** Where the answers column counts from: the date-pill window, with or without the API engines. */
function answersTip(windowLabel: string, apiEngines: boolean): string {
  const engines = apiEngines ? "every engine" : "the search engines only (no API-engine answers were read for this window)";
  return `This client's AI answers in the date-pill window (${windowLabel}) that cite this site or one of its subdomains, from ${engines}. Shopping prompts and product fact checks.`;
}

const GLOBAL_TIP =
  "The classifier answered for this site once, for every client. Saving sets the type for every client, so the site leaves each client's list.";

function columnsFor(writable: boolean, answersTipText: string): RetailColumn[] {
  const columns: RetailColumn[] = [
    { id: "domain", name: "Site", label: "Site", width: 220, minWidth: 140, sort: "text" },
    { id: "type", name: "AI type", label: "AI type", width: 170, minWidth: 120, sort: "text" },
    { id: "confidence", name: "Confidence", label: "Confidence", width: 110, minWidth: 96, sort: "number" },
  ];
  if (writable) columns.push({ id: "reason", name: "Reason", label: "Reason", width: 320, minWidth: 180, sort: "text" });
  columns.push({
    id: "answers",
    name: "AI answers citing it",
    label: "AI answers citing it",
    width: 130,
    minWidth: 110,
    sort: "number",
    headerTooltip: { title: "AI answers citing it", description: answersTipText },
  });
  columns.push({ id: "choice", name: "Staff type", label: "Staff type", width: 280, minWidth: 240 });
  return columns;
}

function sortValue(row: ReviewRow, columnId: string): SortInput {
  if (columnId === "domain") return row.domain;
  if (columnId === "type") return SITE_TYPE_LABELS[row.siteType];
  if (columnId === "confidence") return row.confidence;
  if (columnId === "reason") return row.reason;
  if (columnId === "answers") return row.answers;
  return null;
}

function TypeChoice({
  row,
  client,
  writable,
  onSaved,
}: {
  row: ReviewRow;
  client: ClientKey;
  writable: boolean;
  onSaved: (domain: string) => void;
}) {
  const [value, setValue] = useState<StoredSiteType>(row.siteType);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = `Staff type for ${row.domain}`;

  const select = (
    <select
      className="sites-review-select"
      aria-label={label}
      value={value}
      disabled={!writable || busy}
      data-sites-review-select={row.domain}
      onChange={(event) => setValue(event.target.value as StoredSiteType)}
    >
      {STORED_SITE_TYPES.map((type) => (
        <option key={type} value={type}>
          {SITE_TYPE_LABELS[type]}
          {type === row.siteType ? " (AI)" : ""}
        </option>
      ))}
    </select>
  );

  if (!writable) {
    return (
      <span
        className="ifai-term sites-review-readonly"
        data-ifai-tooltip-title="Read only"
        data-ifai-tooltip-desc={READ_ONLY_TIP}
        tabIndex={0}
        aria-label={`Read only: ${READ_ONLY_TIP}`}
        data-sites-review-readonly=""
      >
        {select}
      </span>
    );
  }

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await saveSiteType({
        domain: row.domain,
        clientKey: CLIENTS[client].setAsideKey,
        siteType: value,
        isGlobal: row.isGlobal,
        aiType: row.siteType,
      });
      if (result.ok) onSaved(row.domain);
      else setError(result.message);
    } catch {
      setError("The site type was not saved. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="sites-review-choice">
      {select}
      <button
        type="button"
        className="sites-review-save"
        disabled={busy}
        data-sites-review-save={row.domain}
        onClick={() => void save()}
      >
        {busy ? "Saving…" : value === row.siteType ? "Confirm" : "Save"}
      </button>
      {row.isGlobal ? (
        <span
          className="ifai-term sites-review-scope"
          data-ifai-tooltip-title="Every client"
          data-ifai-tooltip-desc={GLOBAL_TIP}
          tabIndex={0}
          aria-label={`Every client: ${GLOBAL_TIP}`}
        >
          All clients
        </span>
      ) : null}
      {error ? (
        <span className="sites-review-row-error" role="status">
          {error}
        </span>
      ) : null}
    </span>
  );
}

function siteHref(domain: string): string {
  return `https://${domain}`;
}

export function SitesToReviewTable({
  client,
  rows,
  writable,
  windowLabel,
  apiEngines,
}: {
  client: ClientKey;
  rows: readonly ReviewRow[];
  writable: boolean;
  windowLabel: string;
  apiEngines: boolean;
}) {
  const router = useRouter();
  const [decided, setDecided] = useState<ReadonlySet<string>>(() => new Set());
  const shown = useMemo(() => rows.filter((row) => !decided.has(row.domain)), [rows, decided]);
  const columns = useMemo(
    () => columnsFor(writable, answersTip(windowLabel, apiEngines)),
    [writable, windowLabel, apiEngines],
  );
  const keyOf = useCallback((row: ReviewRow) => row.domain, []);
  const sorted = useClientTableSort(shown, columns, sortValue, keyOf);

  const onSaved = useCallback(
    (domain: string) => {
      setDecided((current) => new Set([...current, domain]));
      router.refresh();
    },
    [router],
  );

  return (
    <ResizableTable
      tableId={SITES_TO_REVIEW_TABLE}
      columns={columns}
      fillColumnId={writable ? "reason" : "domain"}
      wrapColumnIds={writable ? ["reason"] : []}
      maxHeight={560}
      sort={sorted.sort}
      onSort={sorted.onSort}
      exportScope={{}}
    >
      <tbody>
        {shown.length === 0 ? (
          <tr>
            <td colSpan={columns.length}>No sites need review for {CLIENTS[client].brandName}.</td>
          </tr>
        ) : null}
        {sorted.rows.map((row) => (
          <tr key={row.domain} data-sites-review-row={row.domain}>
            <td>
              <a className="listing-link" href={siteHref(row.domain)} target="_blank" rel="noopener noreferrer">
                {row.domain}
              </a>
            </td>
            <td>{SITE_TYPE_LABELS[row.siteType]}</td>
            <td className="money">{formatConfidence(row.confidence)}</td>
            {writable ? <td>{row.reason ?? ""}</td> : null}
            <td className="money">{formatInt(row.answers)}</td>
            <td>
              <TypeChoice row={row} client={client} writable={writable} onSaved={onSaved} />
            </td>
          </tr>
        ))}
      </tbody>
    </ResizableTable>
  );
}
