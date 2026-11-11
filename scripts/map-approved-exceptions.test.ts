// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/map-approved-exceptions.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { briefingFindingsLead } from "../lib/fender-canvas/briefing-retail-lead.ts";
import {
  approvedExceptionAsins,
  approvedExceptionsSentence,
  isApprovedException,
  withMapApprovedExceptions,
  withoutApprovedExceptions,
  type MapSetAsideFields,
} from "../lib/fender-canvas/map-approved-exceptions.ts";
import {
  loadPortfolioRetailSnapshot,
  mapLeakageFinding,
  type MapLeakageRow,
  type PortfolioRetailSnapshot,
} from "../lib/fender-canvas/portfolio-retail.ts";
import { mapBubble } from "../lib/fender-canvas/portfolio-retail-display.ts";
import { averageGapTip, mapHero } from "../lib/fender-canvas/retail-overview-lead.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

function row(asin: string, leak: number | null, overrides: Partial<MapLeakageRow> = {}): MapLeakageRow {
  return {
    asin,
    map_price: 100,
    offer_price: leak == null ? 90 : 100 + leak,
    amz_leakage: leak,
    wmt_leakage: null,
    mf_leakage: null,
    ...overrides,
  };
}

/** Four below MAP, two at or above, one with no comparison. */
const ROWS: MapLeakageRow[] = [
  row("B000000001", -50),
  row("B000000002", -10),
  row("B000000003", -20),
  row("B000000004", -40),
  row("B000000005", 0),
  row("B000000006", 5),
  row("B000000007", null),
];

function setAside(entity: string, overrides: Partial<MapSetAsideFields> = {}): MapSetAsideFields {
  return {
    entity_key: entity,
    status: "active",
    outcome: "set_aside",
    reason_code: "approved_exception",
    ...overrides,
  };
}

async function snapshot(rows = ROWS): Promise<PortfolioRetailSnapshot> {
  return loadPortfolioRetailSnapshot({
    suppressionRows: async () => ({ ok: false }),
    mapRows: async () => ({ ok: true, rows, truncated: false }),
    catalogRows: async () => ({ ok: false }),
    catalogBundleCount: async () => null,
    specRows: async () => ({ ok: false }),
  });
}

test("only an active Approved exception set-aside counts", () => {
  assert.equal(isApprovedException(setAside("B000000001")), true);
  assert.equal(isApprovedException(setAside("B000000001", { status: "reopened" })), false);
  assert.equal(isApprovedException(setAside("B000000001", { outcome: "done", reason_code: null })), false);
  assert.equal(isApprovedException(setAside("B000000001", { reason_code: "review_later" })), false);
  assert.equal(isApprovedException(setAside("B000000001", { reason_code: "other" })), false);

  const asins = approvedExceptionAsins([
    setAside(" b000000001 "),
    setAside("B000000002", { status: "reopened" }),
    setAside("B000000003", { outcome: "done", reason_code: null }),
    setAside("B000000004", { reason_code: "discontinued" }),
  ]);
  assert.deepEqual([...asins], ["B000000001"]);
});

test("mapLeakageFinding leaves approved exceptions out of N, M, and the average gap", () => {
  const before = mapLeakageFinding(ROWS);
  assert.equal(before.issueCount, 4);
  assert.equal(before.detail?.decided, 6);
  assert.equal(before.detail?.population, 7);
  assert.equal(before.detail?.averageLeakage, -30);
  assert.equal(before.detail?.approvedExceptions, 0);

  const after = mapLeakageFinding(ROWS, { approvedExceptions: new Set(["B000000001", "B000000006"]) });
  assert.equal(after.issueCount, 3);
  assert.equal(after.detail?.violations, 3);
  assert.equal(after.detail?.decided, 4);
  assert.equal(after.detail?.population, 5);
  assert.equal(after.detail?.averageLeakage, -23.33);
  assert.equal(after.detail?.approvedExceptions, 2);
});

test("a set-aside that matches no row in the read changes nothing", () => {
  const reading = mapLeakageFinding(ROWS, { approvedExceptions: new Set(["B0NOTINREAD"]) });
  assert.equal(reading.issueCount, 4);
  assert.equal(reading.detail?.approvedExceptions, 0);
});

test("every surface reads the same excluded figure from the shared snapshot", async () => {
  const base = await snapshot();
  assert.ok(base.mapRead, "the snapshot keeps the MAP rows");

  const excluded = withMapApprovedExceptions(base, approvedExceptionAsins([setAside("B000000002")]));
  const hero = mapHero(excluded);
  assert.equal(hero.numerator, 3);
  assert.equal(hero.denominator, 5);
  assert.equal(hero.ratio, "3 of 5*");
  assert.match(hero.tip ?? "", /1 listing set aside as an approved exception is left out of this count\./);

  // Retail Overview, Summary Briefing, and Minimal view all reuse mapHero.
  const briefing = briefingFindingsLead({ phase: "ready", snapshot: excluded }, { phase: "loading" }, { phase: "loading" });
  const map = briefing.findings.find((finding) => finding.id === "map_leakage");
  assert.equal(map?.ratio, "3 of 5*");
  assert.equal(map?.tip, hero.tip);

  const bubble = mapBubble(excluded.mapLeakage);
  assert.equal(bubble.heroValue?.value, "60.0%*");
  assert.equal(bubble.stats[0], "3 below MAP*");
  assert.match(bubble.tooltip.desc, /1 listing set aside as an approved exception/);

  assert.match(averageGapTip(excluded) ?? "", /each of 3 listings priced below MAP/);
});

test("reopening the set-aside puts the row back in the count", async () => {
  const base = await snapshot();
  const setAsideRows = [setAside("B000000002")];
  const excluded = withMapApprovedExceptions(base, approvedExceptionAsins(setAsideRows));
  assert.equal(excluded.mapLeakage.issueCount, 3);

  const reopened = withMapApprovedExceptions(
    excluded,
    approvedExceptionAsins([{ ...setAsideRows[0], status: "reopened" }]),
  );
  assert.equal(reopened.mapLeakage.issueCount, 4);
  assert.equal(reopened.mapLeakage.detail?.decided, 6);
  assert.equal(mapHero(reopened).ratio, "4 of 6");
  assert.equal(mapBubble(reopened.mapLeakage).tooltip.desc, "");
});

test("a plain Done does not remove the row from the count", async () => {
  const base = await snapshot();
  const done = withMapApprovedExceptions(
    base,
    approvedExceptionAsins([setAside("B000000002", { outcome: "done", reason_code: null })]),
  );
  assert.equal(done.mapLeakage.issueCount, 4);
  assert.equal(mapHero(done).ratio, "4 of 6");
  assert.match(mapHero(done).tip ?? "", /0 listings set aside as approved exceptions/);
});

test("the headline is reselected after the exclusion", async () => {
  const one = await snapshot([row("B000000001", -10), row("B000000002", 5)]);
  assert.equal(one.headline?.findingId, "suppressed_listings");
  const cleared = withMapApprovedExceptions(one, new Set(["B000000001"]));
  assert.equal(cleared.mapLeakage.issueCount, 0);
  assert.equal(cleared.mapLeakage.status, "available_with_zero");
});

test("a failed set-aside read says no exception was left out", async () => {
  const base = await snapshot();
  const failed = withMapApprovedExceptions(base, new Set(), { failed: true });
  assert.match(mapHero(failed).tip ?? "", /could not be loaded/);
  assert.equal(approvedExceptionsSentence(3), "3 listings set aside as approved exceptions are left out of this count.");
});

test("withoutApprovedExceptions keeps rows with no ASIN and matches case-insensitively", () => {
  const rows = [{ asin: "b000000001" }, { asin: null }, { asin: "B000000002" }];
  assert.deepEqual(withoutApprovedExceptions(rows, new Set(["B000000001"])), [{ asin: null }, { asin: "B000000002" }]);
});

test("the live hook and the MAP tab both read the MAP set-aside store", () => {
  const hook = read("components/v3/live/usePortfolioRetailSnapshot.ts");
  assert.match(hook, /useSetAsides\(activeSetAsideClientKey\(\), SET_ASIDE_CHECKS\.mapPricing\)/);
  assert.match(hook, /withMapApprovedExceptions/);
  const panel = read("components/v3/live/MapChannelPanel.tsx");
  assert.match(panel, /withoutApprovedExceptions\(rows, exceptions\)/);
  const table = read("components/v3/live/SetAsideTable.tsx");
  assert.match(table, /left out of the MAP figures above until it is reopened/);
});
