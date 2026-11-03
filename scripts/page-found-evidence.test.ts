// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/page-found-evidence.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  buildPageFoundEvidence,
  evidenceMatchesHero,
  loadPageFoundEvidence,
  PAGE_FOUND_COLUMNS,
  REASON_NOT_RECORDED,
  storedNotFoundReason,
  type PageFoundClient,
  type PageFoundSourceRow,
} from "../lib/fender-canvas/page-found-evidence.ts";
import { brandSitePageFoundHero } from "../lib/fender-canvas/page-found-hero.ts";
import type { CanvasMetricsRow } from "../lib/fender-canvas/types.ts";

const root = new URL("..", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");

function row(
  asin: string,
  found: boolean | null,
  url: string | null = null,
  missing: string | null = null,
): PageFoundSourceRow {
  return {
    asin,
    title: `Model ${asin}`,
    fender_url: url,
    fender_found: found,
    fender_missing_fields: missing,
    checked_at: "2026-11-03T01:02:06Z",
  };
}

const STRAT = "https://www.fender.com/products/player-ii-stratocaster";

test("found and not-found rows add up to the checked count and match the hero's N of M", () => {
  const evidence = buildPageFoundEvidence([
    row("B0FOUND001", true, STRAT, "additionalProperty"),
    row("B0FOUND002", true, `${STRAT}?variant=2`, "additionalProperty"),
    row("B0MISSING1", false),
    row("B0MISSING2", false, null, "not_found_on_fender.com"),
    row("B0NULLFLAG", null, null, "additionalProperty"),
  ]);
  assert.equal(evidence.checked, 5);
  assert.equal(evidence.found, 2);
  assert.equal(evidence.notFound, 3);
  assert.equal(evidence.found + evidence.notFound, evidence.checked);

  const hero = brandSitePageFoundHero({
    spec_checked: 5,
    spec_fender_found: 2,
    spec_fender_found_pct: 40,
  } as CanvasMetricsRow);
  assert.equal(hero.ratio, "2 of 5");
  assert.equal(evidenceMatchesHero(evidence, hero), true);
  assert.equal(evidenceMatchesHero({ found: 3, checked: 5 }, hero), false);
  assert.equal(evidenceMatchesHero({ found: 2, checked: 6 }, hero), false);
});

test("a found row links to its stored fender.com page; a not-found row names a stored reason or none", () => {
  const evidence = buildPageFoundEvidence([
    row("B0FOUND001", true, STRAT, "additionalProperty"),
    row("B0FOUNDBAD", true, "not a url"),
    row("B0MISSING1", false),
    row("B0MISSING2", false, null, "not_found_on_fender.com"),
    row("B0NULLFLAG", null, null, "additionalProperty"),
  ]);
  const byAsin = new Map(evidence.rows.map((item) => [item.asin, item]));
  assert.equal(byAsin.get("B0FOUND001")?.pageHref, STRAT);
  assert.equal(byAsin.get("B0FOUND001")?.reason, null);
  assert.equal(byAsin.get("B0FOUNDBAD")?.found, true);
  assert.equal(byAsin.get("B0FOUNDBAD")?.pageHref, null);
  assert.equal(byAsin.get("B0MISSING1")?.reason, REASON_NOT_RECORDED);
  assert.equal(byAsin.get("B0MISSING1")?.pageHref, null);
  assert.equal(byAsin.get("B0MISSING2")?.reason, "Not found on fender.com");
  assert.equal(byAsin.get("B0NULLFLAG")?.found, false);
  assert.equal(byAsin.get("B0NULLFLAG")?.reason, REASON_NOT_RECORDED);
  // Not-found rows lead so the gap is the first thing in the list.
  assert.deepEqual(
    evidence.rows.map((item) => item.found),
    [false, false, false, true, true],
  );
});

test("spec field names on a not-found row are not a reason", () => {
  assert.equal(storedNotFoundReason(null), null);
  assert.equal(storedNotFoundReason(""), null);
  assert.equal(storedNotFoundReason("additionalProperty; gtin12"), null);
  assert.equal(storedNotFoundReason("not_found_on_fender.com"), "Not found on fender.com");
  assert.equal(storedNotFoundReason("additionalProperty;search_timeout"), "Search timeout");
});

test("the loader reads every checked SKU in pages and throws on a failed read", async () => {
  const all = Array.from({ length: 1036 }, (_, index) =>
    row(`B${String(index).padStart(9, "0")}`, index < 609, index < 609 ? `${STRAT}-${index}` : null),
  );
  const calls: Array<{ view: string; columns: string; from: number; to: number }> = [];
  const client = (failAt?: number): PageFoundClient => ({
    from: (view) => ({
      select: (columns) => ({
        order: () => ({
          range: async (from, to) => {
            calls.push({ view, columns, from, to });
            if (failAt === from) return { data: null, error: { message: "boom" } };
            return { data: all.slice(from, to + 1), error: null };
          },
        }),
      }),
    }),
  });
  const evidence = await loadPageFoundEvidence(client());
  assert.equal(evidence.checked, 1036);
  assert.equal(evidence.found, 609);
  assert.equal(evidence.notFound, 427);
  assert.deepEqual(
    calls.map((call) => [call.view, call.from, call.to]),
    [
      ["canvas_spec_readiness", 0, 999],
      ["canvas_spec_readiness", 1000, 1999],
    ],
  );
  assert.equal(calls[0].columns, PAGE_FOUND_COLUMNS);
  await assert.rejects(loadPageFoundEvidence(client(1000)), /canvas_spec_readiness: boom/);
});

test("the evidence table opens from the page-found hero with custom tooltips and its own stylesheet", () => {
  const panel = read("components/v3/live/MachineReadabilityPanel.tsx");
  const table = read("components/v3/live/PageFoundTable.tsx");
  const css = read("components/v3/live/page-found.css");
  assert.match(panel, /onToggle=\{\(\) => toggle\(PAGE_FOUND_HERO_ID\)\}/);
  assert.match(panel, /<PageFoundTable read=\{pageFoundRead\} hero=\{pageFound\}/);
  assert.match(panel, /usePageFoundEvidence\(openTable === PAGE_FOUND_HERO_ID\)/);
  assert.match(table, /import "@\/components\/v3\/live\/page-found\.css"/);
  assert.match(table, /target="_blank"/);
  assert.match(table, /rel="noopener noreferrer"/);
  assert.match(table, /data-page-found-reason/);
  assert.match(table, /className="ifai-term page-found-mismatch"/);
  assert.match(table, /data-ifai-tooltip-desc=\{MISMATCH_TIP\}/);
  for (const source of [panel, table]) {
    assert.doesNotMatch(source, /(?<![\w-])title=/);
    assert.doesNotMatch(source, /\u2014/);
  }
  for (const size of css.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)) {
    assert.ok(Number(size[1]) >= 10, `font-size ${size[1]}px is under the 10px floor`);
  }
  for (const path of ["components/v3/live/PageFoundTable.tsx", "components/v3/live/MachineReadabilityPanel.tsx"]) {
    const lines = read(path).replace(/\n$/, "").split("\n").length;
    assert.ok(lines <= 400, `${path} is ${lines} lines`);
  }
});
