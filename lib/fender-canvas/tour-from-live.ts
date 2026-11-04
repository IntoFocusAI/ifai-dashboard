import type { TourStep } from "@/lib/canvas-sdk/types";
import { aiTourLines } from "@/lib/ai-search/canvas-surfaces";
import { joinBrands } from "@/lib/ai-search/competitors";
import { factCheckShortLine, factsCheckedLine } from "@/lib/ai-search/fact-check-copy";
import { categoryLabel, type OutcomeTally } from "@/lib/ai-search/run-metrics";
import { pct, runStateLabel, summarizeRun } from "@/lib/ai-search/summary";
import type { AiSearchRead } from "@/lib/ai-search/types";
import type { FindabilityRead } from "@/lib/findability/copy";
import { countFindability } from "@/lib/findability/outcomes";
import { ENTERPRISE_POTENTIAL_ESTIMATE, PHASE_ONE_LIFT_ESTIMATE } from "@/lib/fender-canvas/analyst-estimates";
import { READ_NOT_AVAILABLE } from "@/lib/fender-canvas/canvas-reads";
import { formatInt } from "@/lib/fender-canvas/format";
import { specPageCounts } from "@/lib/fender-canvas/machine-readability";
import { headlineSurface, type RetailCanvasRead } from "@/lib/fender-canvas/portfolio-retail-display";
import { frameTourStep } from "@/lib/fender-canvas/primary-spoke-layout";
import type { CanvasBundle } from "@/lib/fender-canvas/types";
import { brandName, brandSite, leadBrand } from "@/lib/brand-copy";

/* Tour bullets sit in a 440px card that must not scroll at 1280x720, so each one is a
   single short line. The full sentences stay on the spokes the tour opens. */

function plural(count: number, singular: string, many = `${singular}s`): string {
  return `${formatInt(count)} ${count === 1 ? singular : many}`;
}

const N_OF_M = /\d[\d,]*\s+of\s+\d[\d,]*/;

/** The first sentence of a coverage message that carries an N of M, else its first sentence. */
function coverageSentence(message: string): string {
  const sentences = message.split(/(?<=\.)\s+/).filter(Boolean);
  return sentences.find((sentence) => N_OF_M.test(sentence)) ?? sentences[0] ?? message;
}

/** Same label and count as the ticker. An unfinished reading carries its asterisk and coverage. */
export function retailTourLines(retail: RetailCanvasRead): string[] {
  if (retail.phase === "loading") return ["Retail headline: loading"];
  if (retail.phase === "error") return [`Retail headline: ${READ_NOT_AVAILABLE} (retail read did not load)`];
  const surface = headlineSurface(retail);
  if (!surface.missingMessage) {
    return [surface.countLabel ? `${surface.label}: ${surface.countLabel}` : surface.label];
  }
  const figure = surface.countLabel ? `${surface.countLabel}*` : READ_NOT_AVAILABLE;
  const coverage = coverageSentence(surface.missingMessage);
  const read = coverage.match(N_OF_M)?.[0];
  return read ? [`${surface.label}: ${figure} (${read} read)`] : [`${surface.label}: ${figure}`, `*${coverage}`];
}

function rateLine(label: string, tally: OutcomeTally): string {
  if (tally.resolved <= 0) return `${label}: no resolved answers`;
  return `${label}: ${leadBrand()} named most in ${formatInt(tally.fenderWins)} of ${formatInt(tally.resolved)} (${pct(tally.fenderWins, tally.resolved)})`;
}

type AiTourBullets = { rates: string[]; aeo: string[]; competitors: string[] };

export function aiTourBullets(ai: AiSearchRead): AiTourBullets {
  if (ai.phase !== "ready") {
    const line =
      ai.phase === "error" && !ai.selection
        ? `AI run: ${READ_NOT_AVAILABLE} (published run did not load)`
        : aiTourLines(ai).hub;
    return { rates: [line], aeo: [line], competitors: [line] };
  }
  const s = summarizeRun(ai.snapshot);
  const rates = [rateLine("Unbranded", s.roles.unbranded), rateLine("Branded", s.roles.branded)];
  const gap = s.largestGap;
  const category = gap ? categoryLabel(gap.category) : "";
  const leaders = gap?.leaders.map((leader) => leader.brand) ?? [];
  return {
    rates,
    aeo: [
      `${runStateLabel(s.completeness.state)} run: ${formatInt(s.completeness.answered)} of ${formatInt(s.completeness.expected)} calls answered`,
      ...rates,
      `${factsCheckedLine(s.drift.coverage)}: ${factCheckShortLine(s.drift.coverage).toLowerCase()}`,
    ],
    competitors: [
      s.topCompetitor
        ? `${s.topCompetitor.brand} named most in ${formatInt(s.topCompetitor.wins)} of ${formatInt(s.topCompetitor.resolved)} unbranded answers`
        : "No competitor named most in an unbranded answer",
      ...(gap
        ? [
            `${category}: rivals out-mention ${leadBrand()} in ${formatInt(gap.competitorWins)} of ${formatInt(gap.resolved)}`,
            ...(leaders.length ? [`${category} leaders: ${joinBrands(leaders)}`] : []),
          ]
        : ["No category gap in this run"]),
      "Unbranded discovery answers only",
    ],
  };
}

export function findabilityTourBullets(read: FindabilityRead): string[] {
  if (read.phase === "loading") return ["Official-page outcomes: loading"];
  if (read.phase === "error") return [`Official pages: ${READ_NOT_AVAILABLE} (findability read did not load)`];
  const counts = countFindability(read.rows);
  if (counts.total === 0) return ["This official-page read has no listings"];
  const rest = [
    plural(counts.completed_not_found, "No Defensible Page"),
    `${formatInt(counts.ambiguous_candidate)} ambiguous`,
    `${formatInt(counts.not_checked)} unchecked`,
    ...(counts.other > 0 ? [`${formatInt(counts.other)} other`] : []),
  ];
  return [
    `${plural(counts.exact_official_product, "exact official product page")}, ${plural(counts.official_family_page, "family page")}`,
    rest.join(", "),
  ];
}

export function buildLiveTourSteps(
  bundle: CanvasBundle,
  retail: RetailCanvasRead = { phase: "loading" },
  ai: AiSearchRead = { phase: "loading" },
  findability: FindabilityRead = { phase: "loading" },
): TourStep[] {
  const schemaPages = specPageCounts(bundle.specPages);
  const aiLines = aiTourBullets(ai);
  const retailLines = retailTourLines(retail);

  return [
    {
      nodeId: "hub",
      targetX: 800,
      targetY: 500,
      radius: 185,
      title: "Brand Overview",
      subtitle: `${brandName()}'s health across catalog divisions`,
      category: "BRAND CORE",
      displays: [...retailLines, ...aiLines.rates],
      value: "Amazon listing problems and AI answers, tied to revenue.",
    },
    {
      nodeId: "ecommerce",
      targetX: 1160,
      targetY: 320,
      radius: 125,
      title: "Catalog Health",
      subtitle: "Buy Box, MAP, and catalog nesting",
      category: "RETAIL HEALTH",
      displays: [
        "Suppressed Buy Boxes, MAP leakage, and unnested bundles",
        "A partial reading keeps its count and says what is missing",
      ],
      value: "They change what AI can recommend and shoppers can buy.",
    },
    {
      nodeId: "aeo",
      targetX: 440,
      targetY: 320,
      radius: 125,
      title: "AI Search Visibility",
      subtitle: `What AI assistants say about ${brandName()} on buying questions`,
      category: "AI SEARCH VISIBILITY",
      displays: aiLines.aeo,
      value: `How often AI names ${brandName()}, what it cites, where rivals lead.`,
    },
    {
      nodeId: "specs",
      targetX: 440,
      targetY: 680,
      radius: 120,
      title: "Product Readiness",
      subtitle: "Can AI and Amazon read your specs correctly?",
      category: "AI READINESS",
      displays: [
        schemaPages
          ? `${formatInt(schemaPages.missingSpecBlock)} of ${formatInt(schemaPages.pages)} ${brandSite()} pages have no spec block`
          : `${brandSite()} page read not available`,
        ...findabilityTourBullets(findability),
        bundle.unavailable?.missing
          ? `Amazon Specs missing-field rows: ${READ_NOT_AVAILABLE} (${bundle.unavailable.missing.source} did not load)`
          : `${formatInt(bundle.missing.length)} missing-field rows are on Amazon Specs`,
      ],
      value: `Make ${brandSite()} the spec source AI trusts.`,
    },
    {
      nodeId: "competitors",
      targetX: 1160,
      targetY: 680,
      radius: 120,
      title: "Competitors",
      subtitle: `Where rivals beat ${brandName()}, and why`,
      category: "COMPETITORS",
      displays: aiLines.competitors,
      value: `Rivals AI names over ${brandName()}, by category, with every answer.`,
    },
    {
      nodeId: "suggestions",
      targetX: 800,
      targetY: 180,
      radius: 115,
      title: "Action Items & ROI",
      subtitle: "Action items, with revenue labeled as estimates",
      category: "OPPORTUNITY",
      displays: [
        "Revenue figures on this spoke are estimates",
        `Phase 1: ${PHASE_ONE_LIFT_ESTIMATE}`,
        `Enterprise: ${ENTERPRISE_POTENTIAL_ESTIMATE}`,
      ],
      value: "See what each Action Item is worth, so you know where to start.",
    },
    {
      nodeId: "roadmap",
      targetX: 800,
      targetY: 820,
      radius: 115,
      title: "90-Day Roadmap",
      subtitle: "What happens at 30, 60, and 90 days",
      category: "ROADMAP",
      displays: [...retailLines, ...aiLines.rates],
      value: "Follow a 90-day plan from the current retail headline.",
    },
  ].map(frameTourStep);
}
