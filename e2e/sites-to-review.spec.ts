import type { BrowserContext, Page } from "@playwright/test";
import { expect, test } from "./fixtures";

test.use({ viewport: { width: 1280, height: 720 } });

const E2E_EMAIL = "sites-review-e2e@intofocus.ai";

function base64url(value: string) {
  return Buffer.from(value).toString("base64url");
}

/** A signed-in browser session cookie, as in security-disclosure.spec.ts. The server session stays the e2e bypass (not staff). */
async function addBrowserSession(context: BrowserContext, baseURL: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL must be set for the dashboard e2e suite");
  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60 * 24;
  const user = {
    id: "00000000-0000-4000-8000-000000000e2f",
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
  const session = { access_token: accessToken, token_type: "bearer", expires_in: 86400, expires_at: expiresAt, refresh_token: "e2e-refresh", user };
  await context.addCookies([
    { name: `sb-${projectRef}-auth-token`, value: `base64-${base64url(JSON.stringify(session))}`, url: baseURL },
  ]);
}

/** The menu's staff check. Unmocked it asks the dev server, whose e2e session is not staff. */
async function answerStaff(page: Page) {
  await page.route("**/dashboard/sites-to-review/staff", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ staff: true }) }),
  );
}

async function openMenu(page: Page) {
  const trigger = page.locator(".user-menu-trigger");
  await expect(trigger).toContainText("sites-review-e2e");
  await trigger.click();
  const menu = page.getByRole("menu");
  await expect(menu.getByRole("menuitem", { name: "Security" })).toBeVisible();
  return menu;
}

test.describe("Sites to review (staff only)", () => {
  test("a client user sees no link, and the page and its CSV refuse them", async ({ page, baseURL }) => {
    await addBrowserSession(page.context(), baseURL!);
    await page.reload();
    const check = await page.request.get("/dashboard/sites-to-review/staff");
    expect(await check.json()).toEqual({ staff: false });
    const menu = await openMenu(page);
    await expect(menu.getByRole("menuitem", { name: "Sites to review" })).toHaveCount(0);

    for (const path of ["/dashboard/sites-to-review", "/dashboard/sites-to-review?client=ledlenser"]) {
      const response = await page.request.get(path);
      expect(response.status(), path).toBe(404);
      expect(await response.text()).not.toContain("low-confidence site type");
    }

    const csv = await page.request.post("/dashboard/export/sites-to-review", {
      data: { keys: null, search: "", sort: null, filter: null, scope: {} },
    });
    expect(csv.headers()["content-type"] ?? "").not.toContain("text/csv");
    expect(await csv.text()).toContain("This download is for IntoFocus staff.");
  });

  test("staff see the link with the client on screen; the server still checks the session", async ({ page, baseURL }) => {
    await answerStaff(page);
    await addBrowserSession(page.context(), baseURL!);
    await page.goto("/dashboard?client=ledlenser");
    const menu = await openMenu(page);
    const link = menu.getByRole("menuitem", { name: "Sites to review" });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "/dashboard/sites-to-review?client=ledlenser");

    // The link is only a convenience: the e2e server session is not staff, so the page is a 404.
    const response = await page.request.get("/dashboard/sites-to-review?client=ledlenser");
    expect(response.status()).toBe(404);
  });
});
