import { createBrowserClient } from "@supabase/ssr";

/* The signed-in viewer's access token for the canvas data clients, so the database's row-level
   security sees who is asking (the login lockdown, 23 Nov 2026). Null means no session: the
   request goes out with the publishable key alone, as every request did before.

   In the browser it comes from the login cookie. On the server a route sets it for one request
   with runWithViewerToken (lib/supabase/server-viewer-token.ts); this file stays browser-safe. */

type TokenStore = { getStore(): string | null | undefined };

export async function viewerAccessToken(): Promise<string | null> {
  const store = (globalThis as { __ifaiServerViewerToken?: TokenStore }).__ifaiServerViewerToken;
  const fromServer = store?.getStore();
  if (fromServer !== undefined) return fromServer;
  if (typeof window === "undefined") return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  try {
    const { data } = await createBrowserClient(url, key).auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}
