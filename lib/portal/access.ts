/* Pure rules for opening the dashboard from portal accounts (issue 248). No I/O here, so the unit
   tests in scripts/portal-access.test.ts cover every rule. lib/portal/resolve.ts does the reads.

   Approved rule (2026-11-17): access always comes from the signed-in user's account membership,
   never from an account or client id in a link. A URL value is only a selector, and every
   selector here is checked against lists the database returned for the caller. */

import type { ClientSettings } from "@/lib/client/settings-schema";
import {
  BLOCKED_STATES,
  OPEN_STATES,
  STAFF_REASON_MAX_LENGTH,
  STAFF_REASON_MIN_LENGTH,
} from "@/lib/portal/contract";

export type PortalAccount = { id: string; name: string; slug: string; role: string };

export type OpenState = (typeof OPEN_STATES)[number];
export type BlockedState = (typeof BLOCKED_STATES)[number];
/** "unknown" covers an error or a state this build does not know. It never opens. */
export type AccessState = OpenState | BlockedState | "unknown";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

/** The access state in public.open_module's answer. Anything unexpected is "unknown". */
export function readOpenModuleState(data: unknown): AccessState {
  const row = Array.isArray(data) ? data[0] : data;
  const raw =
    typeof row === "string"
      ? row
      : row && typeof row === "object"
        ? ((row as Record<string, unknown>).access ?? (row as Record<string, unknown>).state)
        : null;
  if (typeof raw !== "string") return "unknown";
  if ((OPEN_STATES as readonly string[]).includes(raw)) return raw as OpenState;
  if ((BLOCKED_STATES as readonly string[]).includes(raw)) return raw as BlockedState;
  return "unknown";
}

export function isOpen(state: AccessState): state is OpenState {
  return (OPEN_STATES as readonly string[]).includes(state);
}

/** Rows from public.my_dashboard_accounts, checked. Bad rows are dropped. */
export function readAccounts(data: unknown): PortalAccount[] {
  if (!Array.isArray(data)) return [];
  const seen = new Set<string>();
  const accounts: PortalAccount[] = [];
  for (const row of data) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    if (!isUuid(r.organization_id) || seen.has(r.organization_id)) continue;
    seen.add(r.organization_id);
    accounts.push({
      id: r.organization_id,
      name: typeof r.name === "string" ? r.name : "",
      slug: typeof r.slug === "string" ? r.slug : "",
      role: typeof r.role === "string" ? r.role : "",
    });
  }
  return accounts.sort((a, b) => a.name.localeCompare(b.name));
}

export type AccountChoice =
  | { kind: "one"; account: PortalAccount }
  | { kind: "choose"; accounts: PortalAccount[] }
  | { kind: "none" };

/**
 * Which account to show. The link's selector wins, then the account remembered on this browser,
 * then the only account. A selector that is not in the caller's list is ignored.
 */
export function chooseAccount(
  accounts: PortalAccount[],
  selector: string | null | undefined,
  remembered: string | null | undefined,
): AccountChoice {
  if (accounts.length === 0) return { kind: "none" };
  for (const id of [selector, remembered]) {
    const match = id ? accounts.find((a) => a.id === id) : undefined;
    if (match) return { kind: "one", account: match };
  }
  if (accounts.length === 1) return { kind: "one", account: accounts[0] };
  return { kind: "choose", accounts };
}

/**
 * The database schema the 1.6 isolation contract maps to an account for one client.
 * Fender's settings read the public canvas_* views, whose data lives in the command schema.
 * Every other client reads its own schema.
 */
export function accessSchema(settings: Pick<ClientSettings, "data_schema">): string {
  return settings.data_schema === "public" ? "command" : settings.data_schema;
}

export type ClientRef = { source: string; client_ref: string };

/** Rows from public.my_dashboard_clients, checked. */
export function readClientRefs(data: unknown): ClientRef[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const r = row as Record<string, unknown>;
    return typeof r.source === "string" && typeof r.client_ref === "string"
      ? [{ source: r.source, client_ref: r.client_ref }]
      : [];
  });
}

/**
 * Dashboard client keys the account may read, in switcher order. Only per-client schema rows map
 * to a dashboard client today; sandbox clients have no dashboard settings file yet.
 */
export function clientKeysForRefs(refs: ClientRef[], clients: readonly ClientSettings[]): string[] {
  const schemas = new Set(refs.filter((r) => r.source === "schema").map((r) => r.client_ref));
  return clients.filter((c) => schemas.has(accessSchema(c))).map((c) => c.client_key);
}

/** The requested brand when the account may read it, else the first one it may read. */
export function chooseClient(allowed: readonly string[], requested: string | null | undefined): string | null {
  if (requested && allowed.includes(requested)) return requested;
  return allowed[0] ?? null;
}

/** Null when the reason is acceptable, else what to fix. */
export function staffReasonProblem(reason: string): string | null {
  const text = reason.trim();
  if (text.length < STAFF_REASON_MIN_LENGTH) {
    return `Enter a reason of at least ${STAFF_REASON_MIN_LENGTH} characters.`;
  }
  if (text.length > STAFF_REASON_MAX_LENGTH) {
    return `Keep the reason to ${STAFF_REASON_MAX_LENGTH} characters or fewer.`;
  }
  return null;
}

const TOKEN_KEYS = /^(access_token|refresh_token|provider_token|provider_refresh_token|id_token|token|token_hash|code|jwt|sb-.*)$/i;
const JWT_LIKE = /^eyJ[\w-]+\.[\w-]+\.[\w-]+$/;

/**
 * True when a URL carries anything that looks like a session token: a token-named parameter in the
 * query or the fragment, or a JWT-shaped value. Links into and out of the dashboard must never
 * carry one (tokens in URLs end up in logs, history and referrers).
 */
export function urlCarriesToken(href: string, base = "http://localhost"): boolean {
  let url: URL;
  try {
    url = new URL(href, base);
  } catch {
    return false;
  }
  const params = [url.searchParams, new URLSearchParams(url.hash.replace(/^#/, ""))];
  for (const p of params) {
    for (const [key, value] of p) {
      if (TOKEN_KEYS.test(key) || JWT_LIKE.test(value)) return true;
    }
  }
  return JWT_LIKE.test(decodeURIComponent(url.pathname.split("/").pop() ?? ""));
}

/** The dashboard link for one account and brand. Selectors only; never a token. */
export function dashboardHref(pathname: string, account: string | null, client: string | null, defaultClient: string): string {
  const params = new URLSearchParams();
  if (account) params.set("account", account);
  if (client && client !== defaultClient) params.set("client", client);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
