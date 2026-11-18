/* The intofocus-portal objects the dashboard depends on, in one place (issue 248).

   The portal owns accounts (public.organizations, public.organization_memberships), the staff check
   (private.is_staff()) and the entitlement check (public.open_module). The dashboard calls them as
   the signed-in user. If the portal renames a function, an argument or an access state, change it
   here and in supabase/tests/fixtures/portal-dashboard/10-portal-stub.sql together. */

/** The portal's product key for this dashboard. */
export const DASHBOARD_PRODUCT = "consensus_control";

/** Portal entitlement check: public.open_module(org, product, reason). Logs staff opens. */
export const OPEN_MODULE_RPC = "open_module";
export const OPEN_MODULE_ARGS = { org: "p_org", product: "p_product", reason: "p_reason" } as const;

/** Wrappers this repo adds (supabase/migrations/20261118200000_dashboard_portal_access.sql). */
export const MY_ACCOUNTS_RPC = "my_dashboard_accounts";
export const MY_CLIENTS_RPC = "my_dashboard_clients";
export const IS_STAFF_RPC = "dashboard_viewer_is_staff";

/**
 * Access states public.open_module returns, as the dashboard reads them.
 * open and open_staff show the dashboard. Every other state, or a state the dashboard does not
 * know, shows a message and loads no data.
 */
export const OPEN_STATES = ["open", "open_staff"] as const;
export const BLOCKED_STATES = ["signed_out", "no_account", "not_entitled", "suspended", "staff_reason_required"] as const;

/** Shortest staff reason the portal accepts. */
export const STAFF_REASON_MIN_LENGTH = 10;
export const STAFF_REASON_MAX_LENGTH = 500;

/** URL selectors the portal's launch link may carry. Selectors only: the server re-checks both. */
export const ACCOUNT_PARAM = "account";

/** Remembers the last account picked on this browser. A selector only, re-checked every load. */
export const ACTIVE_ACCOUNT_COOKIE = "ifai_dashboard_account";

/** Holds a staff reason for one account between the reason form and the next load. */
export const STAFF_REASON_COOKIE = "ifai_dashboard_staff_reason";
