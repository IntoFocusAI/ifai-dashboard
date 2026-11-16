"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { removeActuationItem, saveActuationItem } from "@/components/staff/actuation-actions";
import { formatDay } from "@/components/staff/ActuationScorePanel";
import { ResizableTable, type RetailColumn } from "@/components/v3/live/ResizableTable";
import { useClientTableSort } from "@/components/v3/live/useClientTableSort";
import type { ClientKey } from "@/lib/client/active-client";
import { ACTUATION_ITEMS_TABLE, FACTOR_LABELS, type StaffItemRow } from "@/lib/fender-canvas/actuation-records";
import { itemsInWindow, type ItemFactorId } from "@/lib/fender-canvas/actuation-score";
import type { SortInput } from "@/lib/fender-canvas/table-sort";

const COLUMNS: RetailColumn[] = [
  { id: "factor", name: "Factor", label: "Factor", width: 210, minWidth: 160, sort: "text" },
  { id: "url", name: "Link", label: "Link", width: 320, minWidth: 180, sort: "text" },
  { id: "domain", name: "Domain", label: "Domain", width: 150, minWidth: 110, sort: "text" },
  { id: "posted", name: "Posted", label: "Posted", width: 120, minWidth: 100, sort: "text" },
  { id: "verified", name: "Verified", label: "Verified", width: 200, minWidth: 140, sort: "text" },
  { id: "window", name: "Counts", label: "Counts", width: 120, minWidth: 100, sort: "text" },
  { id: "note", name: "Note", label: "Note", width: 200, minWidth: 120, sort: "text" },
  { id: "remove", name: "Remove", label: "", width: 90, minWidth: 80 },
];

function inWindow(row: StaffItemRow, today: string): boolean {
  return itemsInWindow([{ postedOn: row.posted_on, verifiedOn: row.verified_on }], today) === 1;
}

function LogForm({ client, today }: { client: ClientKey; today: string }) {
  const router = useRouter();
  const [factor, setFactor] = useState<ItemFactorId>("E2");
  const [url, setUrl] = useState("");
  const [postedOn, setPostedOn] = useState("");
  const [verifiedOn, setVerifiedOn] = useState(today);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await saveActuationItem({ client, factor, url, postedOn, verifiedOn, note });
      if (result.ok) {
        setUrl("");
        setNote("");
        setMessage({ error: false, text: "Logged." });
        router.refresh();
      } else setMessage({ error: true, text: result.message });
    } catch {
      setMessage({ error: true, text: "The item was not saved. Try again." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="actuation-log"
      data-actuation-log=""
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <label>
        <span>Factor</span>
        <select value={factor} onChange={(e) => setFactor(e.target.value as ItemFactorId)} data-actuation-log-factor="">
          <option value="E2">E2 {FACTOR_LABELS.E2}</option>
          <option value="E3">E3 {FACTOR_LABELS.E3}</option>
        </select>
      </label>
      <label className="actuation-log-url">
        <span>Link</span>
        <input type="url" required value={url} placeholder="https://" onChange={(e) => setUrl(e.target.value)} />
      </label>
      <label>
        <span>{factor === "E2" ? "Posted on" : "Published on"}</span>
        <input type="date" required max={today} value={postedOn} onChange={(e) => setPostedOn(e.target.value)} />
      </label>
      <label>
        <span>Verified on</span>
        <input type="date" required max={today} value={verifiedOn} onChange={(e) => setVerifiedOn(e.target.value)} />
      </label>
      <label className="actuation-log-note">
        <span>Staff note</span>
        <input value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
      </label>
      <button type="submit" className="sites-review-save" disabled={busy} data-actuation-log-save="">
        {busy ? "Saving…" : "Log item"}
      </button>
      {message ? (
        <p className={message.error ? "sites-review-row-error" : "actuation-muted"} role="status">
          {message.text}
        </p>
      ) : null}
    </form>
  );
}

function RemoveButton({ id, onDone }: { id: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  return (
    <span className="sites-review-choice">
      <button
        type="button"
        className="sites-review-save"
        disabled={busy}
        aria-label="Remove this item"
        onClick={async () => {
          setBusy(true);
          setError(false);
          const result = await removeActuationItem(id).catch(() => ({ ok: false as const, message: "" }));
          setBusy(false);
          if (result.ok) onDone();
          else setError(true);
        }}
      >
        {busy ? "Removing…" : "Remove"}
      </button>
      {error ? <span className="sites-review-row-error">Not removed.</span> : null}
    </span>
  );
}

export function ActuationItemsSection({
  client,
  items,
  today,
}: {
  client: ClientKey;
  items: StaffItemRow[];
  today: string;
}) {
  const router = useRouter();
  const sortValue = useCallback(
    (row: StaffItemRow, columnId: string): SortInput => {
      if (columnId === "factor") return row.factor;
      if (columnId === "url") return row.url;
      if (columnId === "domain") return row.domain;
      if (columnId === "posted") return row.posted_on;
      if (columnId === "verified") return row.verified_on;
      if (columnId === "window") return inWindow(row, today) ? "Yes" : "No";
      if (columnId === "note") return row.note;
      return null;
    },
    [today],
  );
  const keyOf = useCallback((row: StaffItemRow) => row.id, []);
  const sorted = useClientTableSort(items, COLUMNS, sortValue, keyOf);
  const counted = useMemo(() => items.filter((row) => inWindow(row, today)).length, [items, today]);

  return (
    <section className="actuation-section" aria-labelledby="actuation-items-title" data-actuation-items={items.length}>
      <h2 id="actuation-items-title">Logged work</h2>
      <p className="actuation-muted">
        {counted} of {items.length} logged items were posted in the last 90 days and count toward E2 and E3.
      </p>
      <LogForm client={client} today={today} />
      <ResizableTable
        tableId={ACTUATION_ITEMS_TABLE}
        columns={COLUMNS}
        fillColumnId="url"
        wrapColumnIds={["note"]}
        maxHeight={480}
        sort={sorted.sort}
        onSort={sorted.onSort}
        exportScope={null}
      >
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={COLUMNS.length}>No items logged yet.</td>
            </tr>
          ) : null}
          {sorted.rows.map((row) => (
            <tr key={row.id} data-actuation-item={row.factor}>
              <td>
                {row.factor} {FACTOR_LABELS[row.factor]}
              </td>
              <td>
                <a className="listing-link" href={row.url} target="_blank" rel="noopener noreferrer">
                  {row.url}
                </a>
              </td>
              <td>{row.domain}</td>
              <td>{formatDay(row.posted_on)}</td>
              <td>
                {formatDay(row.verified_on)}
                {row.verified_by_name ? ` by ${row.verified_by_name}` : ""}
              </td>
              <td>{inWindow(row, today) ? "Yes" : "No, older than 90 days"}</td>
              <td>{row.note ?? ""}</td>
              <td>
                <RemoveButton id={row.id} onDone={() => router.refresh()} />
              </td>
            </tr>
          ))}
        </tbody>
      </ResizableTable>
    </section>
  );
}
