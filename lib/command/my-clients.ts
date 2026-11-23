import {
  accessFromMemberships,
  accessFromRpcRows,
  type ClientAccess,
  type KnownClient,
  type MyClientsRow,
} from "@/lib/auth/client-access";
import { listClients } from "@/lib/client/active-client";
import type { CommandSession } from "@/lib/command/types";
import { e2eAuthBypass } from "@/lib/command/session";
import { createClient } from "@/lib/supabase/server";

export function knownClients(): KnownClient[] {
  return listClients().map((c) => ({ clientKey: c.client_key, displayName: c.display_name }));
}

/**
 * The clients this signed-in user may open. Asks command.my_clients() first (added by the
 * database lockdown). Until that function is in production, or if the call fails, the same list
 * comes from the session's memberships: staff get every client, anyone else their orgs' slugs.
 */
export async function loadClientAccess(session: CommandSession): Promise<ClientAccess> {
  const known = knownClients();
  if (e2eAuthBypass()) return accessFromMemberships(session.memberships, known);

  const supabase = await createClient();
  const { data, error } = await supabase.schema("command").rpc("my_clients");
  if (!error && Array.isArray(data)) {
    return accessFromRpcRows(data as MyClientsRow[], session.isIntoFocusAdmin, known);
  }
  return accessFromMemberships(session.memberships, known);
}
