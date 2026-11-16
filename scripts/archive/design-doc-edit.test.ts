// node --experimental-strip-types --test scripts/design-doc-edit.test.ts
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

test("design-doc-edit.py selftest passes", (t) => {
  const result = spawnSync("python3", ["scripts/design-doc-edit.py", "selftest"], {
    encoding: "utf8",
    env: { ...process.env, DESIGN_DOC_EDIT_NO_INSTALL: "1" },
  });
  if (result.error || (result.status === 2 && result.stderr.includes("python-docx is not installed"))) {
    t.skip("python3 or python-docx is not installed; run python3 scripts/design-doc-edit.py selftest");
    return;
  }
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /^selftest passed: \d+ checks$/m);
});
