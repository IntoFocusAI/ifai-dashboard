import type { BrowserContext, Page } from "@playwright/test";
import { expect, test } from "./fixtures";

test.use({ viewport: { width: 1280, height: 720 } });

const E2E_EMAIL = "actuation-e2e@intofocus.ai";

function base64url(value: string) {
  return Buffer.from(value).toString("base64url");
}

/** A signed-in browser session cookie, as in sites-to-review.spec.ts. The server session stays the e2e bypass (not staff). */
async function addBrowserSession(context: BrowserContext, baseURL: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL must be set for the dashboard e2e suite");
  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60 * 24;
  const user = {
    id: "00000000-0000-4000-8000-000000000e30",
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
  await expect(trigger).toContainText("actuation-e2e");
  await trigger.click();
  const menu = page.getByRole("menu");
  await expect(menu.getByRole("menuitem", { name: "Security" })).toBeVisible();
  return menu;
}

const PATHS = ["/dashboard/actuation-records", "/dashboard/actuation-records?client=ledlenser"];

test.describe("Actuation records (staff only, SC-03)", () => {
  test("a client user sees no link, and a forwarded link shows the staff message for both clients", async ({ page, baseURL }) => {
    await addBrowserSession(page.context(), baseURL!);
    for (const dashboard of ["/dashboard", "/dashboard?client=ledlenser"]) {
      await page.goto(dashboard);
      const menu = await openMenu(page);
      await expect(menu.getByRole("menuitem", { name: "Actuation records" })).toHaveCount(0);
    }
    for (const path of PATHS) {
      await page.goto(path);
      await expect(page.locator("[data-staff-only]"), path).toContainText("This page is for IntoFocus staff.");
      await expect(page.locator("h1")).toHaveText("Actuation records");
      await expect(page.locator("[data-actuation-records], [data-actuation-program], [data-actuation-items]")).toHaveCount(0);
      const html = await page.content();
      expect(html, path).not.toMatch(/Awaiting confirmation|Due soon|IntoFocus owner/);
    }
  });

  test("staff see the link with the client on screen; the server still checks the session", async ({ page, baseURL }) => {
    await answerStaff(page);
    await addBrowserSession(page.context(), baseURL!);
    await page.goto("/dashboard?client=ledlenser");
    const menu = await openMenu(page);
    await expect(menu.getByRole("menuitem", { name: "Sites to review" })).toBeVisible();
    const link = menu.getByRole("menuitem", { name: "Actuation records" });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "/dashboard/actuation-records?client=ledlenser");

    await link.click();
    await expect(page).toHaveURL(/\/dashboard\/actuation-records\?client=ledlenser/);
    await expect(page.locator("[data-staff-only]")).toContainText("This page is for IntoFocus staff.");
    await expect(page.locator("[data-actuation-program]")).toHaveCount(0);
  });

  test("the staff layout reads as not set up, without errors, for both clients at 1280 and 1920", async ({ page, baseURL }) => {
    // The dev-server-only staff preview (page.tsx). Reads run with the publishable key, so the
    // staff functions return nothing: absent before the migration, refused after it.
    await page.context().addCookies([{ name: "ifai-e2e-staff", value: "1", url: baseURL! }]);
    for (const size of [{ width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
      await page.setViewportSize(size);
      for (const [path, client] of [[PATHS[0], "fender"], [PATHS[1], "ledlenser"]] as const) {
        await page.goto(path);
        const root = page.locator(`[data-actuation-records="${client}"]`);
        await expect(root, path).toBeVisible();
        await expect(root).toHaveAttribute("data-actuation-state", /^(absent|error)$/);
        await expect(page.locator("[data-staff-only]")).toHaveCount(0);
        await expect(page.locator(`[data-actuation-client="${client}"]`)).toHaveAttribute("aria-current", "page");
        if ((await root.getAttribute("data-actuation-state")) === "absent") {
          await expect(page.locator("[data-actuation-absent]")).toContainText("not set up in the database yet");
        }
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `${path} at ${size.width}`).toBeLessThanOrEqual(0);
      }
    }
  });
});
