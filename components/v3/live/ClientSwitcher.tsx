"use client";

import { usePathname } from "next/navigation";
import { activeClientKey, clientHref, isClientKey, listClients } from "@/lib/client/active-client";

/**
 * Testing switcher between client brands until login ships. Each brand reads
 * its own database schema; changing it reloads the page so nothing from the
 * previous brand stays on screen.
 */
export function ClientSwitcher() {
  const pathname = usePathname() ?? "/dashboard";
  const current = activeClientKey();

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
          if (!isClientKey(next) || next === current) return;
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
        {listClients().map((client) => (
          <option key={client.client_key} value={client.client_key}>
            {client.display_name}
          </option>
        ))}
      </select>
    </label>
  );
}
