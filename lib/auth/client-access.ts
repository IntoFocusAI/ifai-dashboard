/* Which client brands a signed-in user may open, and which one a dashboard request shows.

   Roles live only in command.organization_memberships (decision by Brian Watson, 23 Nov 2026):
     - IntoFocus Staff: intofocus_admin on the platform org (intofocus-ai). Every client.
     - Org Lead (org_admin) and Org User (org_viewer): only the clients whose command org slug
       equals the client_key in data/clients/*.json.

   Pure functions, no database: the dashboard page feeds them either the rows of
   command.my_clients() or the session's memberships, so the app works before and after that
   RPC reaches production. The database's row-level security is the real wall; this keeps the
   URL from choosing a brand the user cannot see. */

import type { CommandMembership, OrganizationRole } from "@/lib/command/types";

export type AllowedClient = {
  clientKey: string;
  /** Command org id. Null for a staff fallback row whose org was not in the session. */
  organizationId: string | null;
  organizationName: string;
  role: OrganizationRole;
};

export type ClientAccess =
  | { kind: "none" }
  | { kind: "staff"; clients: AllowedClient[] }
  | { kind: "member"; clients: AllowedClient[] };

/** One row of command.my_clients(). */
export type MyClientsRow = {
  client_key: string;
  organization_id: string | null;
  organization_name: string | null;
  role: OrganizationRole;
};

/** One brand in the header switcher. */
export type SwitcherClient = { clientKey: string; name: string };

/** A known client the registry lists, for ordering and names. */
export type KnownClient = { clientKey: string; displayName: string };

function inRegistryOrder(clients: AllowedClient[], known: readonly KnownClient[]): AllowedClient[] {
  const order = new Map(known.map((c, i) => [c.clientKey, i]));
  const unique = new Map<string, AllowedClient>();
  for (const c of clients) {
    if (order.has(c.clientKey) && !unique.has(c.clientKey)) unique.set(c.clientKey, c);
  }
  return [...unique.values()].sort((a, b) => order.get(a.clientKey)! - order.get(b.clientKey)!);
}

function wrap(isStaff: boolean, clients: AllowedClient[]): ClientAccess {
  if (clients.length === 0) return { kind: "none" };
  return isStaff ? { kind: "staff", clients } : { kind: "member", clients };
}

/** Staff check, the same test as command.is_intofocus_admin(): active intofocus_admin on the platform org. */
export function isStaffMembership(memberships: readonly CommandMembership[]): boolean {
  return memberships.some(
    (m) => m.status === "active" && m.role === "intofocus_admin" && m.organization.isPlatformOrg,
  );
}

/** Fallback when command.my_clients() is not there: the same list from the session's memberships. */
export function accessFromMemberships(
  memberships: readonly CommandMembership[],
  known: readonly KnownClient[],
): ClientAccess {
  const active = memberships.filter((m) => m.status === "active");
  if (isStaffMembership(active)) {
    const bySlug = new Map(active.map((m) => [m.organization.slug, m.organization]));
    return wrap(
      true,
      known.map((c) => ({
        clientKey: c.clientKey,
        organizationId: bySlug.get(c.clientKey)?.id ?? null,
        organizationName: bySlug.get(c.clientKey)?.name ?? c.displayName,
        role: "intofocus_admin" as const,
      })),
    );
  }
  const rows = active
    .filter((m) => !m.organization.isPlatformOrg && m.role !== "intofocus_admin")
    .map((m) => ({
      clientKey: m.organization.slug,
      organizationId: m.organization.id,
      organizationName: m.organization.name,
      role: m.role,
    }));
  return wrap(false, inRegistryOrder(rows, known));
}

/** The list from command.my_clients(). Staff comes from the session, never from the rows. */
export function accessFromRpcRows(
  rows: readonly MyClientsRow[],
  isStaff: boolean,
  known: readonly KnownClient[],
): ClientAccess {
  const names = new Map(known.map((c) => [c.clientKey, c.displayName]));
  const clients = rows
    .filter((r) => isStaff || r.role !== "intofocus_admin")
    .map((r) => ({
      clientKey: r.client_key,
      organizationId: r.organization_id,
      organizationName: r.organization_name ?? names.get(r.client_key) ?? r.client_key,
      role: r.role,
    }));
  return wrap(isStaff, inRegistryOrder(clients, known));
}

export type ClientChoice = {
  clientKey: string;
  /** True when the URL does not already show this client and the page must redirect. */
  redirect: boolean;
};

/**
 * The client a dashboard request shows. A `?client=` the user may open wins. Anything else (no
 * parameter, an unknown brand, or another org's brand) falls back to the default client when
 * allowed, else the user's first client. `redirect` is true when the URL would show a different
 * brand than the one chosen, because the canvas reads the brand from the URL.
 */
export function chooseClient(
  access: ClientAccess,
  requested: string | null | undefined,
  defaultKey: string,
): ClientChoice | null {
  if (access.kind === "none") return null;
  const allowed = access.clients.map((c) => c.clientKey);
  const fromUrl = requested || defaultKey;
  if (allowed.includes(fromUrl)) {
    return { clientKey: fromUrl, redirect: false };
  }
  const clientKey = allowed.includes(defaultKey) ? defaultKey : allowed[0];
  return { clientKey, redirect: true };
}

/** The allowed client for one key, or null. */
export function allowedClient(access: ClientAccess, clientKey: string): AllowedClient | null {
  if (access.kind === "none") return null;
  return access.clients.find((c) => c.clientKey === clientKey) ?? null;
}

/**
 * The dashboard URL that shows `clientKey`, keeping every other parameter (open panel, tab,
 * theme). The default client has no `client` parameter, as clientHref writes it.
 */
export function dashboardSearchFor(
  params: Record<string, string | string[] | undefined>,
  clientKey: string,
  defaultKey: string,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "client" || value === undefined) continue;
    for (const v of Array.isArray(value) ? value : [value]) search.append(key, v);
  }
  if (clientKey !== defaultKey) search.set("client", clientKey);
  const text = search.toString();
  return text ? `?${text}` : "";
}
