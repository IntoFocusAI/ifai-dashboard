import { existsSync, readFileSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

/* Portal sign-in tests (issue 248). Runs the dashboard with portal accounts on, against the local
   stack from scripts/portal-local-stack.sh (never a hosted project), with no e2e auth bypass.
     scripts/portal-local-stack.sh up
     npx playwright test -c playwright.portal.config.ts --trace off
     scripts/portal-local-stack.sh down */

const ENV_FILE = ".tmp/portal-stack.env";
if (!existsSync(ENV_FILE)) {
  throw new Error(`${ENV_FILE} is missing. Run scripts/portal-local-stack.sh up first.`);
}
const stack = Object.fromEntries(
  readFileSync(ENV_FILE, "utf8")
    .split("\n")
    .filter((line) => line.includes("="))
    .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]),
);
for (const [key, value] of Object.entries(stack)) process.env[key] ??= value;

const PORT = Number(process.env.PORTAL_E2E_PORT ?? 3112);
const channel = process.env.E2E_BROWSER === "chromium" ? undefined : "chrome";

export default defineConfig({
  testDir: "./e2e/portal",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  timeout: 90_000,
  expect: { timeout: 20_000 },
  use: { baseURL: `http://localhost:${PORT}`, trace: "off", screenshot: "only-on-failure" },
  projects: [
    { name: "portal", use: { ...devices["Desktop Chrome"], channel, viewport: { width: 1280, height: 720 } } },
  ],
  webServer: {
    command: `npx next dev --port ${PORT}`,
    url: `http://localhost:${PORT}/dashboard`,
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: "ignore",
    stderr: "pipe",
    env: {
      NEXT_PUBLIC_SUPABASE_URL: stack.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: stack.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: stack.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      DASHBOARD_ACCOUNTS: "portal",
      E2E_AUTH_BYPASS: "0",
    },
  },
});
