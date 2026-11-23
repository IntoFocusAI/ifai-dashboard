import { AsyncLocalStorage } from "node:async_hooks";

/* Server half of lib/supabase/viewer-token.ts. One store per process, shared through globalThis
   for the same reason as lib/client/server-client.ts: a build can load this module twice. */
type Holder = { __ifaiServerViewerToken?: AsyncLocalStorage<string | null> };
const holder = globalThis as Holder;
const storage = (holder.__ifaiServerViewerToken ??= new AsyncLocalStorage<string | null>());

/** Run server reads as the signed-in viewer, so row-level security applies to them. */
export function runWithViewerToken<T>(token: string | null, fn: () => Promise<T>): Promise<T> {
  return storage.run(token, fn);
}
