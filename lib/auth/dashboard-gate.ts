import { DASHBOARD_PATH } from "@/lib/auth/dashboard-path";
import {
  allowedClient,
  chooseClient,
  dashboardSearchFor,
  type ClientAccess,
  type SwitcherClient,
} from "@/lib/auth/client-access";
import { canManageUsers } from "@/lib/auth/member-permissions";
import { safeNextPath } from "@/lib/auth/paths";
import type { CanvasUserMenu } from "@/lib/canvas-sdk/types";
import { CLIENT_PARAM, defaultClientKey, getClientSettings } from "@/lib/client/active-client";
import { COMMAND_ROLE_LABELS } from "@/lib/command/constants";
import { loadClientAccess } from "@/lib/command/my-clients";
import { e2eAuthBypass, getCommandSession } from "@/lib/command/session";
import type { CommandSession } from "@/lib/command/types";

type Params = Record<string, string | string[] | undefined>;

export type DashboardGate =
  | { kind: "login"; next: string }
  | { kind: "redirect"; search: string }
  | { kind: "no-access"; userMenu: CanvasUserMenu }
  | {
      kind: "canvas";
      /** Null in the Playwright run: the canvas reads the menu from the browser session, as before. */
      userMenu: CanvasUserMenu | null;
      /** Brands the header switcher offers. One or none hides the switcher. */
      switcherClients: SwitcherClient[];
    };

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Where Log in returns to: an explicit `next`, else this same dashboard URL. */
function loginNext(params: Params): string {
  const explicit = first(params.next);
  if (explicit) return safeNextPath(explicit);
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "next" || value === undefined) continue;
    for (const v of Array.isArray(value) ? value : [value]) search.append(key, v);
  }
  const text = search.toString();
  return `${DASHBOARD_PATH}${text ? `?${text}` : ""}`;
}

function baseMenu(session: CommandSession): CanvasUserMenu {
  return {
    email: session.email,
    displayName: session.profile.displayName,
    avatarUrl: session.avatarSignedUrl,
    organizations: [],
    canManageUsers: canManageUsers(session.memberships),
  };
}

function menuFor(session: CommandSession, access: ClientAccess, clientKey: string): CanvasUserMenu {
  const menu = baseMenu(session);
  if (access.kind === "staff") {
    return { ...menu, organizationName: "IntoFocus", roleLabel: COMMAND_ROLE_LABELS.intofocus_admin };
  }
  const client = allowedClient(access, clientKey);
  return {
    ...menu,
    organizationName: client?.organizationName ?? null,
    roleLabel: client ? COMMAND_ROLE_LABELS[client.role] : null,
  };
}

export async function resolveDashboardGate(params: Params): Promise<DashboardGate> {
  const session = await getCommandSession().catch(() => null);
  if (!session) return { kind: "login", next: loginNext(params) };

  const access = await loadClientAccess(session);
  const defaultKey = defaultClientKey();
  const choice = chooseClient(access, first(params[CLIENT_PARAM]), defaultKey);
  if (!choice || access.kind === "none") return { kind: "no-access", userMenu: baseMenu(session) };
  if (choice.redirect) {
    return { kind: "redirect", search: dashboardSearchFor(params, choice.clientKey, defaultKey) };
  }

  return {
    kind: "canvas",
    userMenu: e2eAuthBypass() ? null : menuFor(session, access, choice.clientKey),
    switcherClients: access.clients.map((c) => ({
      clientKey: c.clientKey,
      name: getClientSettings(c.clientKey).display_name,
    })),
  };
}
