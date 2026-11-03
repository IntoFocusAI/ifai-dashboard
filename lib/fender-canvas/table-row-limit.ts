/** Rows a table draws at first, and how many each "Show more" adds. */
export const TABLE_ROW_STEP = 25;

export type RowLimitState = {
  /** Rows allowed on screen. Infinity after "Show all". */
  limit: number;
  /** Row keys from the last render, in order. */
  keys: readonly string[];
};

export function initialRowLimit(step = TABLE_ROW_STEP): RowLimitState {
  return { limit: step, keys: [] };
}

export function sameRowKeys(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index += 1) if (a[index] !== b[index]) return false;
  return true;
}

function startsWith(keys: readonly string[], prefix: readonly string[], length: number): boolean {
  if (keys.length < length) return false;
  for (let index = 0; index < length; index += 1) if (keys[index] !== prefix[index]) return false;
  return true;
}

/**
 * Limit for the next set of row keys.
 * A new sort, filter, or data set changes the leading rows, so the table opens on its first rows again.
 * A table that adds its own rows a step at a time (nothing was hidden, and it grew by one step
 * or less) keeps every row it asked for, so its own "Show more" still works.
 */
export function nextRowLimit(prev: RowLimitState, keys: readonly string[], step = TABLE_ROW_STEP): number {
  const shownBefore = Math.min(prev.limit, prev.keys.length);
  if (!startsWith(keys, prev.keys, shownBefore)) return step;
  const nothingHidden = prev.keys.length <= prev.limit;
  const grew = keys.length - prev.keys.length;
  const appended = grew > 0 && grew <= step && startsWith(keys, prev.keys, prev.keys.length);
  if (nothingHidden && prev.keys.length >= step && appended) return Math.max(prev.limit, keys.length);
  return prev.limit;
}

export function rowsShown(limit: number, total: number): number {
  return Math.min(limit, total);
}
