import { csvDocument, provenanceRows } from "@/lib/export/csv";
import type { ExportProvenance, ExportSource, ShownRequest } from "@/lib/export/types";
import { formatInt } from "@/lib/fender-canvas/format";
import { describeTableSearch } from "@/lib/fender-canvas/table-search";

const MAX_KEYS = 50_000;
const MAX_TEXT = 300;

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, MAX_TEXT);
  return trimmed || null;
}

/** Reads the POST body. Anything malformed becomes "every row, read order". */
export function parseShownRequest(body: unknown): ShownRequest {
  const input = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const keys = Array.isArray(input.keys)
    ? input.keys.filter((key): key is string => typeof key === "string").slice(0, MAX_KEYS)
    : null;
  return {
    keys,
    search: text(input.search) ?? "",
    sort: text(input.sort),
    filter: text(input.filter),
    scope: scopeOf(input.scope),
  };
}

const MAX_SCOPE_CHARS = 4000;

/** A small plain object, or null. Each loader validates the fields it reads. */
function scopeOf(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  try {
    return JSON.stringify(value).length <= MAX_SCOPE_CHARS ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function sentence(value: string): string {
  return /[.!?]$/.test(value) ? value : `${value}.`;
}

/** Status cell per row key, or "failed" when the set-aside read failed. */
export type StatusCells = ReadonlyMap<string, string> | "failed";

/**
 * The CSV of what the table showed: the rows whose keys the browser sent, in that order,
 * with the filter, sort, as-of time, and population sentence ahead of the header.
 */
export function shownCsv(source: ExportSource, request: ShownRequest, status: StatusCells | null): string {
  const byKey = new Map(source.rows.map((row) => [row.key, row]));
  const picked = request.keys
    ? request.keys.flatMap((key) => {
        const row = byKey.get(key);
        if (!row) return [];
        byKey.delete(key);
        return [row];
      })
    : source.rows;

  const filters = [source.filter, request.filter, describeTableSearch(request.search)]
    .filter((part): part is string => Boolean(part))
    .map(sentence);
  const narrowed = picked.length < source.rows.length;
  if (narrowed && !request.filter && !request.search) filters.push("Filtered on screen.");
  const shown = narrowed
    ? ` This file holds ${formatInt(picked.length)} of ${formatInt(source.rows.length)} rows.`
    : "";
  const provenance: ExportProvenance = {
    filter: filters.length ? filters.join(" ") : "No filter.",
    sort: sentence(request.sort ?? source.sort),
    asOf: source.asOf,
    population: `${sentence(source.population)}${shown}`,
  };

  const header = status ? [...source.header, "Status"] : source.header;
  const body = picked.map((row) => {
    if (!status) return row.cells;
    const cell = status === "failed" ? "Not available*" : (status.get(row.key) ?? "");
    return [...row.cells, cell];
  });
  const notes: string[][] =
    status === "failed" ? [["Status", "Not available*. The Done and set-aside read failed."]] : [];
  return csvDocument([...provenanceRows(provenance), ...notes, header, ...body]);
}
