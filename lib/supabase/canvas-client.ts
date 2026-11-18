import { createBrowserClient, createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { activeClientSettings } from "@/lib/client/active-client";
import { aliasingFetch } from "@/lib/client/column-aliases";
import { supabaseCookieOptions } from "@/lib/supabase/cookie-options";
import { requestCookies } from "@/lib/supabase/request-cookies";

/* Every client data read goes through this file (issue 248). Reads run as the signed-in user:
   in the browser with the session cookie, on the server with the request's cookies
   (runSignedIn in lib/supabase/request-auth.ts). Nothing here sends a read with only the
   public key on behalf of a page; a signed-out browser has no session, so the database
   (1.6 isolation, issue 247) returns no client rows. */

/** One browser client per brand schema, so a page never reuses another brand's client. */
const browserClients = new Map<string, SupabaseClient>();

function env() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or ANON_KEY).",
    );
  }
  return { url, key };
}

type Target = { schema: string; neutral: boolean };

function options(target: Target) {
  return {
    ...(target.schema === "public" ? {} : { db: { schema: target.schema } }),
    ...(target.neutral ? { global: { fetch: aliasingFetch() } } : {}),
  };
}

/** The browser's one session holder: the same singleton lib/supabase/client.ts returns. */
function browserSession(): SupabaseClient {
  const { url, key } = env();
  return createBrowserClient(url, key, supabaseCookieOptions()) as unknown as SupabaseClient;
}

function browserClient(target: Target): SupabaseClient {
  const cacheKey = `${target.schema}:${target.neutral ? "neutral" : "fender"}`;
  const cached = browserClients.get(cacheKey);
  if (cached) return cached;
  const { url, key } = env();
  // Data clients carry the signed-in user's access token from the one session holder, so there
  // is one auth client per page (no second refresh loop) and every read runs as the user.
  const client = createClient(url, key, {
    ...options(target),
    accessToken: async () => (await browserSession().auth.getSession()).data.session?.access_token ?? null,
  }) as unknown as SupabaseClient;
  browserClients.set(cacheKey, client);
  return client;
}

/** True inside the Next.js server (a page, route handler or server action). */
function inNextServer(): boolean {
  return typeof window === "undefined" && Boolean(process.env.NEXT_RUNTIME);
}

function serverClient(target: Target): SupabaseClient {
  const cookies = requestCookies();
  const { url, key } = env();
  if (!cookies) {
    if (inNextServer()) {
      // A server read outside runSignedIn would run without the user's session. Fail closed.
      throw new Error("Client data reads on the server must run inside runSignedIn().");
    }
    // Node scripts and unit tests (not a page): no request, no session. See the PR's call-site
    // list: scripts/save-score-snapshots.ts needs its own reader credentials after 1.6 Step 0b.
    return createServerClient(url, key, {
      ...options(target),
      cookies: { getAll: () => [], setAll: () => {} },
    }) as unknown as SupabaseClient;
  }
  return createServerClient(url, key, {
    ...options(target),
    cookies: {
      getAll: () => cookies,
      // Server reads never write cookies; the proxy refreshes the session.
      setAll: () => {},
    },
  }) as unknown as SupabaseClient;
}

function clientFor(target: Target): SupabaseClient {
  return typeof window === "undefined" ? serverClient(target) : browserClient(target);
}

/**
 * Signed-in client for the `public` schema: Fender's canvas_* views, plus the shared set-aside
 * views and functions that every client uses.
 */
export function getPublicCanvasSupabase(): SupabaseClient {
  return clientFor({ schema: "public", neutral: false });
}

/**
 * Signed-in client for the active brand's canvas_* views, from its settings record.
 * Fender reads `public` with the dashboard's column names. A brand whose views use brand-neutral
 * column names (Ledlenser, schema `ledlenser`) has them translated to the names the dashboard uses.
 */
export function getCanvasSupabase(): SupabaseClient {
  const { data_schema: schema, column_naming: naming } = activeClientSettings();
  return clientFor({ schema, neutral: naming === "neutral" });
}

/** Test hook: forget the browser clients. */
export function resetCanvasClientsForTests(): void {
  browserClients.clear();
}
