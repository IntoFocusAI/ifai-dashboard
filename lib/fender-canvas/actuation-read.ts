/**
 * Server read for the staff Actuation records page. Runs as the signed-in user (cookies);
 * the staff functions return rows only to IntoFocus staff. Never call from the browser.
 */

import type { ClientKey } from "@/lib/client/active-client";
import {
  actuationClientKey,
  type StaffItemRow,
  type StaffProgramRow,
} from "@/lib/fender-canvas/actuation-records";
import { createClient } from "@/lib/supabase/server";

export type ActuationRecordsRead =
  | { state: "ready"; programs: StaffProgramRow[]; items: StaffItemRow[] }
  /** The migration is not applied yet: the functions are not in the database. */
  | { state: "absent" }
  | { state: "error"; message: string };

type RpcError = { code?: string; message?: string } | null;

/** PostgREST "function not found", Postgres undefined function or table. */
export function isMissingFunction(error: RpcError): boolean {
  const code = error?.code ?? "";
  return code === "PGRST202" || code === "42883" || code === "42P01";
}

export async function loadActuationRecords(client: ClientKey): Promise<ActuationRecordsRead> {
  try {
    const supabase = await createClient();
    const args = { p_client_key: actuationClientKey(client) };
    const [programs, items] = await Promise.all([
      supabase.rpc("actuation_programs_for_staff", args),
      supabase.rpc("actuation_items_for_staff", args),
    ]);
    if (isMissingFunction(programs.error as RpcError) || isMissingFunction(items.error as RpcError)) {
      return { state: "absent" };
    }
    if (programs.error || items.error || !Array.isArray(programs.data) || !Array.isArray(items.data)) {
      return { state: "error", message: "The Actuation records could not be read. Reload to try again." };
    }
    return { state: "ready", programs: programs.data as StaffProgramRow[], items: items.data as StaffItemRow[] };
  } catch {
    return { state: "error", message: "The Actuation records could not be read. Reload to try again." };
  }
}
