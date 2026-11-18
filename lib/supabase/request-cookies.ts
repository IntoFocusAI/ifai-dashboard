/* The current request's cookies, for server reads that must run as the signed-in user
   (issue 248). Browser-safe: no Node imports here. lib/supabase/request-auth.ts sets the store
   on the server. Shared on globalThis so every bundle copy reads the same store (the same
   reason as lib/client/server-client.ts). */

export type RequestCookie = { name: string; value: string };

type Store = { getStore(): RequestCookie[] | undefined };

export function requestCookies(): RequestCookie[] | undefined {
  const store = (globalThis as { __ifaiRequestCookies?: Store }).__ifaiRequestCookies;
  return store?.getStore();
}
