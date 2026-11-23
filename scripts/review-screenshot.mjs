#!/usr/bin/env node
// Signed-in screenshot of any dashboard page (local dev server or a Netlify preview).
//   node scripts/review-screenshot.mjs <baseUrl> <path?query> <out.png> [--width 1280 --height 720]
// Needs IFAI_REVIEW_EMAIL and IFAI_REVIEW_PASSWORD in the environment. Prints the visible text length.
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { parseScreenshotArgs, signInThroughForm } from "./review-login-core.mjs";

const require = createRequire(import.meta.url);

async function main() {
  const { baseUrl, path, out, width, height } = parseScreenshotArgs(process.argv.slice(2));
  const { chromium } = require("playwright");
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    await signInThroughForm(page, baseUrl);
    await page.goto(`${baseUrl}${path}`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 60_000 }).catch(() => {});
    await page.waitForFunction(() => document.body.innerText.trim().length > 200, null, { timeout: 60_000 }).catch(() => {});
    const textLength = await page.evaluate(() => document.body.innerText.trim().length);
    mkdirSync(dirname(out), { recursive: true });
    await page.screenshot({ path: out });
    console.log(`visible text length: ${textLength}`);
    console.log(`saved ${out} (${width}x${height})`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
