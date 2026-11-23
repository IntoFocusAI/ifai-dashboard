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

/**
 * Null when the read failed; the Actuation pillar then reads Not available* and sits out of Consensus.
 * A client that cannot be built (no Supabase URL or key) is a failed read too, never a throw, so the
 * canvas bundle and the score history still load without it.
 */
export function loadActuationBasis(client: ClientKey = activeClient().key): Promise<ClientBasis | null> {
  const cached = reads.get(client);
  if (cached) return cached;
  const read = Promise.resolve()
    .then(() => readActuationBasis(getPublicCanvasSupabase() as never, client))
    .catch(() => null)
    .then((basis) => {
      if (!basis) reads.delete(client);
      return basis;
    });
  reads.set(client, read);
  return read;
}
