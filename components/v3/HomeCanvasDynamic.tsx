"use client";

import { useEffect, useMemo, useState } from "react";
import { FenderBrandCanvas } from "@/components/v3/FenderBrandCanvas";
import type { SwitcherClient } from "@/lib/auth/client-access";
import type { CanvasUserMenu } from "@/lib/canvas-sdk/types";
import { createClient } from "@/lib/supabase/client";

type Props = {
  /** From the server session. Null only in the Playwright run, which reads the browser session instead. */
  userMenu: CanvasUserMenu | null;
  viewerId?: string;
  switcherClients: SwitcherClient[];
};

/** The signed-in canvas. The dashboard page has already checked the login and the brand. */
export function HomeCanvasDynamic({ userMenu, viewerId, switcherClients }: Props) {
  const [browserEmail, setBrowserEmail] = useState<string | null>(null);

  useEffect(() => {
    if (userMenu) return;
    let cancelled = false;
    void createClient()
      .auth.getSession()
      .then(({ data }) => {
        if (!cancelled) setBrowserEmail(data.session?.user?.email ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [userMenu]);

  const menu = useMemo(
    () => userMenu ?? (browserEmail ? { email: browserEmail } : undefined),
    [browserEmail, userMenu],
  );
  return (
    <FenderBrandCanvas
      userMenu={menu}
      viewerId={viewerId ?? browserEmail ?? undefined}
      switcherClients={switcherClients}
    />
  );
}
