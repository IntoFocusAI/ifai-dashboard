"use client";

import { Children, cloneElement, isValidElement, useState, type ReactElement, type ReactNode } from "react";
import { formatInt } from "@/lib/fender-canvas/format";
import {
  TABLE_ROW_STEP,
  initialRowLimit,
  nextRowLimit,
  rowsShown,
  sameRowKeys,
  type RowLimitState,
} from "@/lib/fender-canvas/table-row-limit";

type BodyElement = ReactElement<{ children?: ReactNode }>;

function isBody(node: ReactNode): node is BodyElement {
  return isValidElement(node) && node.type === "tbody";
}

/**
 * Draws the first rows of the table body. The caller still sorts and filters every row,
 * so "Show more" reveals the next rows of the same order.
 */
export function useTableRowLimit(children: ReactNode): { children: ReactNode; footer: ReactNode } {
  const parts = Children.toArray(children);
  const bodyIndex = parts.findIndex(isBody);
  const body = bodyIndex >= 0 ? (parts[bodyIndex] as BodyElement) : null;
  const rows = body ? Children.toArray(body.props.children) : [];
  const keys = rows.map((row, index) => (isValidElement(row) && row.key != null ? String(row.key) : `#${index}`));
  const [state, setState] = useState<RowLimitState>(initialRowLimit);
  let limit = state.limit;
  if (!sameRowKeys(state.keys, keys)) {
    limit = nextRowLimit(state, keys);
    setState({ limit, keys });
  }
  if (!body) return { children, footer: null };

  const total = rows.length;
  const shown = rowsShown(limit, total);
  const limited = [...parts];
  limited[bodyIndex] = cloneElement(body, undefined, shown < total ? rows.slice(0, shown) : rows);
  if (shown >= total) return { children: limited, footer: null };

  const more = Math.min(TABLE_ROW_STEP, total - shown);
  const footer = (
    <div
      className="table-row-limit"
      data-table-row-limit
      data-rows-shown={shown}
      data-rows-total={total}
      style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 8 }}
    >
      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
        Showing {formatInt(shown)} of {formatInt(total)} rows
      </span>
      <button
        type="button"
        className="segmented-btn"
        data-table-show-more
        onClick={() => setState((current) => ({ ...current, limit: rowsShown(current.limit, total) + TABLE_ROW_STEP }))}
      >
        Show {formatInt(more)} more
      </button>
      <button
        type="button"
        className="segmented-btn"
        data-table-show-all
        onClick={() => setState((current) => ({ ...current, limit: Number.POSITIVE_INFINITY }))}
      >
        Show all {formatInt(total)}
      </button>
    </div>
  );
  return { children: limited, footer };
}
