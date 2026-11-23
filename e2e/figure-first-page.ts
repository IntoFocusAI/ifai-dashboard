import { expect, type Page } from "@playwright/test";

/** Live reads can take most of a minute on a cold preview; the map fixture allows 10s. */
export const LIVE_READ_TIMEOUT = 60_000;

/**
 * Opens one spoke tab by URL without the shared map fixture, and returns the page errors
 * seen so far so a spec can assert none were logged.
 */
export async function openSpokeTab(
  page: Page,
  baseURL: string | undefined,
  spoke: string,
  tabSlug: string,
): Promise<string[]> {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error).split("\n")[0]));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  // E2E_AUTH_BYPASS signs the run in on the server; no guest cookie or Skip Login any more.
  void baseURL;
  await page.goto(`/dashboard?spoke=${spoke}&tab=${tabSlug}`);
  await expect(page.locator(".drilldown-panel")).toBeVisible({ timeout: LIVE_READ_TIMEOUT });
  return errors;
}
