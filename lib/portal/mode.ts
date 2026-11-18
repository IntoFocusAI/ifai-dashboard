/* Where the dashboard takes accounts from (issue 248).
     portal  (default) portal accounts, public.open_module on every load, signed-in reads only.
     command the old command.* sign-in and the open dashboard, for current internal users until
             the 1.6 lockdown (issue 247) and the portal wrappers are applied. Retired by 1.2.
   The e2e bypass (dev server only) keeps the old page so the existing suites run unchanged. */

export type DashboardAccountsSource = "portal" | "command";

export function dashboardAccountsSource(env: Record<string, string | undefined> = process.env): DashboardAccountsSource {
  return env.DASHBOARD_ACCOUNTS?.trim().toLowerCase() === "command" ? "command" : "portal";
}

export function e2eAuthBypass(env: Record<string, string | undefined> = process.env): boolean {
  return env.E2E_AUTH_BYPASS === "1" && env.NODE_ENV !== "production";
}

/** The portal's address, for "Back to the portal" and sign-in. Null when not configured. */
export function portalUrl(env: Record<string, string | undefined> = process.env): string | null {
  const raw = env.NEXT_PUBLIC_PORTAL_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.hostname === "localhost" || url.hostname === "127.0.0.1"
      ? url.toString().replace(/\/$/, "")
      : null;
  } catch {
    return null;
  }
}
