/**
 * The client's SC-03 Actuation basis (public.actuation_basis: counts and dates, no names or notes),
 * read once per client per page load and shared by the bundle, Summary, and Citation Ecosystem.
 * The function lives in public for every client (decision 84 filters it by client key). A failed
 * read is tried again on the next call.
 */

import { activeClient, type ClientKey } from "@/lib/client/active-client";
import { readActuationBasis, type ClientBasis } from "@/lib/fender-canvas/actuation-records";
import { getPublicCanvasSupabase } from "@/lib/supabase/canvas-client";

const reads = new Map<ClientKey, Promise<ClientBasis | null>>();

/** Null when the read failed; the Actuation pillar then reads Not available* and sits out of Consensus. */
export function loadActuationBasis(client: ClientKey = activeClient().key): Promise<ClientBasis | null> {
  const cached = reads.get(client);
  if (cached) return cached;
  const read = readActuationBasis(getPublicCanvasSupabase() as never, client).then((basis) => {
    if (!basis) reads.delete(client);
    return basis;
  });
  reads.set(client, read);
  return read;
}
