import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let sessionClient: SupabaseClient | null = null;

/**
 * Browser client that carries the signed-in user's session (cookies set at sign-in).
 * Use it for every write function: the write RPCs are not callable with the anon key
 * (migrations 20261118160000 and 20261118190000). Reads stay on the public client for now.
 */
export function getSessionSupabase(): SupabaseClient {
  if (!sessionClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error("Supabase is not configured.");
    sessionClient = createBrowserClient(url, key);
  }
  return sessionClient;
}
