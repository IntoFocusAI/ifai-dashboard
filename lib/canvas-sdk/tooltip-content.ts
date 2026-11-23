export type TooltipAnchor = "cursor" | "column-right" | "definition";

/** One line of a list tooltip. A `bad` line reads in the Oxblood status color with its x mark. */
export type TooltipRow = { text: string; bad?: boolean };

export type TooltipContent = {
  title: string;
  desc: string;
  hasMoreInfo: boolean;
  anchor: TooltipAnchor;
  example?: boolean;
  /** Lines shown in place of `desc`, one per row. `desc` stays the plain-text reading. */
  rows?: TooltipRow[];
};

/** Attribute that carries a definition mark's tooltip rows as JSON. */
export const TOOLTIP_ROWS_ATTR = "data-ifai-tooltip-rows";

/** Rows from the attribute's JSON. Anything that is not a list of text rows reads as none. */
export function parseTooltipRows(raw: string | null | undefined): TooltipRow[] | undefined {
  if (!raw) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return undefined;
    const rows = parsed
      .filter((row): row is { text: string; bad?: unknown } => Boolean(row) && typeof (row as { text?: unknown }).text === "string")
      .map((row) => (row.bad === true ? { text: row.text, bad: true } : { text: row.text }));
    return rows.length ? rows : undefined;
  } catch {
    return undefined;
  }
}

function sameRows(a: TooltipRow[] | undefined, b: TooltipRow[] | undefined) {
  const left = a ?? [];
  const right = b ?? [];
  return left.length === right.length && left.every((row, index) => row.text === right[index].text && Boolean(row.bad) === Boolean(right[index].bad));
}

/** True when two tooltips would render the same box, so a pointer move need not re-render it. */
export function sameTooltipContent(a: TooltipContent | null, b: TooltipContent | null) {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.title === b.title &&
    a.desc === b.desc &&
    a.hasMoreInfo === b.hasMoreInfo &&
    a.anchor === b.anchor &&
    Boolean(a.example) === Boolean(b.example) &&
    sameRows(a.rows, b.rows)
  );
}
