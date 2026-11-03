// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/citation-read-failure.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  CITATION_READ_ERROR_TITLE,
  citationErrorDetail,
  citationFailureCopy,
} from "../lib/ai-search/citation-read-failure.ts";

const root = new URL("..", import.meta.url).pathname;
const read = (path: string) => readFileSync(join(root, path), "utf8");
const DB_ERROR = "canceling statement due to statement timeout";

test("a failed period names the selection and offers the published run once it has loaded", () => {
  const ready = citationFailureCopy("period", "ready");
  assert.equal(ready.subject, "The selected period");
  assert.equal(ready.next, "The published run loaded. Show it here, or pick another period from the date menu above.");
  assert.equal(ready.offerPublished, true);
  for (const phase of ["loading", "error", "no-run"] as const) {
    const copy = citationFailureCopy("period", phase);
    assert.equal(copy.subject, "The selected period");
    assert.equal(copy.offerPublished, false, phase);
  }
  assert.equal(citationFailureCopy("period", "error").next, "The published run did not load either.");
  assert.equal(citationFailureCopy("period", null).next, "The published run is still loading.");
});

test("a failed published run points to the date menu when there is one", () => {
  assert.deepEqual(citationFailureCopy("published", "error"), {
    subject: "The published run",
    next: "Pick a stored run from the date menu above.",
    offerPublished: false,
  });
  assert.equal(citationFailureCopy("published", null).next, null);
});

test("the failure copy never carries the database error, and the tooltip always has text", () => {
  for (const failed of ["period", "published"] as const) {
    for (const phase of ["ready", "loading", "error", "no-run", null] as const) {
      const copy = citationFailureCopy(failed, phase);
      assert.doesNotMatch(`${copy.subject} ${copy.next ?? ""}`, /statement|timeout|database|error/i);
    }
  }
  assert.equal(CITATION_READ_ERROR_TITLE, "Database error");
  assert.equal(citationErrorDetail(DB_ERROR), DB_ERROR);
  assert.equal(citationErrorDetail("  "), "The database returned no error detail.");
});

test("Citation Ecosystem shows the read failure notice, with the database error in its tooltip only", () => {
  const panel = read("components/v3/live/ai-search/CitationEcosystemPanel.tsx");
  assert.match(
    panel,
    /if \(aggregate\.phase === "error"\) \{\s+return <CitationReadFailed failed=\{aggregate\.failed\} message=\{aggregate\.message\} \/>;/,
  );
  assert.doesNotMatch(panel, /These runs did not load|No citation figure is shown/);
  assert.equal(panel.match(/aggregate\.message/g)?.length, 2, "the failure prop and the empty-state text, nothing else");

  const notice = read("components/v3/live/ai-search/CitationReadFailed.tsx");
  assert.match(notice, /data-ai-state="error"/);
  assert.match(
    notice,
    /className="ifai-term"\s+data-citation-read-error\s+data-ifai-tooltip-title=\{CITATION_READ_ERROR_TITLE\}\s+data-ifai-tooltip-desc=\{detail\}\s+tabIndex=\{0\}\s+aria-label=\{`\$\{CITATION_READ_ERROR_TITLE\}: \$\{detail\}`\}\s*>\s*did not load\s*<\/span>/,
  );
  assert.equal(notice.match(/\{detail\}|\$\{detail\}/g)?.length, 2, "the error goes only to the tooltip and its spoken label");
  assert.doesNotMatch(notice, /\{message\}|\stitle=/);
  assert.match(notice, /data-ai-show-published\s+onClick=\{\(\) => history\.viewRun\(publishedId\)\}/);
  assert.match(notice, /copy\.offerPublished && history && publishedId \?/);

  const hook = read("components/v3/live/ai-search/useCitationAggregate.ts");
  assert.match(hook, /\{ phase: "error"; message: string; failed: CitationFailedRead \}/);
  assert.equal(hook.match(/failed: "period"/g)?.length, 1, "the history read for the selected period");
  assert.equal(hook.match(/failed: "published"/g)?.length, 2, "the published run, with or without the date menu");
});
