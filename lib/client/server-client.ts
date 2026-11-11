import { AsyncLocalStorage } from "node:async_hooks";
import { type ClientKey } from "@/lib/client/active-client";

const storage = new AsyncLocalStorage<ClientKey>();

(globalThis as { __ifaiServerClient?: { getStore(): ClientKey | undefined } }).__ifaiServerClient = storage;

/** Run a server export against one brand. The browser switcher is unchanged. */
export function runWithClient<T>(key: ClientKey, fn: () => Promise<T>): Promise<T> {
  return storage.run(key, fn);
}
