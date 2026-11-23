// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/review-login.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MISSING_CREDENTIALS_MESSAGE,
  hasReviewCredentials,
  normalizeBaseUrl,
  parseScreenshotArgs,
  reviewCredentials,
} from "./review-login-core.mjs";

test("missing variables give the plain error", () => {
  assert.equal(hasReviewCredentials({}), false);
  assert.equal(hasReviewCredentials({ IFAI_REVIEW_EMAIL: "a@b.c" }), false);
  assert.equal(hasReviewCredentials({ IFAI_REVIEW_EMAIL: "  ", IFAI_REVIEW_PASSWORD: "x" }), false);
  assert.throws(() => reviewCredentials({}), { message: "IFAI_REVIEW_EMAIL/IFAI_REVIEW_PASSWORD not set; ask the PM" });
  assert.equal(MISSING_CREDENTIALS_MESSAGE, "IFAI_REVIEW_EMAIL/IFAI_REVIEW_PASSWORD not set; ask the PM");
});

test("both variables set return the credentials", () => {
  const env = { IFAI_REVIEW_EMAIL: " r@x.test ", IFAI_REVIEW_PASSWORD: "pw" };
  assert.equal(hasReviewCredentials(env), true);
  assert.deepEqual(reviewCredentials(env), { email: "r@x.test", password: "pw" });
});

test("base URL is validated and trimmed to its origin", () => {
  assert.equal(normalizeBaseUrl("http://localhost:3111/"), "http://localhost:3111");
  assert.equal(
    normalizeBaseUrl("https://deploy-preview-12--ifai-dashboard.netlify.app/dashboard"),
    "https://deploy-preview-12--ifai-dashboard.netlify.app",
  );
  assert.throws(() => normalizeBaseUrl("not a url"), /not a valid URL/);
  assert.throws(() => normalizeBaseUrl("ftp://x.test"), /http or https/);
});

test("screenshot args: defaults, path fix-up, size flags", () => {
  assert.deepEqual(parseScreenshotArgs(["http://localhost:3111", "/dashboard?client=ledlenser", "o.png"]), {
    baseUrl: "http://localhost:3111",
    path: "/dashboard?client=ledlenser",
    out: "o.png",
    width: 1280,
    height: 720,
  });
  const sized = parseScreenshotArgs(["http://localhost:3111", "dashboard", "o.png", "--width", "1920", "--height", "1080"]);
  assert.equal(sized.path, "/dashboard");
  assert.equal(sized.width, 1920);
  assert.equal(sized.height, 1080);
});

test("screenshot args: bad input is refused", () => {
  assert.throws(() => parseScreenshotArgs(["http://localhost:3111", "/dashboard"]), /Usage/);
  assert.throws(() => parseScreenshotArgs(["http://x.test", "/d", "o.png", "--width", "abc"]), /--width needs/);
  assert.throws(() => parseScreenshotArgs(["http://x.test", "/d", "o.png", "--bogus"]), /Unknown option/);
});
