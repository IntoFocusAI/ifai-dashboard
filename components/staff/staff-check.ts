import { SITES_TO_REVIEW_PATH } from "@/lib/ai-search/site-review";

/** The staff check route (same session check as the staff pages). Shared by every staff menu link. */
export const STAFF_CHECK_PATH = `${SITES_TO_REVIEW_PATH}/staff`;

let staffCheck: Promise<boolean> | null = null;

/**
 * Asks the server once per page load whether the signed-in user is IntoFocus staff (the same
 * session check the staff pages make). Any failure reads as not staff. This only hides links; the
 * pages and their saves each check staff again on the server.
 */
export function isStaffViewer(): Promise<boolean> {
  staffCheck ??= fetch(STAFF_CHECK_PATH, { cache: "no-store" })
    .then((response) => (response.ok ? response.json() : null))
    .then((body: { staff?: unknown } | null) => body?.staff === true)
    .catch(() => false);
  return staffCheck;
}
