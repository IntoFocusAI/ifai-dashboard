/**
 * C-01: builds the deck from the dashboard's reads. Order follows docs/c01-deck-outline.md:
 * s1 to s9, then backstage b1 to b5. A slide without data is left out and listed in `omitted`.
 */

import { formatInt } from "@/lib/fender-canvas/format";
import {
  briefingFindingsLead,
  type BriefingFindingId,
} from "@/lib/fender-canvas/briefing-retail-lead";
import { rankedFindings } from "@/lib/fender-canvas/roadmap-plan";
import { contradictionSlide, openingSlides, rivalSlide, rivalTableSlide } from "@/lib/deck/deck-ai";
import { brandSiteSlide, buyBoxDetailSlide, listingSlides, stockDetailSlide, stockLossFigure } from "@/lib/deck/deck-retail";
import {
  ANALYST_ESTIMATE,
  SOURCES,
  type DeckFigure,
  type DeckFix,
  type DeckInput,
  type DeckMarker,
  type DeckModel,
  type DeckSlide,
} from "@/lib/deck/deck-types";

const OMIT_REASON: Record<string, string> = {
  s1: "No resolved unbranded discovery answer in this window.",
  s2: "No resolved unbranded discovery answer in this window.",
  s3: "No rival led an unbranded discovery answer in this window.",
  s4: "None of the four listing gaps has a stored reading.",
  s5: "No stored Buy Box reading.",
  s6: "No stored MAP comparison.",
  s7: "No stored bundle reading.",
  s8: "No stored official-page reading.",
  s9: "No finding has a stored reading.",
  b1: "No rival led an unbranded discovery answer in this window.",
  b2: "No stored Buy Box reading.",
  b3: "No out-of-stock listing has a sales estimate.",
  b4: "No analyst estimate is stored for this client.",
  b5: "No answer contradicted a published fact in this window.",
};

/** Short action per finding, from the outline; the full action line stays in Action Items. */
function fixAction(id: BriefingFindingId, input: DeckInput): string {
  return {
    exact_official_product: `Publish one ${input.brandSite} page for each exact product`,
    map_leakage: "Raise offers below MAP back to the floor",
    splintered_bundles: "Nest each bundle under the official parent listing",
    buy_box: "Correct each offer so the Buy Box returns",
    unbranded_discovery: "Track unbranded discovery as the result",
  }[id];
}

const FIX_STATUS = { critical: "bad", at_risk: "okay", on_track: "good" } as const;

/** The fix list rows as Action Items ranks them, on the date-pill window every AI figure reads. */
export function deckFixes(input: DeckInput): DeckFix[] {
  const ai = input.tabAi ? ({ phase: "ready", snapshot: input.tabAi } as const) : ({ phase: "error", message: "" } as const);
  const { findings } = briefingFindingsLead(input.retail, input.findability, ai, { aiStale: input.aiStale ?? null });
  return rankedFindings(findings)
    .filter((row) => row.stored && row.status !== "no_reading")
    .slice(0, 5)
    .map((row, index) => ({
      rank: index + 1,
      action: fixAction(row.finding.id, input),
      ratio: `${row.finding.ratio ?? ""}${row.finding.partial ? "*" : ""}`.trim(),
      status: row.status === "no_reading" ? null : FIX_STATUS[row.status],
      statusWord: row.statusLabel,
    }));
}

function pipelineSlide(input: DeckInput, present: Set<string>): DeckSlide | null {
  const markers: DeckMarker[] = [];
  if (present.has("s5")) markers.push({ title: "No buy button", line: "A withheld Buy Box removes the one-click path shoppers and AI assistants use." });
  if (present.has("s6")) markers.push({ title: "Price below MAP", line: "An offer below MAP publishes a lower number than the brand agreed to advertise." });
  if (present.has("s7")) markers.push({ title: "Split bundles", line: "A bundle on its own listing keeps its reviews off the listing assistants treat as the product." });
  if (present.has("s8")) markers.push({ title: "No machine-readable specs", line: "A spec that only appears as page text has to be guessed." });
  if (markers.length === 0) return null;
  const count = ["No", "One", "Two", "Three", "Four"][markers.length];
  return {
    id: "s4",
    kind: "pipeline",
    backstage: false,
    act: "Why the listings decide it",
    headline: `AI answers are built from ${input.brand}'s listings. ${count} ${markers.length === 1 ? "gap" : "gaps"} in those listings show up in the answer.`,
    why: `An assistant can only recommend and link what the record supports. Each gap weakens ${input.brand}'s case in the answer, and the shopper's path to buy.`,
    figures: [],
    steps: ["Shopper asks", `Assistant reads listings, prices, reviews, ${input.brandSite}`, "Assistant names a product", "Shopper buys in one click"],
    markers,
    sources: [SOURCES.suppressed, SOURCES.brandSiteSpecs],
    note: "The dashboard shows the gaps and the AI position side by side. It does not measure the effect of each gap on each answer.",
  };
}

function fixesSlide(input: DeckInput): DeckSlide | null {
  const fixes = deckFixes(input);
  if (fixes.length === 0) return null;
  const meta: DeckFigure | null = input.phaseOneLift
    ? { id: "phase-one", label: "Phase 1 lift", value: `${input.phaseOneLift} a year`, ratio: null, status: null, source: SOURCES.revenueEstimates, tip: null, estimate: true }
    : null;
  return {
    id: "s9",
    kind: "fixes",
    backstage: false,
    act: "What to fix first",
    headline: `${["No", "One fix", "Two fixes", "Three fixes", "Four fixes", "Five fixes"][fixes.length]}, in the order the dashboard ranks them.`,
    why: "Each fix closes one of the gaps an assistant repeats.",
    figures: [],
    fixes,
    meta,
    sources: meta ? [SOURCES.actionItems, SOURCES.revenueEstimates] : [SOURCES.actionItems],
    note: "The order is the dashboard's own priority list on Action Items. Close by agreeing who owns the first fix.",
  };
}

function estimatesSlide(input: DeckInput): DeckSlide | null {
  const rows: string[][] = [];
  if (input.phaseOneLift) rows.push(["Phase 1 lift, a year", input.phaseOneLift, SOURCES.revenueEstimates]);
  if (input.enterprisePotential) rows.push(["Full portfolio potential, a year", input.enterprisePotential, SOURCES.revenueEstimates]);
  const stock = stockLossFigure(input);
  if (stock) rows.push([stock.figure.label, `${stock.figure.value} (${stock.figure.ratio})`, SOURCES.outOfStock]);
  if (rows.length === 0) return null;
  return {
    id: "b4",
    kind: "table",
    backstage: true,
    act: "Backstage",
    headline: "Analyst estimates, each with its source tab.",
    why: "Every dollar figure in this deck is an analyst estimate.",
    figures: [],
    table: { columns: ["Estimate", ANALYST_ESTIMATE, "Source"], rows, caption: `${formatInt(rows.length)} analyst estimates.` },
    sources: [...new Set(rows.map((row) => row[2]))],
    note: "The inputs and formula behind each estimate open on its source tab.",
  };
}

export function buildDeck(input: DeckInput): DeckModel {
  const opening = openingSlides(input, input.tabAi);
  const rivals = rivalSlide(input, input.tabAi);
  const listings = listingSlides(input);
  const site = brandSiteSlide(input);
  const present = new Set([...listings, ...(site ? [site] : [])].map((slide) => slide.id));
  const main = [...opening, rivals, pipelineSlide(input, present), ...listings, site, fixesSlide(input)];
  const backstage = [
    rivalTableSlide(input, input.tabAi),
    buyBoxDetailSlide(input),
    stockDetailSlide(input),
    estimatesSlide(input),
    contradictionSlide(input, input.tabAi),
  ];
  const slides = [...main, ...backstage].filter((slide): slide is DeckSlide => slide != null);
  const ids = new Set(slides.map((slide) => slide.id));
  const omitted = Object.keys(OMIT_REASON)
    .filter((id) => !ids.has(id))
    .map((id) => ({ id, reason: OMIT_REASON[id] }));
  return {
    brand: input.brand,
    title: `${input.brand} in AI search: what the listings are costing`,
    window: input.windowLabel,
    asOf: input.asOf,
    slides,
    omitted,
  };
}
