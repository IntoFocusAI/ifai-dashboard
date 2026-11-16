/**
 * Persisted column widths for Portfolio Retail tables.
 * Each table has its own storage key, so a resize in one table cannot change another.
 */

export const COLUMN_WIDTH_STORAGE_PREFIX = "ifai.retail.columns.";

export type ColumnWidthSpec = {
  id: string;
  width: number;
  minWidth?: number;
};

/**
 * Listing column in the wide MAP table at 1440×900, before this cap.
 * The default below is about 60% of that measured width.
 */
export const MAP_LISTING_COLUMN_MEASURED_WIDTH = 238;
export const MAP_LISTING_COLUMN_WIDTH = 144;

export function columnWidthStorageKey(tableId: string): string {
  return `${COLUMN_WIDTH_STORAGE_PREFIX}${tableId}`;
}

export function mergeColumnWidths(
  columns: readonly ColumnWidthSpec[],
  raw: unknown,
): Record<string, number> {
  const next: Record<string, number> = {};
  for (const column of columns) next[column.id] = column.width;
  if (!raw || typeof raw !== "object") return next;
  const stored = raw as Record<string, unknown>;
  for (const column of columns) {
    const value = stored[column.id];
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    next[column.id] = Math.max(column.minWidth ?? 72, Math.round(value));
  }
  return next;
}

/**
 * Raises each column's minimum, and its default width, to the header floor, so a fit or a
 * saved width never breaks a header inside a word. A saved width above the floor is kept.
 */
export function withHeaderFloors<T extends ColumnWidthSpec>(
  columns: readonly T[],
  floors: Readonly<Record<string, number>>,
): T[] {
  return columns.map((column) => {
    const floor = floors[column.id];
    if (typeof floor !== "number" || !Number.isFinite(floor)) return column;
    const minWidth = Math.ceil(floor);
    if (minWidth <= (column.minWidth ?? 72)) return column;
    return { ...column, minWidth, width: Math.max(column.width, minWidth) };
  });
}

function hasStoredWidth(columns: readonly ColumnWidthSpec[], raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false;
  const stored = raw as Record<string, unknown>;
  return columns.some((column) => typeof stored[column.id] === "number" && Number.isFinite(stored[column.id]));
}

/**
 * Column that absorbs leftover panel width when the caller does not name one.
 * Prefer the first column (prompt, question, listing, …) so long prose wraps there
 * while later short labels and badges keep one-line content floors.
 */
export function pickFillColumnId(
  columns: readonly ColumnWidthSpec[],
  preferred?: string,
): string {
  if (preferred && columns.some((column) => column.id === preferred)) return preferred;
  return columns[0]?.id ?? "";
}

/**
 * Default widths that fill the panel. One column absorbs leftover space.
 * Optional content floors size the other columns so short values stay on one line
 * (they may shrink below the declared width down to minWidth).
 * The fill column takes the remaining panel width and may wrap.
 * A stored resize wins.
 */
export function filledColumnWidths(
  columns: readonly ColumnWidthSpec[],
  fillColumnId: string,
  containerWidth: number,
  stored?: unknown,
  contentMins?: Record<string, number>,
): Record<string, number> {
  const base = mergeColumnWidths(columns, stored ?? null);
  if (hasStoredWidth(columns, stored) || containerWidth <= 0) return base;
  const fillColumn = columns.find((column) => column.id === fillColumnId);
  if (!fillColumn) return base;

  const next = { ...base };
  for (const column of columns) {
    if (column.id === fillColumnId) continue;
    const contentMin = contentMins?.[column.id];
    if (typeof contentMin !== "number" || !Number.isFinite(contentMin) || contentMin <= 0) continue;
    next[column.id] = Math.max(column.minWidth ?? 72, Math.ceil(contentMin));
  }

  const others = columns.reduce(
    (sum, column) => (column.id === fillColumnId ? sum : sum + next[column.id]),
    0,
  );
  const room = Math.floor(containerWidth) - others;
  return {
    ...next,
    // Grow-only vs the declared fill width. Callers that need the fill column
    // to shrink into leftover panel space use fitResizableColumnWidths.
    [fillColumnId]: Math.max(next[fillColumnId], room),
  };
}

/**
 * Shared ResizableTable default: fill the panel, keep short cells on one line,
 * and let an explicit fill column or the widest declared column take the leftover.
 * Unlike filledColumnWidths alone, the fill column may shrink below its declared
 * width down to minWidth so the row matches the panel.
 */
export function fitResizableColumnWidths(
  columns: readonly ColumnWidthSpec[],
  containerWidth: number,
  options?: {
    fillColumnId?: string;
    stored?: unknown;
    contentMins?: Record<string, number>;
    /** Per column, the narrowest width that still breaks body cells only between words. */
    wordMins?: Record<string, number>;
  },
): Record<string, number> {
  const fillId = pickFillColumnId(columns, options?.fillColumnId);
  const fitted = filledColumnWidths(
    columns,
    fillId,
    containerWidth,
    options?.stored,
    options?.contentMins,
  );
  if (hasStoredWidth(columns, options?.stored) || containerWidth <= 0) return fitted;
  const fill = columns.find((column) => column.id === fillId);
  if (!fill) return fitted;
  const others = columns.reduce(
    (sum, column) => (column.id === fillId ? sum : sum + fitted[column.id]),
    0,
  );
  const room = Math.floor(containerWidth) - others;
  return shrinkToPanel(
    columns,
    { ...fitted, [fillId]: Math.max(fill.minWidth ?? 72, room) },
    containerWidth,
    options?.wordMins,
  );
}

/**
 * When one-line cells make the row wider than the panel (a narrower window, a browser
 * scrollbar, wider system fonts), every column gives width back toward its floor, in
 * proportion to what it has above it, so cells wrap between words instead of the table
 * scrolling sideways. The floor is the column's minimum (header word floor included) or
 * its widest body word, whichever is larger. A row that already fits is returned unchanged.
 */
export function shrinkToPanel(
  columns: readonly ColumnWidthSpec[],
  widths: Record<string, number>,
  containerWidth: number,
  wordMins?: Record<string, number>,
): Record<string, number> {
  const target = Math.floor(containerWidth);
  const widthOf = (column: ColumnWidthSpec) => widths[column.id] ?? column.width;
  const total = columns.reduce((sum, column) => sum + widthOf(column), 0);
  if (target <= 0 || total <= target) return widths;
  const give: Record<string, number> = {};
  let slack = 0;
  for (const column of columns) {
    const word = wordMins?.[column.id];
    const wordFloor = typeof word === "number" && Number.isFinite(word) ? Math.ceil(word) : 0;
    give[column.id] = Math.max(0, widthOf(column) - Math.max(column.minWidth ?? 72, wordFloor));
    slack += give[column.id];
  }
  if (slack <= 0) return widths;
  const take = Math.min(total - target, slack);
  const next = { ...widths };
  let taken = 0;
  for (const column of columns) {
    const share = Math.floor((take * give[column.id]) / slack);
    next[column.id] = widthOf(column) - share;
    give[column.id] -= share;
    taken += share;
  }
  // Rounding leaves fewer pixels than there are giving columns: one more each, in order.
  for (const column of columns) {
    if (taken >= take) break;
    if (give[column.id] <= 0) continue;
    next[column.id] -= 1;
    taken += 1;
  }
  return next;
}
