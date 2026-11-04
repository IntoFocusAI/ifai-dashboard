import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { activeClient } from "@/lib/client/active-client";
import { aliasingFetch } from "@/lib/client/column-aliases";

let publicClient: SupabaseClient | null = null;
let brandClient: SupabaseClient | null = null;

function env() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or PUBLISHABLE_KEY).",
    );
  }
  return { url, key };
}

/**
 * Browser-safe client for the read-only `public` schema: Fender's canvas_* views,
 * plus the shared set-aside views and functions that every client uses.
 */
export function getPublicCanvasSupabase(): SupabaseClient {
  if (publicClient) return publicClient;
  const { url, key } = env();
  publicClient = createClient(url, key, { auth: { persistSession: false } });
  return publicClient;
}

/**
 * Browser-safe client for the active brand's read-only canvas_* views.
 * Fender reads `public`. Ledlenser reads the `ledlenser` schema, with its
 * brand-neutral column names translated to the names the dashboard uses.
 */
export function getCanvasSupabase(): SupabaseClient {
  const client = activeClient();
  if (client.schema === "public") return getPublicCanvasSupabase();
  if (brandClient) return brandClient;
  const { url, key } = env();
  brandClient = createClient(url, key, {
    auth: { persistSession: false },
    db: { schema: client.schema },
    global: { fetch: aliasingFetch() },
  }) as unknown as SupabaseClient;
  return brandClient;
}
