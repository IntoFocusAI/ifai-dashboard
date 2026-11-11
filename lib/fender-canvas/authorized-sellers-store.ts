"use client";

import { useSyncExternalStore } from "react";
import {
  reviveAuthorizedSellers,
  type AuthorizedSellerSave,
} from "@/lib/fender-canvas/authorized-sellers";
import { createLocalStore } from "@/lib/canvas-sdk/local-store";
import { clientStorageKey } from "@/lib/client/active-client";

/** Per-viewer list. Another browser keeps the placeholder until someone saves there. */
export const AUTHORIZED_SELLERS_STORAGE_KEY = "ifai:fender:authorized-buy-box-sellers";

const store = createLocalStore<AuthorizedSellerSave | null>(
  clientStorageKey(AUTHORIZED_SELLERS_STORAGE_KEY),
  null,
  reviveAuthorizedSellers,
);

/**
 * One store so Retail Overview and the Controlled Buy Box score share a save.
 * The empty value is "not saved". { sellers: [] } is a save of Amazon Retail only.
 */
export function useAuthorizedSellers(): [
  AuthorizedSellerSave | null,
  (next: AuthorizedSellerSave) => void,
] {
  const value = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  return [value, store.set];
}
