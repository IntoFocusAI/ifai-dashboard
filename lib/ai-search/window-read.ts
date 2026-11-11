/**
 * A live date window reads every stored run in scope, a window holding one run included.
 * Only an empty window, or the sample fixtures, resolve without a database read.
 */
export function readsWindowRemotely(source: "live" | "fixture", runsInScope: number): boolean {
  return source === "live" && runsInScope > 0;
}
