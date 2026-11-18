"use client";

import { usePathname } from "next/navigation";
import { activeClientKey, clientHref, defaultClientKey, isClientKey, listClients } from "@/lib/client/active-client";
import { dashboardHref } from "@/lib/portal/access";
import { portalScope } from "@/lib/portal/browser-scope";

/**
 * Switcher between client brands. Each brand reads its own database schema; changing it reloads
 * the page so nothing from the previous brand stays on screen. Signed in through portal accounts,
 * it lists only the brands the server allowed for the account, keeps the account in the link, and
 * hides itself when the account has one brand. The server re-checks the brand on every load.
 */
export function ClientSwitcher() {
  const pathname = usePathname() ?? "/dashboard";
  const current = activeClientKey();
  const scope = portalScope();
  const clients = scope ? listClients().filter((c) => scope.clients.includes(c.client_key)) : listClients();
  if (scope && clients.length < 2) return null;
  const hrefFor = (key: string) =>
    scope ? dashboardHref(pathname, scope.accountId, key, defaultClientKey()) : clientHref(key, pathname);

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
          window.location.assign(hrefFor(next));
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
          <option key={client.client_key} value={client.client_key}>
            {client.display_name}
          </option>
        ))}
      </select>
    </label>
  );
}
