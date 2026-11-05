import type { Classification, ClassifiedRow, DuplicateReason, ParsedSheet, StagedPayload } from "./types";

/**
 * Product key, most specific first. A header matches the word itself
 * (`sku`, `model_number`) or a longer header that ends in it (`product_sku`).
 */
const KEY_HEADERS = [
  "sku",
  "model_number",
  "part_number",
  "asin",
  "upc",
  "ean",
  "model",
  "item_number",
  "item",
  "product_id",
  "key",
] as const;

export function headerKey(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function normalizeKey(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function keyRank(header: string): number {
  const key = headerKey(header);
  for (let index = 0; index < KEY_HEADERS.length; index++) {
    const candidate = KEY_HEADERS[index];
    if (key === candidate || key.endsWith(`_${candidate}`)) return index;
  }
  return -1;
}

export function findKeyColumn(columns: string[]): { column: string; fromFirstColumn: boolean } {
  let best: { column: string; rank: number } | null = null;
  for (const column of columns) {
    const rank = keyRank(column);
    if (rank === -1) continue;
    if (!best || rank < best.rank) best = { column, rank };
  }
  if (best) return { column: best.column, fromFirstColumn: false };
  return { column: columns[0] ?? "", fromFirstColumn: true };
}

/**
 * The first row for a key can join the pending set. A later row with that key,
 * or a key already staged, is a duplicate and stays out.
 */
export function classifySheet(sheet: ParsedSheet, stagedKeys: Iterable<string>): Classification {
  const { column, fromFirstColumn } = findKeyColumn(sheet.columns);
  const staged = new Set<string>();
  for (const key of stagedKeys) {
    const normalized = normalizeKey(key);
    if (normalized) staged.add(normalized);
  }

  const seen = new Set<string>();
  const rows: ClassifiedRow[] = [];
  for (const row of sheet.rows) {
    const raw = (row.cells[column] ?? "").trim();
    const key = normalizeKey(raw);
    let disposition: ClassifiedRow["disposition"] = "pending";
    let duplicateReason: DuplicateReason | null = null;
    if (!key) {
      disposition = "missing_key";
    } else if (staged.has(key)) {
      disposition = "duplicate";
      duplicateReason = "staged";
    } else if (seen.has(key)) {
      disposition = "duplicate";
      duplicateReason = "in_file";
    } else {
      seen.add(key);
    }
    rows.push({ line: row.line, key: raw, cells: row.cells, disposition, duplicateReason });
  }

  return {
    keyColumn: column,
    keyFromFirstColumn: fromFirstColumn,
    rows,
    pending: rows.filter((row) => row.disposition === "pending"),
    duplicates: rows.filter((row) => row.disposition === "duplicate"),
    missingKey: rows.filter((row) => row.disposition === "missing_key"),
  };
}

export function toStagedPayload(sheet: ParsedSheet, classification: Classification): StagedPayload {
  const pending = classification.pending.map((row) => ({
    line: row.line,
    key: row.key,
    cells: row.cells,
  }));
  const duplicates = classification.duplicates.map((row) => ({
    line: row.line,
    key: row.key,
    reason: row.duplicateReason ?? "in_file",
    cells: row.cells,
  }));
  return { keyColumn: classification.keyColumn, columns: sheet.columns, pending, duplicates };
}

/** Keys that were accepted into a staged file. Duplicates stored beside them do not count. */
export function keysInPendingPayload(payload: unknown): string[] {
  if (!payload || typeof payload !== "object") return [];
  const pending = (payload as { pending?: unknown }).pending;
  if (!Array.isArray(pending)) return [];
  const keys: string[] = [];
  for (const row of pending) {
    if (!row || typeof row !== "object") continue;
    const key = (row as { key?: unknown }).key;
    if (typeof key === "string" && normalizeKey(key)) keys.push(key);
  }
  return keys;
}

export function pendingCount(payload: unknown): number {
  return keysInPendingPayload(payload).length;
}

export function rowSummary(total: number, pending: number, duplicates: number, missing: number): string {
  const rows = total === 1 ? "row" : "rows";
  const dup = duplicates === 1 ? "duplicate is" : "duplicates are";
  const base = `${pending} of ${total} ${rows} pending. ${duplicates} ${dup} kept out of the pending set.`;
  if (missing === 0) return base;
  const missingRows = missing === 1 ? "row has" : "rows have";
  return `${base} ${missing} ${missingRows} no key.`;
}

export function keyColumnSentence(column: string, fromFirstColumn: boolean): string {
  if (!fromFirstColumn) return `Key column: ${column}.`;
  return `Key column: ${column}. No SKU, model number, part number, or ASIN column was found, so this column is the key.`;
}
