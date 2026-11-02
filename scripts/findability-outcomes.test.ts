// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/findability-outcomes.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  dealerBundleLabel,
  findabilityHeadline,
  findabilitySortValue,
  findabilityWidgetCopy,
  OUTCOME_DEFINITION,
  OUTCOME_LABEL,
  presentExplanation,
  readinessFindabilityFace,
  uncheckedReason,
} from "../lib/findability/copy.ts";
import { orderFullResult } from "../lib/fender-canvas/full-result-sort.ts";
import {
  countFindability,
  findabilityOutcome,
  findabilityShape,
  isFinishedWithoutPage,
  outcomesSumToRows,
  presentOfficialAddress,
  rowsForOutcome,
  type FindabilityOutcome,
  type FindabilityRow,
} from "../lib/findability/outcomes.ts";
import { FINDABILITY_COLUMNS, loadFindabilityRead } from "../lib/findability/queries.ts";

function row(partial: Partial<FindabilityRow> & Pick<FindabilityRow, "asin" | "latest_state">): FindabilityRow {
  return {
    title: partial.title ?? "Listing",
    category: partial.category ?? "Solid Body",
    product_kind: partial.product_kind ?? "instrument",
    latest_canonical_url: partial.latest_canonical_url ?? null,
    latest_variant_sku: partial.latest_variant_sku ?? null,
    confidence: partial.confidence ?? null,
    explanation: partial.explanation ?? null,
    source_method: partial.source_method ?? null,
    http_status: partial.http_status ?? null,
    latest_attempt_at: partial.latest_attempt_at ?? null,
    jsonld_status: partial.jsonld_status ?? "not_checked",
    counts_as_confirmed: partial.counts_as_confirmed ?? false,
    counts_as_finished_search: partial.counts_as_finished_search ?? false,
    counts_as_ambiguous: partial.counts_as_ambiguous ?? false,
    counts_as_unchecked: partial.counts_as_unchecked ?? false,
    counts_as_completed_not_found: partial.counts_as_completed_not_found ?? false,
    counts_as_blocked: partial.counts_as_blocked ?? false,
    counts_as_timeout: partial.counts_as_timeout ?? false,
    counts_as_parse_failure: partial.counts_as_parse_failure ?? false,
    counts_as_unsupported: partial.counts_as_unsupported ?? false,
    ...partial,
  };
}

function flagged(state: FindabilityOutcome, index: number): FindabilityRow {
  const confirmed = state === "exact_official_product" || state === "official_family_page";
  return row({
    asin: `${state}-${index}`,
    latest_state: state,
    latest_canonical_url: confirmed ? `https://brand.example/products/${state}-${index}` : null,
    counts_as_confirmed: confirmed,
    counts_as_finished_search: state !== "not_checked",
    counts_as_ambiguous: state === "ambiguous_candidate",
    counts_as_unchecked: state === "not_checked",
    counts_as_completed_not_found: state === "completed_not_found",
    jsonld_status: state === "not_checked" ? null : "not_checked",
  });
}

function repeat(state: FindabilityOutcome, count: number): FindabilityRow[] {
  return Array.from({ length: count }, (_, index) => flagged(state, index));
}

test("the five outcomes stay distinct and sum to the stored row count", () => {
  const rows = [
    ...repeat("exact_official_product", 89),
    ...repeat("official_family_page", 548),
    ...repeat("completed_not_found", 342),
    ...repeat("ambiguous_candidate", 8),
    ...repeat("not_checked", 5),
  ];
  const counts = countFindability(rows);
  assert.equal(rows.length, 992);
  assert.equal(counts.total, 992);
  assert.equal(counts.exact_official_product, 89);
  assert.equal(counts.official_family_page, 548);
  assert.equal(counts.completed_not_found, 342);
  assert.equal(counts.ambiguous_candidate, 8);
  assert.equal(counts.not_checked, 5);
  assert.equal(counts.other, 0);
  assert.equal(outcomesSumToRows(counts), true);
  assert.equal(findabilityShape(counts), "complete");
  assert.equal(
    counts.exact_official_product +
      counts.official_family_page +
      counts.completed_not_found +
      counts.ambiguous_candidate +
      counts.not_checked,
    counts.total,
  );

  const headline = findabilityHeadline(counts);
  assert.match(headline, /89 exact official product pages/);
  assert.match(headline, /548 official family pages/);
  assert.match(headline, /342 No Defensible Pages/);
  assert.equal(OUTCOME_LABEL.completed_not_found, "No Defensible Page");
  assert.equal(OUTCOME_LABEL.exact_official_product, "Exact official product page");
  assert.equal(OUTCOME_LABEL.official_family_page, "Official family page");
  assert.equal(OUTCOME_LABEL.ambiguous_candidate, "Ambiguous match");
  assert.equal(OUTCOME_LABEL.not_checked, "Unchecked");
  assert.equal(
    OUTCOME_DEFINITION.exact_official_product,
    "We found the fender.com page for this one product. An assistant can use that page's specs for this Amazon listing.",
  );
  assert.equal(
    OUTCOME_DEFINITION.official_family_page,
    "We found a fender.com page for the whole line. Specs on it can belong to a different color or model.",
  );
  assert.equal(
    OUTCOME_DEFINITION.completed_not_found,
    "We finished looking and did not accept a page. This does not prove the product is missing from fender.com.",
  );
  assert.equal(
    OUTCOME_DEFINITION.ambiguous_candidate,
    "More than one fender.com page could fit, so we did not pick one.",
  );
  assert.equal(
    OUTCOME_DEFINITION.not_checked,
    "This listing was not checked and should be opened for that reason. A blank result is not a missing page.",
  );
  assert.match(OUTCOME_DEFINITION.not_checked, /was not checked/);
  assert.match(OUTCOME_DEFINITION.not_checked, /opened for that reason/);
  assert.match(OUTCOME_DEFINITION.not_checked, /blank result is not a missing page/);
  assert.doesNotMatch(OUTCOME_DEFINITION.not_checked, /\byet\b/i);
  assert.doesNotMatch(OUTCOME_DEFINITION.not_checked, /still running|in progress|this pass/i);
  assert.doesNotMatch(headline, /finished search(?:es)? with no defensible page/i);
  assert.doesNotMatch(headline, /Finished search, no defensible page/);
  assert.match(headline, /8 ambiguous matches/);
  assert.match(headline, /5 unchecked listings/);
  assert.doesNotMatch(headline, /%|one third|13\.3|about one third/i);

  for (const outcome of ["exact_official_product", "official_family_page", "completed_not_found", "ambiguous_candidate", "not_checked"] as const) {
    assert.equal(rowsForOutcome(rows, outcome).length, counts[outcome]);
    assert.equal(rowsForOutcome(rows, outcome).every((item) => findabilityOutcome(item) === outcome), true);
  }
});

test("a confirmed family page is not counted as an exact page", () => {
  const family = row({
    asin: "B00FAMILY",
    latest_state: "official_family_page",
    counts_as_confirmed: true,
    counts_as_finished_search: true,
    latest_canonical_url: "https://brand.example/products/family",
    confidence: "sku",
  });
  const exact = row({
    asin: "B00EXACT",
    latest_state: "exact_official_product",
    counts_as_confirmed: true,
    counts_as_finished_search: true,
    latest_canonical_url: "https://brand.example/products/exact",
  });
  const counts = countFindability([family, exact]);
  assert.equal(findabilityOutcome(family), "official_family_page");
  assert.equal(counts.official_family_page, 1);
  assert.equal(counts.exact_official_product, 1);
  assert.equal([family, exact].filter((item) => item.counts_as_confirmed).length, 2);
  assert.notEqual(counts.exact_official_product, 2);
  assert.equal(rowsForOutcome([family, exact], "exact_official_product").map((item) => item.asin).join(), "B00EXACT");
});

test("empty and partial reads keep every outcome, including the zeros", () => {
  const empty = countFindability([]);
  assert.equal(findabilityShape(empty), "empty");
  assert.equal(empty.total, 0);
  assert.equal(outcomesSumToRows(empty), true);
  assert.equal(empty.exact_official_product, 0);
  assert.equal(empty.official_family_page, 0);
  assert.equal(empty.completed_not_found, 0);
  assert.equal(empty.ambiguous_candidate, 0);
  assert.equal(empty.not_checked, 0);
  const buildLive = readFileSync(new URL("../components/v3/build-live-spokes.tsx", import.meta.url), "utf8");
  assert.match(buildLive, /id === "specs" \? \{ desc: "" \}/);
  assert.doesNotMatch(buildLive, /findabilitySpokeDescription/);
  assert.doesNotMatch(findabilityHeadline(empty), /%|13\.3|one third/i);

  const partialRows = [
    flagged("exact_official_product", 0),
    flagged("not_checked", 0),
  ];
  const partial = countFindability(partialRows);
  assert.equal(findabilityShape(partial), "partial");
  assert.equal(partial.total, 2);
  assert.equal(partial.exact_official_product, 1);
  assert.equal(partial.not_checked, 1);
  assert.equal(partial.official_family_page, 0);
  assert.equal(partial.completed_not_found, 0);
  assert.equal(partial.ambiguous_candidate, 0);
  assert.equal(outcomesSumToRows(partial), true);
  const partialHeadline = findabilityHeadline(partial);
  assert.match(partialHeadline, /0 official family pages/);
  assert.match(partialHeadline, /0 No Defensible Pages/);
  assert.match(partialHeadline, /1 unchecked listing/);
});

test("a null URL on an unchecked row is not a finished unsuccessful search", () => {
  const unchecked = row({
    asin: "B00UNCHECKED",
    latest_state: "not_checked",
    latest_canonical_url: null,
    counts_as_unchecked: true,
    counts_as_finished_search: false,
    counts_as_completed_not_found: false,
    explanation: null,
    http_status: null,
    latest_attempt_at: null,
    jsonld_status: null,
    product_kind: null,
    confidence: null,
  });
  const address = presentOfficialAddress(unchecked);
  assert.equal(address.kind, "unchecked");
  assert.equal(isFinishedWithoutPage(address), false);
  assert.equal(address.kind === "unchecked" ? address.text : "", "not checked");
  assert.doesNotMatch(address.kind === "unchecked" ? address.text : "", /no defensible page|unsuccessful/i);

  const blankState = row({
    asin: "B00BLANK",
    latest_state: null,
    latest_canonical_url: null,
    counts_as_unchecked: true,
  });
  assert.equal(findabilityOutcome(blankState), "not_checked");
  assert.equal(isFinishedWithoutPage(presentOfficialAddress(blankState)), false);

  const finished = row({
    asin: "B00NONE",
    latest_state: "completed_not_found",
    latest_canonical_url: null,
    counts_as_completed_not_found: true,
    counts_as_finished_search: true,
    counts_as_unchecked: false,
    explanation: "Search finished without a defensible official page.",
  });
  const finishedAddress = presentOfficialAddress(finished);
  assert.equal(finishedAddress.kind, "finished-without-page");
  assert.equal(isFinishedWithoutPage(finishedAddress), true);
  assert.equal(finishedAddress.kind === "finished-without-page" ? finishedAddress.text : "", "not found");
  assert.notEqual(findabilityOutcome(finished), findabilityOutcome(unchecked));

  const ambiguous = row({
    asin: "B00AMBIG",
    latest_state: "ambiguous_candidate",
    latest_canonical_url: null,
    counts_as_ambiguous: true,
    counts_as_finished_search: true,
  });
  const ambiguousAddress = presentOfficialAddress(ambiguous);
  assert.equal(ambiguousAddress.kind, "ambiguous");
  assert.equal(ambiguousAddress.kind === "ambiguous" ? ambiguousAddress.text : "", "not found");
});

test("a blocked result stays outside the five outcomes", () => {
  const blocked = row({
    asin: "B00BLOCK",
    latest_state: "blocked",
    latest_canonical_url: null,
    counts_as_blocked: true,
    counts_as_unchecked: false,
    counts_as_completed_not_found: false,
    counts_as_finished_search: false,
  });
  assert.equal(findabilityOutcome(blocked), "other");
  assert.equal(isFinishedWithoutPage(presentOfficialAddress(blocked)), false);
  assert.notEqual(presentOfficialAddress(blocked).kind, "unchecked");
  const counts = countFindability([blocked, flagged("exact_official_product", 0)]);
  assert.equal(counts.other, 1);
  assert.equal(counts.exact_official_product, 1);
  assert.equal(outcomesSumToRows(counts), true);
  assert.equal(
    counts.exact_official_product +
      counts.official_family_page +
      counts.completed_not_found +
      counts.ambiguous_candidate +
      counts.not_checked,
    1,
  );
});

test("the findability widget uses the exact count and keeps the older percentage out", () => {
  const rows = [
    ...repeat("exact_official_product", 89),
    ...repeat("official_family_page", 548),
    ...repeat("completed_not_found", 342),
    ...repeat("ambiguous_candidate", 8),
    ...repeat("not_checked", 5),
  ];
  const copy = findabilityWidgetCopy({ phase: "ready", rows, dealerBundleLoaded: true });
  assert.equal(copy.value, "89");
  assert.match(copy.detail, /548 family pages/);
  assert.match(copy.detail, /342 No Defensible Pages/);
  assert.doesNotMatch(copy.detail, /finished search(?:es)? with no defensible page/i);
  assert.match(copy.detail, /8 ambiguous matches/);
  assert.match(copy.detail, /5 unchecked listings/);
  assert.doesNotMatch(`${copy.value} ${copy.detail}`, /%|13\.3|29\.2|pages found|one third/i);
  assert.doesNotMatch(copy.value, /548/);

  const familyConfirmed = findabilityWidgetCopy({
    phase: "ready",
    dealerBundleLoaded: true,
    rows: [
      row({
        asin: "B00FAMILY",
        latest_state: "official_family_page",
        counts_as_confirmed: true,
        counts_as_finished_search: true,
        latest_canonical_url: "https://brand.example/products/family",
      }),
      row({
        asin: "B00EXACT",
        latest_state: "exact_official_product",
        counts_as_confirmed: true,
        counts_as_finished_search: true,
        latest_canonical_url: "https://brand.example/products/exact",
      }),
    ],
  });
  assert.equal(familyConfirmed.value, "1");
  assert.match(familyConfirmed.detail, /1 family page/);

  for (const missing of [
    findabilityWidgetCopy({ phase: "loading" }),
    findabilityWidgetCopy({ phase: "error", message: "The read failed." }),
    findabilityWidgetCopy({ phase: "ready", rows: [], dealerBundleLoaded: false }),
  ]) {
    assert.notEqual(missing.value, "0");
    assert.doesNotMatch(missing.value, /%|13\.3|29\.2/);
  }
  assert.equal(findabilityWidgetCopy({ phase: "loading" }).value, "Loading");
  assert.match(findabilityWidgetCopy({ phase: "loading" }).detail, /loading/i);
  assert.equal(findabilityWidgetCopy({ phase: "error", message: "down" }).value, "Unavailable");
  assert.match(findabilityWidgetCopy({ phase: "error", message: "down" }).detail, /did not load/);
  assert.equal(findabilityWidgetCopy({ phase: "ready", rows: [], dealerBundleLoaded: false }).value, "No listings");

  const zeroExact = findabilityWidgetCopy({
    phase: "ready",
    dealerBundleLoaded: true,
    rows: [flagged("not_checked", 0)],
  });
  assert.equal(zeroExact.value, "0");
  assert.match(zeroExact.detail, /0 family pages/);
  assert.match(zeroExact.detail, /1 unchecked listing/);

  const withOther = findabilityWidgetCopy({
    phase: "ready",
    dealerBundleLoaded: true,
    rows: [
      flagged("exact_official_product", 0),
      row({
        asin: "B00BLOCK",
        latest_state: "blocked",
        counts_as_blocked: true,
        counts_as_unchecked: false,
      }),
    ],
  });
  assert.equal(withOther.value, "1");
  assert.match(withOther.detail, /1 other result/);
});

test("outcome buttons carry the explore chevron on the button", () => {
  const root = new URL("..", import.meta.url);
  const panel = readFileSync(new URL("components/v3/live/findability/FindabilityPanel.tsx", root), "utf8");
  const css = readFileSync(new URL("lib/canvas-sdk/canvas-sdk.css", root), "utf8");
  assert.match(panel, /aria-expanded=\{selected\}/);
  assert.match(panel, /aria-pressed=\{selected\}/);
  assert.match(panel, /className="retail-explore-chevron"/);
  assert.match(panel, /strokeWidth="1\.6"/);
  assert.match(panel, /width="12"/);
  assert.match(panel, /d="M2\.2 4\.2 6 8l3\.8-3\.8"/);
  const button = panel.slice(panel.indexOf("className=\"findability-count\""));
  assert.match(button, /findability-count-value[\s\S]*<OutcomeChevron \/>/);
  assert.doesNotMatch(panel.slice(0, panel.indexOf("function OutcomeChevron")), /retail-explore-chevron/);
  assert.doesNotMatch(panel.slice(panel.indexOf("function Term"), panel.indexOf("function OutcomeChevron")), /retail-explore-chevron/);
  assert.match(
    css,
    /\.findability-count\[aria-expanded="true"\] \.retail-explore-chevron \{[^}]*rotate\(180deg\)/s,
  );
});

test("findability listing cells stay short and drop the count column", () => {
  const root = new URL("..", import.meta.url);
  const table = readFileSync(new URL("components/v3/live/findability/FindabilityTable.tsx", root), "utf8");
  const resizable = readFileSync(new URL("components/v3/live/ResizableTable.tsx", root), "utf8");
  const copy = readFileSync(new URL("lib/findability/copy.ts", root), "utf8");
  assert.doesNotMatch(table, /How it is counted|countFlagLine/);
  assert.doesNotMatch(copy, /countFlagLine/);
  assert.match(table, /headerTooltip:\s*VARIANT_SKU_TOOLTIP/);
  assert.match(resizable, /headerTooltip\?:/);
  assert.match(resizable, /data-ifai-tooltip-title=\{title\}/);
  assert.match(resizable, /data-ifai-tooltip-desc=\{description\}/);
  assert.match(resizable, /tabIndex=\{0\}/);
  assert.doesNotMatch(
    resizable.slice(resizable.indexOf("function ColumnHeaderLabel"), resizable.indexOf("function readStoredRaw")),
    /\stitle=\{/,
  );

  const unchecked = row({
    asin: "B00UNCHECKED",
    latest_state: "not_checked",
    counts_as_unchecked: true,
    explanation: null,
  });
  assert.equal(presentExplanation(unchecked), "None");
  assert.equal(uncheckedReason(unchecked), "Reason not recorded");
  assert.equal(presentExplanation(row({
    asin: "B00EXACT",
    latest_state: "exact_official_product",
    explanation: "Official page has one variant.",
  })), "Official page has one variant.");
  assert.equal(dealerBundleLabel(true), "Yes");
  assert.equal(dealerBundleLabel(false), "No");
  assert.equal(dealerBundleLabel(null), "Not in this read");
});

test("unchecked reason uses the first matching flag, then the stored explanation", () => {
  const base = {
    asin: "B00REASON",
    latest_state: "not_checked" as const,
    counts_as_unchecked: true,
    explanation: "  Stored explanation.  ",
  };
  assert.equal(
    uncheckedReason(row({
      ...base,
      counts_as_blocked: true,
      counts_as_timeout: true,
      counts_as_parse_failure: true,
      counts_as_unsupported: true,
    })),
    "Blocked",
  );
  assert.equal(
    uncheckedReason(row({
      ...base,
      counts_as_timeout: true,
      counts_as_parse_failure: true,
      counts_as_unsupported: true,
    })),
    "Timeout",
  );
  assert.equal(
    uncheckedReason(row({
      ...base,
      counts_as_parse_failure: true,
      counts_as_unsupported: true,
    })),
    "Parse failure",
  );
  assert.equal(
    uncheckedReason(row({ ...base, counts_as_unsupported: true })),
    "Unsupported",
  );
  assert.equal(uncheckedReason(row(base)), "Stored explanation.");
  assert.equal(findabilitySortValue(row({ ...base, counts_as_blocked: true }), "reason"), "Blocked");

  for (const explanation of [null, "", "   ", "None", " None "]) {
    assert.equal(
      uncheckedReason(row({ ...base, explanation })),
      "Reason not recorded",
    );
  }
  assert.equal(
    uncheckedReason(row({ ...base, explanation: "None recorded" })),
    "None recorded",
  );

  const root = new URL("..", import.meta.url);
  const table = readFileSync(new URL("components/v3/live/findability/FindabilityTable.tsx", root), "utf8");
  const shared = table.slice(table.indexOf("const COLUMNS"), table.indexOf("const UNCHECKED_COLUMNS"));
  const unchecked = table.slice(table.indexOf("const UNCHECKED_COLUMNS"), table.indexOf("function columnsFor"));
  assert.match(shared, /Official page/);
  assert.match(shared, /HTTP status/);
  assert.match(shared, /"Checked"/);
  assert.match(shared, /"Outcome"/);
  assert.match(shared, /VARIANT_SKU_COLUMN/);
  assert.match(shared, /"Confidence"/);
  assert.match(shared, /How it was matched/);
  assert.doesNotMatch(shared, /"Reason"/);
  assert.match(unchecked, /"Reason"/);
  assert.match(unchecked, /"Category"/);
  assert.match(unchecked, /Product kind/);
  assert.match(unchecked, /"Explanation"/);
  assert.match(unchecked, /Dealer bundle/);
  assert.doesNotMatch(unchecked, /Official page|HTTP status|"Checked"|"Outcome"/);
  assert.doesNotMatch(unchecked, /Variant SKU|"Confidence"|How it was matched/);
  assert.match(table, /outcome === "not_checked" \? UNCHECKED_COLUMNS : COLUMNS/);
});

test("the readiness face uses outcome counts instead of the older found percentage", () => {
  const rows = [
    ...repeat("exact_official_product", 89),
    ...repeat("official_family_page", 548),
    ...repeat("completed_not_found", 342),
    ...repeat("ambiguous_candidate", 8),
    ...repeat("not_checked", 5),
  ];
  const face = readinessFindabilityFace(
    { phase: "ready", rows, dealerBundleLoaded: true },
    "91.8%",
  );
  const visible = [face.meta, ...face.stats].join(" ");
  assert.match(face.stats[0] ?? "", /89 exact/);
  assert.match(face.stats[1] ?? "", /548 family/);
  assert.match(face.meta, /342 no page/);
  assert.match(face.meta, /8 ambiguous/);
  assert.match(face.meta, /5 unchecked/);
  assert.doesNotMatch(visible, /13\.3|10\.8|one third|Found/);
  assert.doesNotMatch(face.stats.join(" "), /%/);
  // The bubble carries its own counts; it keeps no hover explainer.
  assert.equal(face.tooltipTitle, "");
  assert.equal(face.tooltipDesc, "");

  const loading = readinessFindabilityFace({ phase: "loading" }, "91.8%");
  assert.doesNotMatch(loading.stats.join(" "), /13\.3|10\.8/);
  assert.equal(loading.tooltipDesc, "");

  const root = new URL("..", import.meta.url);
  const nodes = readFileSync(new URL("lib/fender-canvas/nodes-from-live.ts", root), "utf8");
  const tour = readFileSync(new URL("lib/fender-canvas/tour-from-live.ts", root), "utf8");
  // Main AI Readiness spoke leads with pageFoundHero (spec_fender_found_pct); tour stays clear of it.
  assert.match(nodes, /pageFoundHero/);
  assert.match(nodes, /spec_fender_found_pct/);
  assert.doesNotMatch(tour, /spec_fender_found/);
});

test("filtered official-page rows sort across the whole outcome, not one page", () => {
  const rows = [
    row({ asin: "B00ZEBRA", latest_state: "exact_official_product", title: "Zebra", counts_as_confirmed: true, latest_canonical_url: "https://brand.example/z" }),
    row({ asin: "B00ALPHA", latest_state: "exact_official_product", title: "Alpha", counts_as_confirmed: true, latest_canonical_url: "https://brand.example/a" }),
    row({ asin: "B00FAMILY", latest_state: "official_family_page", title: "Alpha Family", counts_as_confirmed: true, latest_canonical_url: "https://brand.example/f" }),
  ];
  const exact = rowsForOutcome(rows, "exact_official_product");
  const ordered = orderFullResult(exact, "text", "asc", (item) => findabilitySortValue(item, "title"), (item) => item.asin);
  assert.deepEqual(ordered.map((item) => item.asin), ["B00ALPHA", "B00ZEBRA"]);
});

test("the findability query reads the stored view and keeps an unchecked blank address", async () => {
  const pages: Record<string, unknown[][]> = {
    canvas_spec_findability: [[
      row({
        asin: "B00UNCHECKED",
        latest_state: "not_checked",
        latest_canonical_url: null,
        counts_as_unchecked: true,
        jsonld_status: null,
      }),
      row({
        asin: "B00EXACT",
        latest_state: "exact_official_product",
        latest_canonical_url: "https://brand.example/products/exact",
        counts_as_confirmed: true,
        counts_as_finished_search: true,
      }),
    ]],
    canvas_retail_listings: [[{ asin: "B00EXACT", is_bundle: true }]],
  };
  const seen: string[] = [];
  const client = {
    from(view: string) {
      return {
        select(columns: string) {
          seen.push(`${view}:${columns}`);
          return {
            order() {
              let page = 0;
              const builder = {
                range() {
                  const batch = pages[view]?.[page] ?? [];
                  page += 1;
                  return Promise.resolve({ data: batch, error: null });
                },
              };
              return builder;
            },
          };
        },
      };
    },
  };

  const read = await loadFindabilityRead(client);
  assert.equal(read.phase, "ready");
  if (read.phase !== "ready") return;
  assert.equal(read.dealerBundleLoaded, true);
  assert.deepEqual(read.rows.map((item) => item.asin), ["B00UNCHECKED", "B00EXACT"]);
  assert.equal(read.rows[0]?.dealer_bundle, null);
  assert.equal(read.rows[1]?.dealer_bundle, true);
  assert.equal(isFinishedWithoutPage(presentOfficialAddress(read.rows[0]!)), false);
  assert.equal(findabilityOutcome(read.rows[0]!), "not_checked");
  assert.match(seen[0] ?? "", /canvas_spec_findability/);
  assert.match(FINDABILITY_COLUMNS, /latest_canonical_url/);
  assert.match(FINDABILITY_COLUMNS, /counts_as_confirmed/);
  assert.match(FINDABILITY_COLUMNS, /counts_as_unchecked/);
  assert.doesNotMatch(seen.join(" "), /canvas_spec_readiness/);
});
