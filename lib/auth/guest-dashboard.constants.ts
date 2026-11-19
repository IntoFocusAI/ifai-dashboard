/**
 * When true, /dashboard opens on the Log in modal (with Skip Login for the guest Fender view),
 * as it did from 6 Oct 2026 until 0ecb58b turned it off on 7 Oct. Set false to open the canvas
 * straight away again.
 */
export const DASHBOARD_LOGIN_REQUIRED: boolean = true;

/** Marks a browser as allowed to view the Fender demo canvas without signing in. */
export const GUEST_DASHBOARD_COOKIE = "ifai_guest_fender";

export const guestDashboardCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};
