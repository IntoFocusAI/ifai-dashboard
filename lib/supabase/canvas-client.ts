import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { activeClientSettings } from "@/lib/client/active-client";
import { aliasingFetch } from "@/lib/client/column-aliases";

let publicClient: SupabaseClient | null = null;
/** One client per brand schema, so a server export for one brand never reuses another's. */
const brandClients = new Map<string, SupabaseClient>();

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
 * Browser-safe client for the active brand's read-only canvas_* views, from its settings record.
 * Fender reads `public` with the dashboard's column names. A brand whose views use brand-neutral
 * column names (Ledlenser, schema `ledlenser`) has them translated to the names the dashboard uses.
 */
export function getCanvasSupabase(): SupabaseClient {
  const { data_schema: schema, column_naming: naming } = activeClientSettings();
  if (schema === "public" && naming === "fender") return getPublicCanvasSupabase();
  const cacheKey = `${schema}:${naming}`;
  const cached = brandClients.get(cacheKey);
  if (cached) return cached;
  const { url, key } = env();
  const client = createClient(url, key, {
    auth: { persistSession: false },
    db: { schema },
    ...(naming === "neutral" ? { global: { fetch: aliasingFetch() } } : {}),
  }) as unknown as SupabaseClient;
  brandClients.set(cacheKey, client);
  return client;
}
