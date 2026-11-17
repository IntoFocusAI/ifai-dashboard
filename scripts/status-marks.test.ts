// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/status-marks.test.ts
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { lintStatusMarks } from "./lint-status-marks.mjs";

type Finding = { file: string; line: number; rule: string; text: string };

/** X-34: no status color without its mark, and no hue outside the brand book, in components/ and lib/. */
test("components and lib carry a mark with every status color and only brand hex values", () => {
  const findings = lintStatusMarks() as Finding[];
  assert.deepEqual(
    findings.map((f) => `${f.file}:${f.line} ${f.rule} ${f.text}`),
    [],
  );
});

function fixture(files: Record<string, string>): Finding[] {
  const root = mkdtempSync(join(tmpdir(), "status-marks-"));
  try {
    for (const [path, body] of Object.entries(files)) {
      const abs = join(root, path);
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, body);
    }
    return lintStatusMarks(root) as Finding[];
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("a status color with no mark fails; the same color with StatusMark passes", () => {
  const bare = fixture({
    "components/Bare.tsx": 'export const A = () => <span style={{ color: "var(--status-bad)" }}>12%</span>;\n',
  });
  assert.deepEqual(
    bare.map((f) => f.rule),
    ["status-without-mark"],
  );
  const marked = fixture({
    "components/Marked.tsx":
      'export const A = () => <span style={{ color: "var(--status-bad)" }}>12% <StatusMark status="bad" /></span>;\n',
  });
  assert.deepEqual(marked, []);
});

test("old red, amber, green, sky, and indigo hex values fail; brand values and grays pass", () => {
  const found = fixture({
    "lib/x.css": ".a { color: #ef4444; } .b { color: #fbbf24; } .c { color: #38bdf8; } .d { color: #6366f1; } .e { color: #10b981; }\n",
    "lib/ok.css": ".a { color: #cc5b63; } .b { color: #D4B66F; } .c { color: #6ab792; } .d { color: #a7d8f0; } .e { color: #fff; } .f { color: #e8e8ec; }\n",
  });
  assert.deepEqual(
    found.map((f) => `${f.file} ${f.text}`),
    ["lib/x.css #ef4444", "lib/x.css #fbbf24", "lib/x.css #38bdf8", "lib/x.css #6366f1", "lib/x.css #10b981"],
  );
});

test("a status color on a button, menu item, or star fails", () => {
  const found = fixture({ "lib/y.css": ".save-btn:hover {\n  color: var(--success-text);\n}\n" });
  assert.deepEqual(
    found.map((f) => f.rule),
    ["status-on-control"],
  );
});
