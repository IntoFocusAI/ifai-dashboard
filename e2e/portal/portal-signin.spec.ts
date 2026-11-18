/* Opening the dashboard from portal accounts (issue 248), against the local stack only.
   The portal and the dashboard share the Supabase session cookie, so each test starts with the
   cookie the portal would have set at sign-in: the dashboard must not ask to sign in again.
   Accounts are made up (supabase/tests/fixtures/portal-dashboard/30-accounts-ab.sql). */
import { execFileSync } from "node:child_process";
import { expect, test, type BrowserContext, type Page, type Request } from "@playwright/test";
import { signJwt } from "./jwt.mjs";
import { urlCarriesToken } from "../../lib/portal/access";

const A = "aaaaaaaa-0000-4000-8000-000000000001";
const B = "bbbbbbbb-0000-4000-8000-000000000002";
const USERS = {
  a: { id: "a0000000-0000-4000-8000-00000000000a", email: "a.user@example.test" },
  b: { id: "b0000000-0000-4000-8000-00000000000b", email: "b.user@example.test" },
  none: { id: "c0000000-0000-4000-8000-00000000000c", email: "none.user@example.test" },
  staff: { id: "d0000000-0000-4000-8000-00000000000d", email: "staff.user@example.test" },
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secret = process.env.PORTAL_STACK_JWT_SECRET!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const cookieName = `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;

function tokenFor(user: { id: string; email: string }): string {
  const now = Math.floor(Date.now() / 1000);
  return signJwt({ sub: user.id, email: user.email, role: "authenticated", aud: "authenticated", iat: now, exp: now + 3600 }, secret);
}

/** The session cookie the portal sets at sign-in (same project, shared on the parent domain). */
async function signInAsPortalWould(context: BrowserContext, user: { id: string; email: string }): Promise<string> {
  const accessToken = tokenFor(user);
  const session = {
    access_token: accessToken,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: "local-test-refresh",
    user: { id: user.id, aud: "authenticated", role: "authenticated", email: user.email, app_metadata: {}, user_metadata: {} },
  };
  await context.addCookies([
    {
      name: cookieName,
      value: `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`,
      domain: "localhost",
      path: "/",
      sameSite: "Lax",
    },
  ]);
  return accessToken;
}

/** Every request the browser sends to the database API. */
function recordDataRequests(page: Page): Request[] {
  const seen: Request[] = [];
  page.on("request", (request) => {
    if (request.url().startsWith(`${supabaseUrl}/rest/v1`) && request.method() !== "OPTIONS") seen.push(request);
  });
  return seen;
}

async function settle(page: Page) {
  await page.waitForLoadState("networkidle").catch(() => {});
}

function sql(query: string): string {
  return execFileSync("psql", [process.env.PORTAL_STACK_DB_URL!, "-Atc", query], { encoding: "utf8" }).trim();
}

test("anon: sent to sign-in, and the browser reads no data", async ({ page }) => {
  const requests = recordDataRequests(page);
  await page.goto("/dashboard");
  await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
  await settle(page);
  expect(requests.map((r) => r.url())).toEqual([]);
});

test("account A: opens without a second sign-in, sees only A's brand, reads as A", async ({ page, context }) => {
  const token = await signInAsPortalWould(context, USERS.a);
  const requests = recordDataRequests(page);
  // The link asks for account B and B's brand. Both are selectors; the server ignores them.
  await page.goto(`/dashboard?account=${B}&client=ledlenser`);
  await expect(page).toHaveURL(new RegExp(`/dashboard\\?account=${A}$`));
  await expect(page.getByRole("button", { name: "Log in" })).toHaveCount(0);
  await settle(page);
  expect(requests.length).toBeGreaterThan(0);
  for (const request of requests) {
    const headers = await request.allHeaders();
    expect(headers.authorization, request.url()).toBe(`Bearer ${token}`);
    expect(headers.authorization).not.toBe(`Bearer ${anonKey}`);
    expect(headers["accept-profile"] ?? "public", request.url()).not.toBe("ledlenser");
  }
  // A has one brand, so there is no brand switcher.
  await expect(page.getByLabel("Client brand")).toHaveCount(0);
  expect(urlCarriesToken(page.url())).toBe(false);
});

test("account B: sees only B's brand, reads as B", async ({ page, context }) => {
  const token = await signInAsPortalWould(context, USERS.b);
  const requests = recordDataRequests(page);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(new RegExp(`/dashboard\\?account=${B}&client=ledlenser$`));
  await settle(page);
  const profiles = new Set<string>();
  for (const request of requests) {
    const headers = await request.allHeaders();
    expect(headers.authorization, request.url()).toBe(`Bearer ${token}`);
    profiles.add(headers["accept-profile"] ?? headers["content-profile"] ?? "public");
  }
  expect(profiles.has("ledlenser")).toBe(true);
  // Asking for A's brand by URL lands back on B's.
  await page.goto(`/dashboard?account=${A}`);
  await expect(page).toHaveURL(new RegExp(`/dashboard\\?account=${B}&client=ledlenser$`));
});

test("isolation through the API: A's session cannot read B's rows, and anon reads nothing", async ({ request }) => {
  const read = (schema: string, bearer: string) =>
    request.get(`${supabaseUrl}/rest/v1/fixture_brand_rows?select=label`, {
      headers: { authorization: `Bearer ${bearer}`, apikey: anonKey, "accept-profile": schema },
    });
  const a = tokenFor(USERS.a);
  expect(await (await read("command", a)).json()).toEqual([{ label: "made-up row for account A" }]);
  expect(await (await read("ledlenser", a)).json()).toEqual([]);
  const anon = await read("command", anonKey);
  expect(anon.ok()).toBe(false);
  expect(await anon.text()).not.toContain("made-up row");
});

test("member of an account without the dashboard: not-entitled message, no data", async ({ page, context }) => {
  await signInAsPortalWould(context, USERS.none);
  const requests = recordDataRequests(page);
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "This dashboard is not part of your plan" })).toBeVisible();
  await expect(page.locator("[data-dashboard-access='not_entitled']")).toBeVisible();
  await settle(page);
  expect(requests).toEqual([]);
});

test("staff without membership: asked for a reason, then the open is logged", async ({ page, context }) => {
  sql("delete from private.module_open_log");
  await signInAsPortalWould(context, USERS.staff);
  const requests = recordDataRequests(page);
  await page.goto(`/dashboard?account=${A}`);
  await expect(page.getByRole("heading", { name: "Give a reason to open this account" })).toBeVisible();
  expect(requests).toEqual([]);

  await page.getByLabel("Reason").fill("short");
  // The browser's own minimum length check runs first; skip it to reach the server check.
  await page.locator("textarea[name=reason]").evaluate((el) => el.removeAttribute("minlength"));
  await page.getByRole("button", { name: "Open dashboard" }).click();
  await expect(page.locator(".dashboard-access-error")).toContainText("at least 10 characters");
  expect(sql("select count(*) from private.module_open_log")).toBe("0");

  await page.getByLabel("Reason").fill("Checking the weekly scores for the account review");
  await page.getByRole("button", { name: "Open dashboard" }).click();
  await expect(page).toHaveURL(new RegExp(`/dashboard\\?account=${A}$`));
  await expect(page.getByRole("heading", { name: "Give a reason to open this account" })).toHaveCount(0);
  expect(Number(sql("select count(*) from private.module_open_log where reason = 'Checking the weekly scores for the account review'"))).toBeGreaterThan(0);
  expect(sql(`select distinct organization_id from private.module_open_log`)).toBe(A);
});

test("staff: an account without the dashboard stays closed even with a reason", async ({ page, context }) => {
  await signInAsPortalWould(context, USERS.staff);
  await page.goto(`/dashboard?account=cccccccc-0000-4000-8000-000000000003`);
  await expect(page.locator("[data-dashboard-access='not_entitled']")).toBeVisible();
});

test("access screens work at 375 px and by keyboard", async ({ page, context }) => {
  await page.setViewportSize({ width: 375, height: 740 });
  await signInAsPortalWould(context, USERS.staff);
  await page.goto(`/dashboard?account=${A}`);
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Reason")).toBeFocused();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.screenshot({ path: "test-results/portal-staff-reason-375.png" });
});
