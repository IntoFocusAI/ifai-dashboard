// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/documentation-version.test.ts
/* X-26: the header badge shows the documentation version. It drifted to 25.20 for three PMs while
   the FDD and TDD moved on, so this test holds the badge to the first line of both READMEs. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = new URL("..", import.meta.url).pathname;
const read = (path: string) => readFileSync(join(root, path), "utf8");

function readmeVersion(path: string): string {
  const first = read(path).split("\n", 1)[0]!;
  const match = /^\*\*Documentation version: (\d+\.\d+)\*\*$/.exec(first.trim());
  assert.ok(match, `${path} must start with "**Documentation version: N.M**", found "${first}"`);
  return match[1]!;
}

test("X-26: the header badge equals the FDD and TDD documentation version", () => {
  const match = /export const DOCUMENTATION_VERSION = "([^"]+)";/.exec(read("lib/fender-canvas/build-canvas-spec.tsx"));
  assert.ok(match, "DOCUMENTATION_VERSION not found in lib/fender-canvas/build-canvas-spec.tsx");
  const badge = match[1];
  assert.equal(badge, readmeVersion("docs/fdd/README.md"), "badge and docs/fdd/README.md differ");
  assert.equal(badge, readmeVersion("docs/tdd/README.md"), "badge and docs/tdd/README.md differ");
});
