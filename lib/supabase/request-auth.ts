import { AsyncLocalStorage } from "node:async_hooks";
import { cookies } from "next/headers";
import type { RequestCookie } from "@/lib/supabase/request-cookies";

/* Server only. Runs server reads as the signed-in user of the current request (issue 248):
   getCanvasSupabase() and getPublicCanvasSupabase() inside fn read with this request's session
   cookies. Outside runSignedIn, a server read in Next.js throws instead of reading without a
   session. One store per process, shared by every bundle copy. */

type Holder = { __ifaiRequestCookies?: AsyncLocalStorage<RequestCookie[]> };
const holder = globalThis as Holder;
const storage = (holder.__ifaiRequestCookies ??= new AsyncLocalStorage<RequestCookie[]>());

/** Run fn with an explicit cookie list (tests, or a caller that already read the cookies). */
export function runWithCookies<T>(list: RequestCookie[], fn: () => Promise<T>): Promise<T> {
  return storage.run(list, fn);
}

/** Run fn with the current request's cookies. */
export async function runSignedIn<T>(fn: () => Promise<T>): Promise<T> {
  const jar = await cookies();
  return runWithCookies(
    jar.getAll().map(({ name, value }) => ({ name, value })),
    fn,
  );
}
