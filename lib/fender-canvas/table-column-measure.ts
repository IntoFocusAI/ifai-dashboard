/**
 * One-line content floors for ResizableTable columns.
 * Body floors measure at the canvas root, so a panel's larger cell font still wraps a long
 * value instead of widening the table. Header floors measure beside the table, in the
 * panel's own header font, because a header must never break inside a word.
 */

const MEASURE_MAX_BODY_ROWS = 48;

function probeFor(cell: HTMLElement, tableClass: string, tableStyle: string): { probe: HTMLTableElement; clone: HTMLElement } {
  const probe = document.createElement("table");
  probe.className = tableClass;
  probe.style.cssText = tableStyle;
  const section = document.createElement(cell.closest("thead") ? "thead" : "tbody");
  const row = document.createElement("tr");
  const clone = cell.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(".col-resize-handle").forEach((node) => node.remove());
  row.appendChild(clone);
  section.appendChild(row);
  probe.appendChild(section);
  return { probe, clone };
}

/**
 * Width needed for the cell's contents on one line, including cell padding.
 * Block children (e.g. engine + model) still stack; width is the widest line.
 */
function measureCellOneLineWidth(cell: HTMLElement, host: HTMLElement, tableClass: string): number {
  const { probe, clone } = probeFor(cell, tableClass, "table-layout:auto;width:max-content;border-collapse:separate;");
  clone.style.cssText = "white-space:nowrap;width:auto;max-width:none;overflow:visible;";
  clone.querySelectorAll<HTMLElement>("*").forEach((node) => {
    if (node.classList.contains("tag-badge")) {
      node.style.whiteSpace = "nowrap";
      node.style.maxWidth = "none";
    }
  });
  host.replaceChildren(probe);
  return Math.ceil(clone.getBoundingClientRect().width);
}

/** Narrowest width at which the cell breaks only between words, including cell padding. */
function measureCellWordWidth(cell: HTMLElement, host: HTMLElement, tableClass: string): number {
  const { probe, clone } = probeFor(cell, tableClass, "table-layout:auto;width:1px;border-collapse:separate;");
  const words = "white-space:normal;overflow-wrap:normal;word-break:normal;";
  clone.style.cssText = `${words}width:auto;min-width:0;max-width:none;overflow:visible;`;
  clone.querySelectorAll<HTMLElement>("*").forEach((node) => {
    node.style.overflowWrap = "normal";
    node.style.wordBreak = "normal";
  });
  host.replaceChildren(probe);
  return Math.ceil(clone.getBoundingClientRect().width);
}

function withProbeHost<T>(table: HTMLTableElement, beside: boolean, measure: (host: HTMLElement) => T): T {
  const canvas = table.closest(".ifai-canvas") ?? document.body;
  const root = beside ? (table.parentElement ?? canvas) : canvas;
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText =
    "position:absolute;left:-99999px;top:0;visibility:hidden;pointer-events:none;contain:layout style;";
  root.appendChild(host);
  try {
    return measure(host);
  } finally {
    host.remove();
  }
}

/**
 * Minimum pixel width per column so typical cells stay on one line.
 * Skip the fill column and any wrap columns: those may wrap into leftover width.
 */
export function measureColumnOneLineMins(
  table: HTMLTableElement,
  columnIds: readonly string[],
  skipColumnId?: string | readonly string[],
): Record<string, number> {
  const mins: Record<string, number> = {};
  for (const id of columnIds) mins[id] = 0;
  if (typeof document === "undefined" || columnIds.length === 0) return mins;
  const skip = new Set(
    typeof skipColumnId === "string"
      ? skipColumnId
        ? [skipColumnId]
        : []
      : (skipColumnId ?? []),
  );

  withProbeHost(table, false, (host) => {
    let bodySeen = 0;
    for (const row of Array.from(table.rows)) {
      const inBody = row.parentElement?.tagName === "TBODY";
      if (inBody) {
        if (bodySeen >= MEASURE_MAX_BODY_ROWS) continue;
        bodySeen += 1;
      }
      const cells = Array.from(row.cells);
      for (let index = 0; index < cells.length && index < columnIds.length; index += 1) {
        const id = columnIds[index];
        if (!id || skip.has(id)) continue;
        const cell = cells[index];
        if (!cell || cell.colSpan !== 1) continue;
        mins[id] = Math.max(mins[id], measureCellOneLineWidth(cell, host, table.className));
      }
    }
  });
  return mins;
}

/**
 * Per column, the narrowest width at which its header still breaks only between words.
 * Every column is measured, fill and wrap columns included, and a saved width is floored here.
 */
export function measureHeaderWordMins(table: HTMLTableElement, columnIds: readonly string[]): Record<string, number> {
  const mins: Record<string, number> = {};
  const header = table.tHead?.rows[0];
  if (typeof document === "undefined" || !header) return mins;
  withProbeHost(table, true, (host) => {
    Array.from(header.cells).forEach((cell, index) => {
      const id = columnIds[index];
      if (!id || cell.colSpan !== 1) return;
      mins[id] = measureCellWordWidth(cell, host, table.className);
    });
  });
  return mins;
}
