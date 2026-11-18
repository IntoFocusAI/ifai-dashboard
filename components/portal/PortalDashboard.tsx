"use client";

import { FenderBrandCanvas } from "@/components/v3/FenderBrandCanvas";
import type { CanvasUserMenu } from "@/lib/canvas-sdk/types";
import { setPortalScope } from "@/lib/portal/browser-scope";

/* The dashboard for one portal account (issue 248). The server already checked the account,
   the entitlement and the brand; this only records the allowed brands for the switcher and the
   download links before the canvas renders. Every read runs as the signed-in user. */

export function PortalDashboard({
  accountId,
  clients,
  userMenu,
}: {
  accountId: string;
  clients: string[];
  userMenu: CanvasUserMenu;
}) {
  setPortalScope({ accountId, clients });
  return <FenderBrandCanvas userMenu={userMenu} viewerId={userMenu.email} />;
}
