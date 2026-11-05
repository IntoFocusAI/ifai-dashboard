/* Which client brand the dashboard shows.

   Testing switcher until login ships: the `client` query parameter picks the
   brand (`?client=ledlenser`). No parameter means Fender. Each client's data
   lives in its own database schema, so a page only ever reads one brand.

   The choice is read once per page load and then fixed. Switching brands is a
   full page load (see clientHref), so no screen can mix two brands' data. */

export type ClientKey = "fender" | "ledlenser";

export type ClientProfile = {
  key: ClientKey;
  /** Brand name as it reads in copy: "Fender", "Ledlenser". */
  brandName: string;
  /** Database schema that holds this client's canvas_* views. */
  schema: "public" | "ledlenser";
  /** client_key in public.issue_set_asides. */
  setAsideKey: string;
  /** White logo for the dark Summary bubble. Null shows the brand name. */
  logoSrc: string | null;
  /** Brand-owned sites, for "brand-owned" citation and page checks. */
  brandSiteDomains: string[];
  /** Short label for the brand's own website: "fender.com". */
  brandSiteLabel: string;
  /** The AI prompt editor writes Fender's prompt list only. */
  promptsEditable: boolean;
  /** Who is meant to hold the Amazon Buy Box. Partner-led: Amazon and named dealers. Brand-led: the brand's own seller accounts. */
  sellerModel: "Partner-led" | "Brand-led";
  /** Dealers counted as controlled Buy Box until the viewer saves their own list (partner-led only). */
  defaultBuyBoxPartners: readonly string[];
};

export const CLIENT_PARAM = "client";

export const CLIENTS: Record<ClientKey, ClientProfile> = {
  fender: {
    key: "fender",
    brandName: "Fender",
    schema: "public",
    setAsideKey: "fmic",
    logoSrc: "/image.png",
    brandSiteDomains: ["fender.com", "shop.fender.com"],
    brandSiteLabel: "fender.com",
    promptsEditable: true,
    sellerModel: "Partner-led",
    defaultBuyBoxPartners: ["Austin Bazaar", "GearTree"],
  },
  ledlenser: {
    key: "ledlenser",
    brandName: "Ledlenser",
    schema: "ledlenser",
    setAsideKey: "ledlenser",
    logoSrc: "/ledlenser-logo-white.png",
    brandSiteDomains: ["ledlenser.com", "ledlenserusa.com"],
    brandSiteLabel: "ledlenser.com",
    promptsEditable: false,
    sellerModel: "Brand-led",
    defaultBuyBoxPartners: [],
  },
};

export const CLIENT_KEYS = Object.keys(CLIENTS) as ClientKey[];

export function isClientKey(value: unknown): value is ClientKey {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(CLIENTS, value);
}

export function clientKeyFromSearch(search: string): ClientKey {
  const raw = new URLSearchParams(search).get(CLIENT_PARAM);
  return isClientKey(raw) ? raw : "fender";
}

let resolved: ClientKey | null = null;

type ServerClientStore = { getStore(): ClientKey | undefined };

/** Set by the server export route for the length of one request. Absent in the browser. */
function serverClientKey(): ClientKey | undefined {
  const store = (globalThis as { __ifaiServerClient?: ServerClientStore }).__ifaiServerClient;
  const key = store?.getStore();
  return isClientKey(key) ? key : undefined;
}

/** The brand for this page load. Fender on the server and in tests, unless a request set one. */
export function activeClientKey(): ClientKey {
  const fromServer = serverClientKey();
  if (fromServer) return fromServer;
  if (resolved) return resolved;
  if (typeof window === "undefined") return "fender";
  resolved = clientKeyFromSearch(window.location.search);
  return resolved;
}

export function activeClient(): ClientProfile {
  return CLIENTS[activeClientKey()];
}

/** Brand name for copy: "Fender" or "Ledlenser". */
export function brandName(): string {
  return activeClient().brandName;
}

/**
 * Browser storage key for the brand on screen. Fender keeps its existing keys;
 * other brands get their own, so saved choices never cross brands.
 */
export function clientStorageKey(fenderKey: string): string {
  const key = activeClientKey();
  if (key === "fender") return fenderKey;
  return fenderKey.includes("fender") ? fenderKey.replace("fender", key) : `${fenderKey}:${key}`;
}

/** Dashboard URL for another client. Drops open panels, which belong to the old brand. */
export function clientHref(key: ClientKey, pathname: string): string {
  if (key === "fender") return pathname;
  const params = new URLSearchParams();
  params.set(CLIENT_PARAM, key);
  return `${pathname}?${params.toString()}`;
}

/** Test hook: forget the resolved client. */
export function resetActiveClientForTests(key: ClientKey | null = null): void {
  resolved = key;
}
