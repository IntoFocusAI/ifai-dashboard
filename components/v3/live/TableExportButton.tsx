"use client";

import { useState } from "react";
import { activeClientKey, CLIENT_PARAM } from "@/lib/client/active-client";

/** Downloads one table from its server route without leaving the dashboard. */
export function TableExportButton({
  table,
  query,
}: {
  table: string;
  query?: Record<string, string | undefined>;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onClick() {
    setMessage(null);
    setBusy(true);
    try {
      const params = new URLSearchParams();
      const client = activeClientKey();
      if (client !== "fender") params.set(CLIENT_PARAM, client);
      for (const [key, value] of Object.entries(query ?? {})) {
        if (value) params.set(key, value);
      }
      const search = params.toString();
      const response = await fetch(`/dashboard/export/${table}${search ? `?${search}` : ""}`);
      if (!response.ok) {
        setMessage((await response.text()) || "This table could not be exported.");
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const disposition = response.headers.get("content-disposition") ?? "";
      const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? `${table}.csv`;
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setMessage("This table could not be exported.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span data-table-export={table} style={{ display: "inline-flex", alignItems: "center", gap: 8, margin: "8px 0" }}>
      <button type="button" className="segmented-btn" onClick={() => void onClick()} disabled={busy}>
        Export
      </button>
      {message ? (
        <span className="retail-missing" data-table-export-error="">
          {message}
        </span>
      ) : null}
    </span>
  );
}
