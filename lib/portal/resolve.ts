/* Server: who is opening the dashboard, for which account, and which brands they may see
   (issue 248). Runs on every dashboard load, as the signed-in user, so access is re-checked each
   time. Every id from the URL or a cookie is only a selector, checked against lists the database
   returns for the caller. */

import type { SupabaseClient } from "@supabase/supabase-js";
import { listClients } from "@/lib/client/active-client";
import {
  chooseAccount,
  chooseClient,
  clientKeysForRefs,
  isOpen,
  isUuid,
  readAccounts,
  readClientRefs,
  readOpenModuleState,
  type AccessState,
  type PortalAccount,
} from "@/lib/portal/access";
import {
  DASHBOARD_PRODUCT,
  IS_STAFF_RPC,
  MY_ACCOUNTS_RPC,
  MY_CLIENTS_RPC,
  OPEN_MODULE_ARGS,
  OPEN_MODULE_RPC,
} from "@/lib/portal/contract";

export type DashboardAccess =
  | { kind: "signed_out" }
  | { kind: "choose_account"; accounts: PortalAccount[] }
  | { kind: "blocked"; state: AccessState; account: PortalAccount | null; accounts: PortalAccount[] }
  | { kind: "reason_required"; account: PortalAccount; accounts: PortalAccount[] }
  | {
      kind: "open";
      account: PortalAccount;
      accounts: PortalAccount[];
      /** Brands this account may read, in switcher order. */
      clients: string[];
      /** The brand to show. Always one of clients. */
      client: string;
      staff: boolean;
      email: string | null;
    };

export type AccessRequest = {
  /** ?account= from the link. A selector only. */
  accountParam: string | null;
  /** ?client= from the link. A selector only. */
  clientParam: string | null;
  /** The account remembered on this browser. A selector only. */
  rememberedAccount: string | null;
  /** A staff reason saved by the reason form for this account, if any. */
  staffReason: (accountId: string) => string | null;
};

type Claims = { sub?: unknown; email?: unknown };

export async function resolveDashboardAccess(
  supabase: SupabaseClient,
  request: AccessRequest,
): Promise<DashboardAccess> {
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const claims = (claimsData?.claims ?? null) as Claims | null;
  if (claimsError || !claims || typeof claims.sub !== "string") return { kind: "signed_out" };
  const email = typeof claims.email === "string" ? claims.email : null;

  const selector = isUuid(request.accountParam) ? request.accountParam : null;
  const remembered = isUuid(request.rememberedAccount) ? request.rememberedAccount : null;

  const [accountsRead, staffRead] = await Promise.all([
    supabase.rpc(MY_ACCOUNTS_RPC, { p_selected: selector ?? remembered }),
    supabase.rpc(IS_STAFF_RPC),
  ]);
  if (accountsRead.error) return { kind: "blocked", state: "unknown", account: null, accounts: [] };
  const accounts = readAccounts(accountsRead.data);
  const staff = !staffRead.error && staffRead.data === true;

  const choice = chooseAccount(accounts, selector, remembered);
  if (choice.kind === "none") return { kind: "blocked", state: "no_account", account: null, accounts };
  if (choice.kind === "choose") return { kind: "choose_account", accounts };
  const account = choice.account;

  const reason = request.staffReason(account.id);
  const opened = await supabase.rpc(OPEN_MODULE_RPC, {
    [OPEN_MODULE_ARGS.org]: account.id,
    [OPEN_MODULE_ARGS.product]: DASHBOARD_PRODUCT,
    [OPEN_MODULE_ARGS.reason]: reason,
  });
  const state: AccessState = opened.error ? "unknown" : readOpenModuleState(opened.data);
  if (state === "staff_reason_required") return { kind: "reason_required", account, accounts };
  if (!isOpen(state)) return { kind: "blocked", state, account, accounts };

  const clientsRead = await supabase.rpc(MY_CLIENTS_RPC, { p_organization_id: account.id });
  if (clientsRead.error) return { kind: "blocked", state: "unknown", account, accounts };
  const clients = clientKeysForRefs(readClientRefs(clientsRead.data), listClients());
  const client = chooseClient(clients, request.clientParam);
  if (!client) return { kind: "blocked", state: "not_entitled", account, accounts };

  return { kind: "open", account, accounts, clients, client, staff, email };
}

/**
 * For downloads and staff pages: the brand, when the signed-in user may read it through the
 * selected account. Strict: no fallback to another brand. Does not call open_module, so a
 * download does not add a second staff open to the log; my_dashboard_clients re-checks access.
 */
export async function signedInClientAllowed(
  supabase: SupabaseClient,
  request: Pick<AccessRequest, "accountParam" | "rememberedAccount">,
  clientKey: string,
): Promise<boolean> {
  const { data, error } = await supabase.auth.getClaims();
  if (error || typeof (data?.claims as Claims | undefined)?.sub !== "string") return false;
  const selector = isUuid(request.accountParam) ? request.accountParam : null;
  const remembered = isUuid(request.rememberedAccount) ? request.rememberedAccount : null;
  const accountsRead = await supabase.rpc(MY_ACCOUNTS_RPC, { p_selected: selector ?? remembered });
  if (accountsRead.error) return false;
  const choice = chooseAccount(readAccounts(accountsRead.data), selector, remembered);
  if (choice.kind !== "one") return false;
  const clientsRead = await supabase.rpc(MY_CLIENTS_RPC, { p_organization_id: choice.account.id });
  if (clientsRead.error) return false;
  return clientKeysForRefs(readClientRefs(clientsRead.data), listClients()).includes(clientKey);
}
