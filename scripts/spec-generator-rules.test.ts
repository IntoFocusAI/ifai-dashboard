// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/spec-generator-rules.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const generator = readFileSync(new URL("./generate-fender-v3-spec.mjs", import.meta.url), "utf8");

test("regenerating the spec cannot bring the division count back", () => {
  assert.doesNotMatch(generator, /division_count/);
  assert.doesNotMatch(generator, /Catalog Divisions|\bdivisions\//i);
});
