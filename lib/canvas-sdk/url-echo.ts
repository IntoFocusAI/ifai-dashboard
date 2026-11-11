/**
 * Queries the canvas wrote to the URL itself, oldest first, until the router reports
 * each one back. A query that comes back is an echo of state the canvas already holds,
 * so applying it again would undo anything the user changed while the write was in flight.
 */
export type UrlEchoes = {
  wrote(query: string): void;
  /** The newest write the router has not reported back yet. */
  latest(): string | null;
  /**
   * True for an echo; drops it and any older writes the router skipped past. Any other
   * query is a navigation of its own (Back, Forward, a link), which retires every write.
   */
  take(query: string): boolean;
};

export function createUrlEchoes(limit = 8): UrlEchoes {
  const pending: string[] = [];
  return {
    wrote(query) {
      pending.push(query);
      if (pending.length > limit) pending.splice(0, pending.length - limit);
    },
    latest() {
      return pending.at(-1) ?? null;
    },
    take(query) {
      const at = pending.indexOf(query);
      if (at < 0) {
        pending.length = 0;
        return false;
      }
      pending.splice(0, at + 1);
      return true;
    },
  };
}
