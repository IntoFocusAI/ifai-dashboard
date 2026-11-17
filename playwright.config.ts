import { defineConfig, devices } from "@playwright/test";
import { productionNotice, resolveDbTarget, resolveWorkers } from "./e2e/db-target";

const PORT = Number(process.env.E2E_PORT ?? 3111);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

/* Runs against the local dev server by default. `E2E_BASE_URL` points the suite
   at an already-running server (a preview deploy, say) and skips the spawn.

   Browser: we drive the Chrome already installed on the machine so a clone does
   not need `npx playwright install` and its ~150MB download. CI, or anyone
   without Chrome, sets `E2E_BROWSER=chromium` after running
   `npx playwright install --with-deps chromium`. */
const channel = process.env.E2E_BROWSER === "chromium" ? undefined : "chrome";

/* Database target (see e2e/db-target.ts and README "Tests"). E2E_SUPABASE_URL and
   E2E_SUPABASE_ANON_KEY point the spawned dev server at a database copy; unset, it reads
   production through `.env.local`. While on production, run one suite at a time:
   workers default to 2 (E2E_WORKERS overrides). The notice prints once, from the main
   process, not from each worker. */
const dbTarget = resolveDbTarget(process.env);
const notice = productionNotice(dbTarget);
if (notice && !process.env.TEST_WORKER_INDEX) console.warn(notice);
const overridesDb = Object.keys(dbTarget.serverEnv).length > 0;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: resolveWorkers(process.env),
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  timeout: 45_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  /* A project's viewport wins over the top-level one, so each project sets its own
     after the device preset. 1280×720 is the laptop size the dashboard must work at.
     Tests tagged @1440 run again at 1440×900. */
  projects: [
    {
      name: "chrome",
      use: { ...devices["Desktop Chrome"], channel, viewport: { width: 1280, height: 720 } },
    },
    {
      name: "chrome-1440",
      grep: /@1440/,
      use: { ...devices["Desktop Chrome"], channel, viewport: { width: 1440, height: 900 } },
    },
  ],

  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npm run dev -- --port ${PORT}`,
        url: BASE_URL,
        /* A server already on the port could be reading a different database, so a
           run pointed at a copy always spawns its own and fails if the port is taken.
           Choose a free E2E_PORT. */
        reuseExistingServer: !process.env.CI && !overridesDb,
        env: { E2E_AUTH_BYPASS: "1", ...dbTarget.serverEnv },
        timeout: 120_000,
        stdout: "ignore",
        stderr: "pipe",
      },
});
