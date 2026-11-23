import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { hasReviewCredentials, signInThroughForm } from "../scripts/review-login-core.mjs";

/** Git-ignored (see .gitignore: /e2e/.auth/). Holds the signed-in browser state, never the password. */
export const REVIEW_STORAGE_STATE = resolve(__dirname, ".auth/review.json");

/** True when IFAI_REVIEW_EMAIL and IFAI_REVIEW_PASSWORD are set: the suite then runs signed in. */
export function reviewLoginEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return hasReviewCredentials(env);
}

/** Signs in through the real login form at `${baseUrl}/dashboard` and saves storageState. */
export async function saveReviewStorageState(
  baseUrl: string,
  env: NodeJS.ProcessEnv = process.env,
  statePath: string = REVIEW_STORAGE_STATE,
): Promise<string> {
  const channel = env.E2E_BROWSER === "chromium" ? undefined : "chrome";
  const browser = await chromium.launch({ channel });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await signInThroughForm(page, baseUrl, env);
    mkdirSync(dirname(statePath), { recursive: true });
    await context.storageState({ path: statePath });
  } finally {
    await browser.close();
  }
  return statePath;
}
