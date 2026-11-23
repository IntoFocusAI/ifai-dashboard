// Shared by e2e/review-login.ts and scripts/review-screenshot.mjs. Plain JS so the CLI runs with no loader.
// Signs in as the read-only review account (Org User on every client) through the real login form.
// The credentials come only from IFAI_REVIEW_EMAIL / IFAI_REVIEW_PASSWORD; never print or log them.

export const MISSING_CREDENTIALS_MESSAGE = "IFAI_REVIEW_EMAIL/IFAI_REVIEW_PASSWORD not set; ask the PM";

/** True when both review variables are set and non-blank. */
export function hasReviewCredentials(env) {
  return Boolean(env.IFAI_REVIEW_EMAIL?.trim() && env.IFAI_REVIEW_PASSWORD);
}

/** Returns { email, password } or throws the plain missing-variables error. */
export function reviewCredentials(env) {
  if (!hasReviewCredentials(env)) throw new Error(MISSING_CREDENTIALS_MESSAGE);
  return { email: env.IFAI_REVIEW_EMAIL.trim(), password: env.IFAI_REVIEW_PASSWORD };
}

/** Validates a base URL and returns its origin (no path, no trailing slash). */
export function normalizeBaseUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`Base URL is not a valid URL: ${raw}`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error(`Base URL must be http or https: ${raw}`);
  return url.origin;
}

/**
 * CLI: <baseUrl> <path?query> <out.png> [--width N] [--height N]
 * Returns { baseUrl, path, out, width, height }.
 */
export function parseScreenshotArgs(argv) {
  const positional = [];
  let width = 1280;
  let height = 720;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--width" || arg === "--height") {
      const value = Number(argv[i + 1]);
      if (!Number.isInteger(value) || value < 100 || value > 10000) throw new Error(`${arg} needs a whole number from 100 to 10000`);
      if (arg === "--width") width = value;
      else height = value;
      i += 1;
    } else if (arg.startsWith("--")) {
      throw new Error(`Unknown option ${arg}`);
    } else {
      positional.push(arg);
    }
  }
  if (positional.length !== 3) {
    throw new Error("Usage: node scripts/review-screenshot.mjs <baseUrl> <path?query> <out.png> [--width 1280 --height 720]");
  }
  const [rawBase, rawPath, out] = positional;
  const path = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
  return { baseUrl: normalizeBaseUrl(rawBase), path, out, width, height };
}

/**
 * Signs in through the login form at /dashboard on `page`. The page ends signed in on /dashboard.
 * Throws a clear error if the form is missing or the sign-in is refused.
 */
export async function signInThroughForm(page, baseUrl, env = process.env) {
  const { email, password } = reviewCredentials(env);
  const base = normalizeBaseUrl(baseUrl);
  await page.goto(`${base}/dashboard`, { waitUntil: "domcontentloaded" });
  const emailField = page.locator('input[name="email"]');
  try {
    await emailField.waitFor({ state: "visible", timeout: 20_000 });
  } catch {
    throw new Error(
      `No login form at ${base}/dashboard. A server started with E2E_AUTH_BYPASS=1 skips the form; start it without the bypass.`,
    );
  }
  await emailField.fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  try {
    await emailField.waitFor({ state: "detached", timeout: 30_000 });
  } catch {
    const banner = (await page.locator(".auth-form-banner").first().textContent().catch(() => null))?.trim();
    throw new Error(`Review sign-in did not complete${banner ? `: ${banner}` : ""}`);
  }
}
