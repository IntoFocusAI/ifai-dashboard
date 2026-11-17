import { AsyncLocalStorage } from "node:async_hooks";
import { type ClientKey } from "@/lib/client/active-client";

type Holder = { __ifaiServerClient?: AsyncLocalStorage<ClientKey> };

/* One store per server process. A production build can load this module more than once (the
   export route and the Sites to review page are separate bundles). Each copy used to make its own
   store and overwrite the global one that activeClient() reads, so after the page loaded, the
   route's runWithClient wrote to a store nobody read and every export fell back to Fender's rows.
   Every copy now reuses the first store. */
const holder = globalThis as Holder;
const storage = (holder.__ifaiServerClient ??= new AsyncLocalStorage<ClientKey>());

/** Run a server export against one brand. The browser switcher is unchanged. */
export function runWithClient<T>(key: ClientKey, fn: () => Promise<T>): Promise<T> {
  return storage.run(key, fn);
}
