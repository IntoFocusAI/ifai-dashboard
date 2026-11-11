import type { BrowserContext } from "@playwright/test";
import { expect, test } from "./fixtures";

test.use({ viewport: { width: 1280, height: 720 } });

const E2E_EMAIL = "security-e2e@intofocus.ai";

function base64url(value: string) {
  return Buffer.from(value).toString("base64url");
}

/**
 * The user menu renders only for a signed-in browser session. This writes the
 * cookie the Supabase browser client reads, so no real login or network call is
 * needed. The canvas reads its data with the public key either way.
 */
async function addBrowserSession(context: BrowserContext, baseURL: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL must be set for the dashboard e2e suite");
  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60 * 24;
  const user = {
    id: "00000000-0000-4000-8000-000000000e2e",
    aud: "authenticated",
    role: "authenticated",
    email: E2E_EMAIL,
    app_metadata: { provider: "email" },
    user_metadata: {},
    created_at: new Date().toISOString(),
  };
  const accessToken = [
    base64url(JSON.stringify({ alg: "HS256", typ: "JWT" })),
    base64url(JSON.stringify({ sub: user.id, email: E2E_EMAIL, role: "authenticated", exp: expiresAt })),
    "e2e",
  ].join(".");
  const session = {
    access_token: accessToken,
    token_type: "bearer",
    expires_in: 60 * 60 * 24,
    expires_at: expiresAt,
    refresh_token: "e2e-refresh",
    user,
  };
  await context.addCookies([
    {
      name: `sb-${projectRef}-auth-token`,
      value: `base64-${base64url(JSON.stringify(session))}`,
      url: baseURL,
    },
  ]);
}

test.describe("Security disclosure", () => {
  test("the user menu opens the Security page", async ({ page, baseURL }) => {
    await addBrowserSession(page.context(), baseURL!);
    await page.reload();
    await expect(page.locator(".ifai-canvas")).toBeVisible();

    const trigger = page.locator(".user-menu-trigger");
    await expect(trigger).toContainText("security-e2e");
    await trigger.click();

    const menu = page.getByRole("menu");
    await expect(menu.getByRole("menuitem")).toContainText(["Profile settings", "Security"]);
    await menu.getByRole("menuitem", { name: "Security" }).click();

    await expect(page).toHaveURL(/\/dashboard\/security\/?$/);
    await expect(page.getByRole("heading", { level: 1, name: "Security" })).toBeVisible();

    const section = (name: string) => page.getByRole("region", { name });
    await expect(section("In place now").locator("li")).toHaveText([
      /No secret keys ship in the browser bundle\.\s*The browser uses only the public key\./,
      "IntoFocus's internal notes never appear in your evidence views.",
    ]);
    await expect(section("Planned").locator("li")).toHaveText([
      /Separating client data by brand\s*Planned before a second client joins\./,
    ]);
    await expect(section("Not decided yet").locator("li")).toHaveText([
      "Single sign-on (SSO)",
      "Audit export",
      "Data-processing agreement wording",
    ]);

    // Nothing on the page talks about fees or commercial terms.
    await expect(page.locator("main")).not.toContainText(/fee|pric|retainer|monthly|commercial|\$/i);

    // The page fits the laptop width without sideways scrolling.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    await page.getByRole("link", { name: "Back to dashboard" }).click();
    await expect(page).toHaveURL(/\/dashboard\/?$/);
    await expect(page.locator(".ifai-canvas")).toBeVisible();
  });
});
