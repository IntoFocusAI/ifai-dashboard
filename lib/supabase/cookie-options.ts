/* One sign-in across the portal and the dashboard (issue 248). Both apps use the same Supabase
   project, so the session cookie has the same name in both. Set NEXT_PUBLIC_SUPABASE_COOKIE_DOMAIN
   to the shared parent domain (".intofocus.ai" at go-live) and both apps read and refresh one
   cookie. Unset (local, previews), cookies stay on the current host. The portal must set the same
   domain on its Supabase clients. Tokens only ever travel in this cookie, never in a URL. */

const DOMAIN = /^\.?[a-z0-9-]+(\.[a-z0-9-]+)+$/i;

export function sharedCookieDomain(value: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_COOKIE_DOMAIN): string | undefined {
  const domain = value?.trim();
  return domain && DOMAIN.test(domain) ? domain : undefined;
}

export function supabaseCookieOptions(value?: string) {
  const domain = sharedCookieDomain(value ?? process.env.NEXT_PUBLIC_SUPABASE_COOKIE_DOMAIN);
  return domain ? { cookieOptions: { domain, path: "/", sameSite: "lax" as const, secure: true } } : {};
}
