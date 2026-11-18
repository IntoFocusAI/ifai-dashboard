"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DASHBOARD_PATH } from "@/lib/auth/dashboard-path";
import { isUuid, staffReasonProblem } from "@/lib/portal/access";
import { ACTIVE_ACCOUNT_COOKIE, STAFF_REASON_COOKIE } from "@/lib/portal/contract";

/* Account picker and staff reason form on the dashboard (issue 248). Both only store selectors
   or the reason; the next dashboard load re-checks everything with the database. */

const SELECTOR_COOKIE = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/" };

export async function pickAccount(formData: FormData): Promise<void> {
  const account = String(formData.get("account") ?? "");
  if (!isUuid(account)) redirect(DASHBOARD_PATH);
  const jar = await cookies();
  jar.set(ACTIVE_ACCOUNT_COOKIE, account, { ...SELECTOR_COOKIE, maxAge: 60 * 60 * 24 * 30 });
  redirect(`${DASHBOARD_PATH}?account=${account}`);
}

export type StaffReasonState = { error: string } | null;

export async function submitStaffReason(_prev: StaffReasonState, formData: FormData): Promise<StaffReasonState> {
  const account = String(formData.get("account") ?? "");
  const reason = String(formData.get("reason") ?? "");
  if (!isUuid(account)) return { error: "Choose an account first." };
  const problem = staffReasonProblem(reason);
  if (problem) return { error: problem };
  const jar = await cookies();
  // Kept for one working session, for this account only. The database logs each open with it.
  jar.set(STAFF_REASON_COOKIE, JSON.stringify({ account, reason: reason.trim() }), {
    ...SELECTOR_COOKIE,
    path: DASHBOARD_PATH,
    maxAge: 60 * 60 * 8,
  });
  redirect(`${DASHBOARD_PATH}?account=${account}`);
}
