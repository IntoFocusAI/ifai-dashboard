import type { FullConfig } from "@playwright/test";
import { reviewLoginEnabled, saveReviewStorageState } from "./review-login";

/** Runs once before the suite. With the review variables set it signs in; otherwise it does nothing
 *  and the suite keeps the E2E_AUTH_BYPASS session. */
export default async function globalSetup(config: FullConfig) {
  if (!reviewLoginEnabled()) return;
  const baseURL = config.projects[0]?.use.baseURL;
  if (!baseURL) throw new Error("No baseURL configured for the review sign-in");
  await saveReviewStorageState(baseURL);
}
