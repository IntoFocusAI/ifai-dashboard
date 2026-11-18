/* The account and brands the server allowed for this page load (issue 248). Set once by
   PortalDashboard before the canvas renders. Only shapes the brand switcher and its links; every
   read is still checked by the database as the signed-in user. Null when the dashboard runs
   without portal accounts (DASHBOARD_ACCOUNTS=command, the e2e bypass, or the static export). */

export type PortalScope = { accountId: string; clients: readonly string[] };

let scope: PortalScope | null = null;

export function setPortalScope(next: PortalScope | null): void {
  scope = next;
}

export function portalScope(): PortalScope | null {
  return scope;
}
