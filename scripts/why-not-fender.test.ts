// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/why-not-fender.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { competitorsSpokeDesc, competitorsSpokeLead } from "../lib/ai-search/canvas-surfaces.ts";
import { answerLookupId, whyNotFender } from "../lib/ai-search/why-not-fender.ts";
import type { AiSearchRead } from "../lib/ai-search/types.ts";

test("a namespaced evidence id is not looked up on the current-run view", () => {
  assert.equal(answerLookupId("b28d6086-65f3-4d12-a775-ea724ea58f22:36d23589-bc34-4d05-b6d4-939e0d20ebab"), null);
  assert.equal(answerLookupId("36d23589-bc34-4d05-b6d4-939e0d20ebab"), "36d23589-bc34-4d05-b6d4-939e0d20ebab");
});

test("why not Fender states what the stored answer did, in one plain sentence", () => {
  const view = whyNotFender({
    answerText: "  Players often start with a Yamaha Pacifica.  ",
    winner: "Yamaha",
    pages: [
      { href: "https://www.yamaha.com/pacifica?utm_source=ai", label: "Pacifica" },
      { href: "https://www.yamaha.com/pacifica?utm_source=ai", label: "duplicate" },
      { href: "not a url", label: "dropped" },
      { href: "https://www.sweetwater.com/c/pacifica", label: "Sweetwater" },
      { href: null, label: "missing" },
    ],
  });
  assert.equal(view.answer, "Players often start with a Yamaha Pacifica.");
  assert.equal(view.fenderMentioned, false);
  assert.deepEqual(
    view.pages.map((page) => [page.label, page.owner]),
    [
      ["Pacifica", "Yamaha site"],
      ["Sweetwater", "Retailer"],
    ],
  );
  assert.equal(
    view.summary,
    "Yamaha was named most. Fender/Squier was not mentioned. None of its 2 cited pages is a Fender page. 1 is on Yamaha's own site.",
  );
  assert.doesNotMatch(view.summary, /because|caused|root cause|association/i);
  assert.doesNotMatch(view.summary, /\u2014/);
});

test("a Fender mention and a Fender page are counted, not hidden", () => {
  const view = whyNotFender({
    answerText: "The Squier Classic Vibe is fine, but the Taylor GS Mini is the pick.",
    winner: "Taylor",
    pages: [{ href: "https://www.fender.com/en-US/acoustic", label: "Fender acoustics" }],
  });
  assert.equal(view.fenderMentioned, true);
  assert.equal(view.summary, "Taylor was named most. Fender/Squier was mentioned, but named less often. Its one cited page is a Fender page.");
});

test("a missing answer and a missing page stay missing", () => {
  const view = whyNotFender({ answerText: "  ", winner: "PRS", pages: [] });
  assert.equal(view.answer, null);
  assert.equal(view.fenderMentioned, null);
  assert.deepEqual(view.pages, []);
  assert.equal(view.summary, "PRS was named most. No cited page was stored.");
});

test("the Competitive Radar sentence leads with the N-of-M figure", () => {
  const read = {
    phase: "ready",
    snapshot: {
      run: {
        audit_run_id: "2d55ca62-0000-4000-8000-000000000001",
        run_state: "partial",
        collector_version: null,
        prompt_set_hash: null,
        expected_calls: 102,
        attempted_calls: 102,
        answered_calls: 80,
        error_calls: 0,
        started_at: null,
        completed_at: "2026-10-18T00:00:00.000Z",
        published_at: "2026-10-18T00:00:00.000Z",
        missing_calls: 22,
      },
      calls: [],
      probes: [],
      citations: [],
    },
  } as AiSearchRead;
  const lead = competitorsSpokeLead(read);
  assert.match(lead.figure, /^Competitors led \d+ of \d+ resolved Unbranded Discovery answers\.$/);
  assert.match(lead.explainer, /^Which brands AI engines name over Fender\/Squier/);
  assert.match(lead.explainer, /are left out\.$/);
  assert.doesNotMatch(lead.figure, /Last 30 days|Sep 19|published run/);
  assert.equal(competitorsSpokeDesc(read), `${lead.figure} ${lead.explainer}`);
});
