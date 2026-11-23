/* Which client brand the dashboard shows.

   The client list comes from the settings files in data/clients/ (lib/client/registry.ts).
   Testing switcher until login ships: the `client` query parameter picks the brand
   (`?client=ledlenser`). No parameter means the client whose settings set is_default.
   Each client's data lives in its own database schema, so a page only ever reads one brand.

   The choice is read once per page load and then fixed. Switching brands is a full page load
   (see clientHref), so no screen can mix two brands' data. Every accessor reads the client per
   call, never at import, so a server export can set the client per request. */

import { clientRegistry } from "./registry";
import type { ClientSettings } from "./settings-schema";

/**
 * A client_key from data/clients/. Any string typed as ClientKey must come from isClientKey,
 * parseClientKey, listClientKeys or activeClientKey, which check it against the settings files.
 */
export type ClientKey = string;

/** The settings record in the camelCase shape the screens already read. */
export type ClientProfile = {
  key: ClientKey;
  /** Brand name as it reads in copy: "Fender", "Ledlenser". */
  brandName: string;
  /** Database schema that holds this client's canvas_* views. */
  schema: string;
  /** client_key in public.issue_set_asides. */
  setAsideKey: string;
  /** White logo for the dark Summary bubble. Null shows the brand name. */
  logoSrc: string | null;
  /** Brand-owned sites, for "brand-owned" citation and page checks. */
  brandSiteDomains: string[];
  /** Short label for the brand's own website: "fender.com". */
  brandSiteLabel: string;
  /** Staff can write this client's list from Build prompts. The Prompts screen is view-only for every client (decision 99). */
  promptsEditable: boolean;
  /** Who is meant to hold the Amazon Buy Box. Partner-led: Amazon and named dealers. Brand-led: the brand's own seller accounts. */
  sellerModel: "Partner-led" | "Brand-led";
  /** Dealers counted as controlled Buy Box until the viewer saves their own list (partner-led only). */
  defaultBuyBoxPartners: readonly string[];
  /**
   * Roadmap and Action Items focus, set by IntoFocus staff (Brian, 11 Nov 2026; no client control).
   * Null plans for the whole brand. A stored question category key (the `category` on AI Search
   * calls, e.g. "acoustics") narrows the plan to that category plus the brand-wide items.
   */
  roadmapFocusCategory: string | null;
  /** The full settings record. */
  settings: ClientSettings;
};

export const CLIENT_PARAM = "client";

function profileFrom(settings: ClientSettings): ClientProfile {
  return {
    key: settings.client_key,
    brandName: settings.display_name,
    schema: settings.data_schema,
    setAsideKey: settings.set_aside_key,
    logoSrc: settings.logo_src,
    brandSiteDomains: settings.owned_domains,
    brandSiteLabel: settings.brand_site_label,
    promptsEditable: settings.prompts_editable,
    sellerModel: settings.seller_type === "partner_led" ? "Partner-led" : "Brand-led",
    defaultBuyBoxPartners: settings.default_authorized_partners,
    roadmapFocusCategory: settings.roadmap_focus_category,
    settings,
  };
}

/** Every client's settings record, in switcher order. */
export function listClients(): readonly ClientSettings[] {
  return clientRegistry();
}

/** Every client key, in switcher order. */
export function listClientKeys(): ClientKey[] {
  return clientRegistry().map((c) => c.client_key);
}

export function isClientKey(value: unknown): value is ClientKey {
  return typeof value === "string" && clientRegistry().some((c) => c.client_key === value);
}

/** The client shown with no ?client= parameter. */
export function defaultClientKey(): ClientKey {
  return clientRegistry().find((c) => c.is_default)!.client_key;
}

/** A known client key, or the default client for anything else (missing, misspelled, unknown). */
export function parseClientKey(value: unknown): ClientKey {
  return isClientKey(value) ? value : defaultClientKey();
}

/** One client's settings record. Throws for a key that is not in data/clients/. */
export function getClientSettings(key: ClientKey): ClientSettings {
  const settings = clientRegistry().find((c) => c.client_key === key);
  if (!settings) throw new Error(`Unknown client "${key}". Known clients: ${listClientKeys().join(", ")}.`);
  return settings;
}

/** One client's profile. Throws for a key that is not in data/clients/. */
export function clientProfile(key: ClientKey): ClientProfile {
  return profileFrom(getClientSettings(key));
}

/** The client for one set_aside_key ("fmic"), or null. */
export function clientKeyForSetAsideKey(setAsideKey: string): ClientKey | null {
  return clientRegistry().find((c) => c.set_aside_key === setAsideKey)?.client_key ?? null;
}

export function clientKeyFromSearch(search: string): ClientKey {
  return parseClientKey(new URLSearchParams(search).get(CLIENT_PARAM));
}

let resolved: ClientKey | null = null;

type ServerClientStore = { getStore(): ClientKey | undefined };

/** Set by the server export route for the length of one request. Absent in the browser. */
function serverClientKey(): ClientKey | undefined {
  const store = (globalThis as { __ifaiServerClient?: ServerClientStore }).__ifaiServerClient;
  const key = store?.getStore();
  return isClientKey(key) ? key : undefined;
}

/** The brand for this page load. The default client on the server and in tests, unless a request set one. */
export function activeClientKey(): ClientKey {
  const fromServer = serverClientKey();
  if (fromServer) return fromServer;
  if (resolved) return resolved;
  if (typeof window === "undefined") return defaultClientKey();
  resolved = clientKeyFromSearch(window.location.search);
  return resolved;
}

export function activeClient(): ClientProfile {
  return clientProfile(activeClientKey());
}

/** The settings record for the brand on screen. */
export function activeClientSettings(): ClientSettings {
  return getClientSettings(activeClientKey());
}

/** Brand name for copy: "Fender" or "Ledlenser". */
export function brandName(): string {
  return activeClientSettings().display_name;
}

/**
 * Browser storage key for the brand on screen. The default client keeps its existing keys
 * (written with "fender" in them); other brands get their own, so saved choices never cross brands.
 */
export function clientStorageKey(fenderKey: string): string {
  const key = activeClientKey();
  if (key === defaultClientKey()) return fenderKey;
  return fenderKey.includes("fender") ? fenderKey.replace("fender", key) : `${fenderKey}:${key}`;
}

/** Dashboard URL for another client. Drops open panels, which belong to the old brand. */
export function clientHref(key: ClientKey, pathname: string): string {
  if (key === defaultClientKey()) return pathname;
  const params = new URLSearchParams();
  params.set(CLIENT_PARAM, key);
  return `${pathname}?${params.toString()}`;
}

/** Test hook: forget the resolved client. */
export function resetActiveClientForTests(key: ClientKey | null = null): void {
  resolved = key;
}
