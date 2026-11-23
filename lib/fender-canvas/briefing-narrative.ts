/**
 * Summary › Briefing: "What this means for {brand}" (FDD H-09, decisions 128 and 129,
 * docs/briefing-narrative-spec.md). Four short blocks whose sentences are chosen from live data
 * by rule. Pure functions, no React: the component renders the parts and their custom tooltips.
 * Brand and site come in as inputs, so no sentence branches on a client (X-35).
 */

import { UNBRANDED_RATE_BANDS } from "@/lib/ai-search/summary";
import type { BriefingFinding } from "@/lib/fender-canvas/briefing-retail-lead";
import { formatInt, formatMoneyShort, formatMoneySpan, formatPct } from "@/lib/fender-canvas/format";
import { GAP_KINDS, gapKindOf } from "@/lib/fender-canvas/priority-list";
import type { RetailOverviewHeroModel } from "@/lib/fender-canvas/retail-overview-lead";

/** The plain phrases that open a custom tooltip naming the term (spec "Tooltips" table). */
export type NarrativeTerm = "unbranded" | "branded" | "cited" | "buy_box" | "map" | "specs";

/** A run of text, a phrase with its term tooltip, or the monthly dollar figure that opens its trail. */
export type NarrativePart = string | { text: string; term: NarrativeTerm } | { text: string; figure: "monthly" };

export type NarrativeSentence = NarrativePart[];

export type NarrativeBlock = {
  id: "answer" | "rely" | "worth" | "first_move";
  /** The bold lead sentence. */
  lead: NarrativeSentence;
  /** Plain sentences after the lead. */
  body: NarrativeSentence[];
  /** The block's figure is missing: the component adds Not available* with its tooltip. */
  notAvailable?: boolean;
};

/** Wins over resolved answers for one question role. */
export type RoleCount = { wins: number; resolved: number };

export type GapId = "exact_pages" | "missing_specs" | "buy_box" | "splintered" | "map_leakage";

/** One listing gap with a stored reading: how many are affected, of how many, and its status. */
export type GapReading = {
  id: GapId;
  affected: number;
  population: number;
  tone: "danger" | "warning" | "success";
};

/** The client's selling model (settings seller_type): partner-led or brand-led. */
export type SellerModel = "Partner-led" | "Brand-led";

export type NarrativeInput = {
  brand: string;
  site: string;
  sellerModel: SellerModel;
  /** null while the AI read is not ready. */
  unbranded: RoleCount | null;
  branded: RoleCount | null;
  cited: { owned: number; total: number } | null;
  /** Gaps with a stored reading; a gap with none is left out. */
  gaps: GapReading[];
};

export type MonthlyRange = { low: number; mid: number; high: number };

export const TERM_TIPS: Record<NarrativeTerm, { title: string; desc: (brand: string) => string }> = {
  unbranded: {
    title: "Unbranded Discovery",
    desc: () =>
      "Shopping questions that do not name a brand, asked of ChatGPT, Gemini and Perplexity three times each in the date-pill window.",
  },
  branded: { title: "Branded Consideration", desc: (brand) => `Shopping questions that name ${brand}.` },
  cited: {
    title: "Cited pages",
    desc: () => "The links the assistants cited in their answers. Cited pages are associations, not proof of cause.",
  },
  buy_box: { title: "Buy Box", desc: () => "Amazon's buy button, also called the Featured Offer." },
  map: { title: "MAP", desc: () => "Minimum advertised price." },
  specs: { title: "Amazon required fields", desc: () => "The detail fields on the approved list for the product type." },
};

/**
 * Proposed for Brian's approval (decision 129): why each gap changes what assistants recommend.
 * `one` is true when the gap counts a single listing, bundle or offer.
 */
export const GAP_CLAUSES: Record<GapId, (brand: string, one: boolean, model: SellerModel) => string> = {
  exact_pages: (brand) => `so assistants describe those products from retailer and rival pages instead of ${brand}'s`,
  missing_specs: (_brand, one) => `so assistants struggle to match ${one ? "it" : "them"} to shoppers' questions`,
  buy_box: (_brand, one) =>
    `so assistants rarely point shoppers to ${one ? "it" : "them"}, and the sales and reviews ${one ? "it" : "they"} would earn often go to a competitor`,
  splintered: (_brand, one) => `so assistants see fewer reviews behind ${one ? "it" : "each one"} and recommend it less`,
  // Partner-led: discounting by partners erodes the brand's retail value; brand-led: its own revenue (Brian, 23 Nov).
  map_leakage: (brand, _one, model) =>
    `so assistants can repeat a price below the one ${brand} sets, and the discounting erodes ${brand}'s ${model === "Partner-led" ? "retail value" : "revenue"}`,
};

/**
 * The AI consequence for every kind of item the central ranking can put first (GAP_KINDS in
 * priority-list.ts). The five kinds that are Block 2 gaps reuse GAP_CLAUSES; the rest are
 * proposed for Brian's approval (23 Nov). A test fails when a ranked kind has no clause.
 */
const RANKED_KIND_CLAUSES: Record<string, (brand: string, one: boolean, model: SellerModel) => string> = {
  exact_official_product: GAP_CLAUSES.exact_pages,
  map_leakage: GAP_CLAUSES.map_leakage,
  splintered_bundles: GAP_CLAUSES.splintered,
  buy_box: GAP_CLAUSES.buy_box,
  missing_specs: GAP_CLAUSES.missing_specs,
  unbranded_discovery: (brand) => `so assistants name a rival before ${brand} when shoppers ask what to buy`,
  out_of_stock: (_brand, one) => `so assistants stop recommending ${one ? "it" : "them"}, and the sales go to a competitor's listing`,
  fact_contradictions: (brand) => `so assistants give shoppers conflicting facts about ${brand}'s products`,
  rival: (brand) => `so assistants keep naming that rival ahead of ${brand}`,
  aplus: () => "so assistants have less product detail to read and compare",
  amazon_bullets: () => "so assistants have less product detail to read and compare",
  source: (brand) => `so assistants keep relying on pages ${brand} does not control`,
  own_pages: (brand) => `so assistants have fewer of ${brand}'s own pages to read and cite`,
  own_wording: (brand) => `so assistants do not find the words shoppers use on ${brand}'s own pages`,
  engine: (brand) => `so one assistant recommends ${brand} less often than the others`,
  question: (brand) => `so assistants answer that shopper question without naming ${brand}`,
  questions: (brand) => `so assistants answer those shopper questions without naming ${brand}`,
  site: (brand) => `so assistants find fewer outside pages that mention ${brand}`,
  actuation_activity: (brand) => `so assistants find fewer independent mentions of ${brand} to rely on`,
  actuation_confirm: (brand) => `so assistants find fewer independent mentions of ${brand} to rely on`,
  actuation_renew: (brand) => `so assistants stop counting those independent mentions of ${brand}`,
};

/** Kinds in GAP_KINDS that have no clause (a test requires this to be empty). */
export function kindsWithoutClause(): string[] {
  return Object.keys(GAP_KINDS).filter((kind) => !(kind in RANKED_KIND_CLAUSES));
}

/** Priorities keep the saved ids of the Buy Box and MAP cards (command-center-from-live.ts KEPT_IDS). */
const KEPT_PRIORITY_KINDS: Readonly<Record<string, string>> = { "buybox-suppression": "buy_box", "map-leakage": "map_leakage" };

/** The ranked kind of a Priorities card id (a plan id, or a kept id). */
export function rankedKindOfPriorityId(id: string): string {
  return KEPT_PRIORITY_KINDS[id] ?? gapKindOf(id);
}

/** The AI consequence clause for a ranked kind, or null for a kind with none. The count is unknown, so plural. */
export function rankedKindClause(kind: string, brand: string, model: SellerModel): string | null {
  return RANKED_KIND_CLAUSES[kind]?.(brand, false, model) ?? null;
}

/**
 * Branded share bands for the trust sentence (Brian, 23 Nov, final): below 70 is the low state,
 * 70 up to but not including 90 is "room to build trust", 90 and above is the high state.
 */
export const BRANDED_TRUST_BANDS = { lowBelow: 70, highAtOrAbove: 90 } as const;
export type BrandedTrustBand = "low" | "room" | "high";

export function brandedTrustBand(share: number): BrandedTrustBand {
  if (share >= BRANDED_TRUST_BANDS.highAtOrAbove) return "high";
  if (share >= BRANDED_TRUST_BANDS.lowBelow) return "room";
  return "low";
}

const share = (count: RoleCount) => (100 * count.wins) / count.resolved;

/** Block 1: the answer shoppers get, from the Unbranded Discovery and Branded Consideration shares. */
export function answerBlock(input: Pick<NarrativeInput, "brand" | "unbranded" | "branded">): NarrativeBlock {
  const { brand, unbranded, branded } = input;
  if (!unbranded || unbranded.resolved <= 0) {
    return { id: "answer", lead: ["No AI answers in this window yet."], body: [], notAvailable: true };
  }
  const u = share(unbranded);
  const n = Math.round(u / 10);
  const asks: NarrativePart[] = ["When a shopper asks an AI assistant ", { text: "what to buy", term: "unbranded" }];
  let lead: NarrativeSentence;
  const body: NarrativeSentence[] = [];
  if (u > UNBRANDED_RATE_BANDS.greenAbove) {
    lead = [...asks, `, ${brand} is usually the answer: ${n} times in 10.`];
  } else if (u >= UNBRANDED_RATE_BANDS.redBelow) {
    lead = [...asks, `, ${brand} is the answer ${n} times in 10.`];
    body.push([`The other ${10 - n} times, a rival is named first.`]);
  } else {
    lead = [...asks, `, ${brand} is rarely the answer: ${n} times in 10.`];
    body.push(["A rival is named first the rest of the time."]);
  }
  const trust = brandedSentence(brand, u, branded);
  if (trust) body.push(trust);
  return { id: "answer", lead, body };
}

function brandedSentence(brand: string, u: number, branded: RoleCount | null): NarrativeSentence | null {
  if (!branded || branded.resolved <= 0) return null;
  const b = share(branded);
  const pct = `${formatPct(b)} of the time`;
  const band = brandedTrustBand(b);
  if (band === "room") {
    return ["Shoppers who already ", { text: `ask about ${brand}`, term: "branded" }, ` get confirmed ${pct}: room to build trust.`];
  }
  const highBranded = band === "high";
  const highUnbranded = u > UNBRANDED_RATE_BANDS.greenAbove;
  if (highBranded && !highUnbranded) {
    return ["Shoppers who already ", { text: `ask about ${brand}`, term: "branded" }, ` get confirmed ${pct}. The gap is being found; once found, ${brand} is trusted.`];
  }
  if (!highBranded && highUnbranded) {
    return [`${brand} is found, but shoppers who `, { text: "ask about it directly", term: "branded" }, ` get confirmed only ${pct}. The gap is trust, not discovery.`];
  }
  if (!highBranded) {
    return ["Shoppers who ", { text: `ask about ${brand}`, term: "branded" }, ` directly get confirmed ${pct}, and unbranded shoppers hear a rival first. Both need work.`];
  }
  return ["Shoppers who ", { text: `ask about ${brand}`, term: "branded" }, ` directly get confirmed ${pct}. Discovery and trust are both in good shape.`];
}

const TONE_RANK = { danger: 0, warning: 1, success: 2 } as const;
/** Ties keep the Briefing findings' order, then the spec signal (as Action Items lists them). */
const GAP_ORDER: readonly GapId[] = ["buy_box", "map_leakage", "splintered", "exact_pages", "missing_specs"];

/**
 * The three largest Poor or Fair gaps, by the Priorities' severity rule (Action Items' rankFixList):
 * Poor before Fair, then the larger share affected, then the findings' order.
 */
export function selectGaps(gaps: readonly GapReading[], limit = 3): GapReading[] {
  return gaps
    .filter((gap) => gap.tone !== "success" && gap.population > 0 && gap.affected > 0)
    .map((gap) => ({ gap, rate: gap.affected / gap.population, order: GAP_ORDER.indexOf(gap.id) }))
    .sort((a, b) => TONE_RANK[a.gap.tone] - TONE_RANK[b.gap.tone] || b.rate - a.rate || a.order - b.order)
    .slice(0, limit)
    .map(({ gap }) => gap);
}

/** One gap in plain words, ending with why it changes what assistants recommend (decision 129). */
export function gapSentence(gap: GapReading, brand: string, site: string, model: SellerModel = "Brand-led"): NarrativeSentence {
  const m = formatInt(gap.affected);
  const one = gap.affected === 1;
  const why = `, ${GAP_CLAUSES[gap.id](brand, one, model)}.`;
  const listings = one ? "listing is" : "listings are";
  switch (gap.id) {
    case "exact_pages":
      return [`${Math.round((10 * gap.affected) / gap.population)} in 10 Amazon listings have no matching page on ${site}${why}`];
    case "missing_specs":
      return [`${m} ${listings} missing the `, { text: "specs assistants compare", term: "specs" }, why];
    case "buy_box":
      return [`${m} ${listings} not showing ${brand}'s `, { text: "price at the moment of purchase", term: "buy_box" }, why];
    case "splintered":
      return [`${m} ${one ? "bundle splits its" : "bundles split their"} reviews across separate listings${why}`];
    case "map_leakage":
      return [`${m} ${one ? "offer is" : "offers are"} advertised below the `, { text: "agreed floor price", term: "map" }, why];
  }
}

/** Block 2: what assistants rely on, the owned-page share, then the three largest listing gaps. */
export function relyBlock(input: Pick<NarrativeInput, "brand" | "site" | "sellerModel" | "cited" | "gaps">): NarrativeBlock {
  const { brand, site, sellerModel, cited, gaps } = input;
  const body: NarrativeSentence[] = [];
  if (cited && cited.total > 0) {
    const pct = (100 * cited.owned) / cited.total;
    if (pct < 10) {
      body.push(["Almost none of the ", { text: "pages they read", term: "cited" }, ` (${formatPct(pct)}) are ${brand}'s own.`]);
    } else {
      const k = Math.round(cited.total / cited.owned);
      body.push([`For ${brand}, `, { text: `1 page in ${formatInt(k)} they read`, term: "cited" }, ` is ${brand}'s own.`]);
    }
  }
  const chosen = selectGaps(gaps);
  if (chosen.length) body.push(...chosen.map((gap) => gapSentence(gap, brand, site, sellerModel)));
  else if (gaps.length) body.push([`${brand}'s listings on those pages are in good shape.`]);
  return { id: "rely", lead: ["Assistants decide by reading product pages, retailer listings and reviews."], body };
}

/** Block 3: what it is worth, the monthly analyst estimate (Phase 1 divided by 12). */
export function worthBlock(monthly: MonthlyRange | null): NarrativeBlock {
  if (!monthly) return { id: "worth", lead: ["A dollar estimate is not available yet."], body: [], notAvailable: true };
  return {
    id: "worth",
    lead: ["Fixing those listings is worth about ", { text: formatMoneyShort(monthly.mid), figure: "monthly" }, " a month,"],
    body: [[`an analyst estimate (range ${formatMoneySpan(monthly.low, monthly.high)}) from the Amazon sales those listings already make.`]],
  };
}

/**
 * Block 4: the first move, central ranking #1, with its AI-search consequence (Brian, 23 Nov) so it
 * is never only a revenue line. `kind` is the item's ranked kind (rankedKindOfPriorityId).
 */
export function firstMoveBlock(
  title: string | null | undefined,
  kind: string | null = null,
  brand = "",
  model: SellerModel = "Brand-led",
): NarrativeBlock {
  const action = title?.trim().replace(/\.+$/, "");
  if (!action) return { id: "first_move", lead: [], body: [["No open action; the queue is clear."]] };
  const clause = kind ? rankedKindClause(kind, brand, model) : null;
  return { id: "first_move", lead: ["The first move:"], body: [[clause ? `${action}, ${clause}.` : `${action}.`]] };
}

/** The selling-model line (decision 128): one line, no seller names. */
export function sellingModelLine(model: SellerModel, brand: string): { label: string; text: string } {
  return model === "Brand-led"
    ? { label: "Brand-led:", text: `${brand}'s own seller accounts are meant to hold the Buy Box.` }
    : { label: "Partner-led:", text: "authorized sellers are meant to hold the Buy Box." };
}

/** Blocks 1 and 2 from the reads; blocks 3 and 4 take their own inputs. */
export function briefingNarrative(
  input: NarrativeInput,
  monthly: MonthlyRange | null,
  firstMove: string | null | undefined,
  firstMoveKind: string | null = null,
): NarrativeBlock[] {
  return [answerBlock(input), relyBlock(input), worthBlock(monthly), firstMoveBlock(firstMove, firstMoveKind, input.brand, input.sellerModel)];
}

/**
 * The gap readings from the reads the Briefing hero row and Action Items already use: the four
 * retail and Findability findings (briefingFindingsLead), and the missing Amazon spec fields from
 * specHero, the same count Action Items shows (listings missing at least one field).
 */
export function narrativeGaps(findings: readonly BriefingFinding[], spec: RetailOverviewHeroModel | null): GapReading[] {
  const ids: Partial<Record<BriefingFinding["id"], GapId>> = {
    buy_box: "buy_box",
    map_leakage: "map_leakage",
    splintered_bundles: "splintered",
    exact_official_product: "exact_pages",
  };
  const out: GapReading[] = [];
  for (const finding of findings) {
    const id = ids[finding.id];
    const { numerator, denominator } = finding;
    if (!id || finding.loading || numerator == null || denominator == null || denominator <= 0) continue;
    // A higher exact-page share is better, so the gap is the listings without one.
    const affected = id === "exact_pages" ? denominator - numerator : numerator;
    out.push({ id, affected, population: denominator, tone: finding.tone });
  }
  if (spec && spec.numerator != null && spec.denominator != null && spec.denominator > 0) {
    out.push({ id: "missing_specs", affected: spec.denominator - spec.numerator, population: spec.denominator, tone: spec.tone });
  }
  return out;
}

/** The sentence as plain text (tests, aria labels). */
export function sentenceText(sentence: NarrativeSentence): string {
  return sentence.map((part) => (typeof part === "string" ? part : part.text)).join("");
}

/** A block as plain text: the lead, then its sentences. */
export function blockText(block: NarrativeBlock): string {
  return [block.lead, ...block.body].map(sentenceText).filter(Boolean).join(" ");
}
