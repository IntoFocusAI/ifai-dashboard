import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/auth/paths";
import { supabaseCookieOptions } from "@/lib/supabase/cookie-options";

function isProtected(pathname: string) {
  return pathname.startsWith("/portal") || pathname.startsWith("/settings");
}

function isAuthScreen(pathname: string) {
  return pathname === "/login" || pathname === "/signup";
}

function withSession(response: NextResponse, session: NextResponse) {
  session.cookies.getAll().forEach((cookie) => {
    response.cookies.set(cookie);
  });
  for (const header of ["cache-control", "expires", "pragma"]) {
    const value = session.headers.get(header);
    if (value) response.headers.set(header, value);
  }
  return response;
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // Playwright starts `next dev` with this set. Production never honors it.
  // Skip the client first so a missing Supabase URL does not crash the page.
  const bypass =
    process.env.E2E_AUTH_BYPASS === "1" && process.env.NODE_ENV !== "production";
  if (bypass) return supabaseResponse;

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      ...supabaseCookieOptions(),
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([key, value]) =>
            supabaseResponse.headers.set(key, value),
          );
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);

  const { pathname } = request.nextUrl;

  if (!signedIn && isProtected(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    url.searchParams.set("next", pathname);
    return withSession(NextResponse.redirect(url), supabaseResponse);
  }

  if (signedIn && isAuthScreen(pathname)) {
    const url = request.nextUrl.clone();
    const next = safeNextPath(request.nextUrl.searchParams.get("next"), request.nextUrl.origin);
    const dest = new URL(next, request.nextUrl.origin);
    url.pathname = dest.pathname;
    url.search = dest.search;
    return withSession(NextResponse.redirect(url), supabaseResponse);
  }

  return supabaseResponse;
}
