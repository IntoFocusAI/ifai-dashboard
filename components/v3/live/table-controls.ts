"use client";

/**
 * What a table's sort hook tells its ResizableTable toolbar: the search box state, how many
 * rows match, and (for paged tables) every matching row's key in order.
 *
 * The hooks register this against the `onSort` they return. Every table already passes that
 * `onSort` to ResizableTable, so the toolbar finds its hook without each view wiring a prop.
 */
export type TableControls = {
  query: string;
  setQuery: (query: string) => void;
  /** Rows before the search. */
  total: number;
  /** Rows after the search. */
  matched: number;
  /** Every matching row's key in display order, when the table shows one page at a time. */
  orderedKeys: readonly string[] | null;
};

const registry = new WeakMap<object, TableControls>();

export function registerTableControls(onSort: object, controls: TableControls) {
  registry.set(onSort, controls);
}

export function tableControlsFor(onSort: object | undefined): TableControls | null {
  return onSort ? (registry.get(onSort) ?? null) : null;
}

/**
 * The key a dashboard row uses on screen: its ASIN, else its page URL. Null when the row has
 * neither, so the toolbar falls back to the keys in the table body.
 */
export function defaultRowKey(row: unknown): string | null {
  if (!row || typeof row !== "object") return null;
  const record = row as { asin?: unknown; url?: unknown };
  if (typeof record.asin === "string" && record.asin) return record.asin;
  if (typeof record.url === "string" && record.url) return record.url;
  return null;
}

export function orderedRowKeys(rows: readonly unknown[]): string[] | null {
  const keys: string[] = [];
  for (const row of rows) {
    const key = defaultRowKey(row);
    if (key == null) return null;
    keys.push(key);
  }
  return keys;
}

/** The key the caller wrote, from React's `Children.toArray` form (".$B0ABC", ".0:$https=2//…"). */
export function sourceRowKey(reactKey: string): string {
  const at = reactKey.indexOf("$");
  const raw = reactKey.startsWith(".") && at >= 0 ? reactKey.slice(at + 1) : reactKey;
  return raw.replace(/=([02])/g, (_, code: string) => (code === "2" ? ":" : "="));
}
