import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardAuthView } from "@/components/dashboard/DashboardAuthView";
import { DashboardAccessScreen } from "@/components/portal/DashboardAccessScreen";
import { PortalDashboard } from "@/components/portal/PortalDashboard";
import { HomeCanvasDynamic } from "@/components/v3/HomeCanvasDynamic";
import { HomeCanvasStatic } from "@/components/v3/HomeCanvasStatic";
import { DASHBOARD_PATH } from "@/lib/auth/dashboard-path";
import { CLIENT_PARAM, defaultClientKey } from "@/lib/client/active-client";
import { dashboardHref } from "@/lib/portal/access";
import { ACCOUNT_PARAM, ACTIVE_ACCOUNT_COOKIE, STAFF_REASON_COOKIE } from "@/lib/portal/contract";
import { dashboardAccountsSource, e2eAuthBypass, portalUrl } from "@/lib/portal/mode";
import { resolveDashboardAccess } from "@/lib/portal/resolve";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(value: string | string[] | undefined): string | null {
  return typeof value === "string" ? value : null;
}

function savedStaffReason(raw: string | undefined): (accountId: string) => string | null {
  return (accountId) => {
    if (!raw) return null;
    try {
      const saved = JSON.parse(raw) as { account?: unknown; reason?: unknown };
      return saved.account === accountId && typeof saved.reason === "string" ? saved.reason : null;
    } catch {
      return null;
    }
  };
}

/**
 * The dashboard. Signed in through portal accounts (issue 248), every load re-checks who the
 * person is, which account they are opening, the portal entitlement (public.open_module) and which
 * brands that account may read. URL values are selectors only. With DASHBOARD_ACCOUNTS=command,
 * or under the e2e bypass on a dev server, the page is the old open dashboard.
 */
export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  if (process.env.NEXT_PUBLIC_STATIC_EXPORT === "1") {
    return <HomeCanvasStatic />;
  }
  if (dashboardAccountsSource() === "command" || e2eAuthBypass()) {
    return (
      <Suspense fallback={null}>
        <HomeCanvasDynamic />
      </Suspense>
    );
  }

  const [params, jar, supabase] = await Promise.all([searchParams, cookies(), createClient()]);
  const light = params.theme === "light";
  const portal = portalUrl();
  const accountParam = one(params[ACCOUNT_PARAM]);
  const clientParam = one(params[CLIENT_PARAM]);

  const access = await resolveDashboardAccess(supabase, {
    accountParam,
    clientParam,
    rememberedAccount: jar.get(ACTIVE_ACCOUNT_COOKIE)?.value ?? null,
    staffReason: savedStaffReason(jar.get(STAFF_REASON_COOKIE)?.value),
  });

  switch (access.kind) {
    case "signed_out":
      if (portal) redirect(`${portal}/login`);
      return <DashboardAuthView mode="login" next={DASHBOARD_PATH} />;
    case "choose_account":
      return <DashboardAccessScreen view="choose" accounts={access.accounts} light={light} portalHref={portal} />;
    case "reason_required":
      return <DashboardAccessScreen view="reason" account={access.account} light={light} portalHref={portal} />;
    case "blocked":
      return (
        <DashboardAccessScreen view="blocked" state={access.state} account={access.account} light={light} portalHref={portal} />
      );
    case "open": {
      // The browser picks the brand from the URL, so the URL must name the brand the server allowed.
      const wantedClient = access.client === defaultClientKey() ? null : access.client;
      if (accountParam !== access.account.id || clientParam !== wantedClient) {
        const href = dashboardHref(DASHBOARD_PATH, access.account.id, access.client, defaultClientKey());
        const theme = light ? `${href.includes("?") ? "&" : "?"}theme=light` : "";
        redirect(`${href}${theme}`);
      }
      return (
        <Suspense fallback={null}>
          <PortalDashboard
            accountId={access.account.id}
            clients={access.clients}
            userMenu={{
              email: access.email ?? "",
              organizationName: access.account.name,
              roleLabel: access.staff && access.account.role === "staff" ? "IntoFocus staff" : null,
              organizations: [],
              activeOrganizationId: access.account.id,
            }}
          />
        </Suspense>
      );
    }
  }
}
