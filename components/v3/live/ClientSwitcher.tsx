"use client";

import { usePathname } from "next/navigation";
import type { SwitcherClient } from "@/lib/auth/client-access";
import { activeClientKey, clientHref } from "@/lib/client/active-client";

/**
 * Switcher between the brands this viewer may open: every client for IntoFocus Staff, only
 * their own org's brand for anyone else (so they get no switcher). The dashboard page builds
 * the list on the server and redirects a `?client=` the viewer may not open. Changing brand
 * reloads the page so nothing from the previous brand stays on screen.
 */
export function ClientSwitcher({ clients }: { clients: readonly SwitcherClient[] }) {
  const pathname = usePathname() ?? "/dashboard";
  const current = activeClientKey();
  if (clients.length < 2) return null;

  return (
    <label
      style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text-muted)" }}
    >
      <span>Client</span>
      <select
        aria-label="Client brand"
        value={current}
        onChange={(event) => {
          const next = event.target.value;
          if (next === current || !clients.some((c) => c.clientKey === next)) return;
          window.location.assign(clientHref(next, pathname));
        }}
        style={{
          fontSize: 11,
          padding: "2px 6px",
          borderRadius: 6,
          border: "1px solid var(--border-subtle, rgba(255,255,255,0.18))",
          background: "var(--surface-raised, transparent)",
          color: "var(--text-primary, inherit)",
        }}
      >
        {clients.map((client) => (
          <option key={client.clientKey} value={client.clientKey}>
            {client.name}
          </option>
        ))}
      </select>
    </label>
  );
}
