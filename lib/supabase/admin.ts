import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/* Service-role client for Manage users (invite, list, remove). Server only: the key bypasses
   row-level security, so every caller checks the signed-in user's role first
   (lib/auth/member-permissions.ts). The key is read from SUPABASE_SERVICE_ROLE_KEY, set in the
   Netlify site's environment variables, never in the repo and never with a NEXT_PUBLIC_ prefix. */

export class AdminNotConfiguredError extends Error {
  constructor() {
    super("SUPABASE_SERVICE_ROLE_KEY is not set on the server.");
  }
}

export function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new AdminNotConfiguredError();
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
