"use client";

import { Suspense } from "react";
import { FenderBrandCanvas } from "@/components/v3/FenderBrandCanvas";
import { listClients } from "@/lib/client/active-client";

/** GitHub Pages / static export: canvas only, no auth shell, every brand in the switcher. */
export function HomeCanvasStatic() {
  const clients = listClients().map((c) => ({ clientKey: c.client_key, name: c.display_name }));
  return (
    <Suspense fallback={null}>
      <FenderBrandCanvas switcherClients={clients} />
    </Suspense>
  );
}
