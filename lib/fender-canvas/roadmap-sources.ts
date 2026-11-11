/**
 * Roadmap and Action Items: source actions (decision 21 a, b, c, e, j).
 *
 * A cited site earns an action when it is cited in at least 10% of the shopping answers with
 * sources in at least 2 of the last 3 published runs. Each run is read as the map reads it: the
 * published run with its matching API run (decision 7). The site's type sets the action. A site
 * whose type is not listed reads Unclassified and gets no action.
 */

import {
  citationEvidence,
  classifySource,
  type CitationEvidence,
  type SourceClass,
} from "@/lib/ai-search/citations";
import { citationCategoryLabel } from "@/lib/ai-search/citation-top-sources";
import type { AiSearchSnapshot } from "@/lib/ai-search/types";
import { brandName, brandSite } from "@/lib/brand-copy";
import { formatInt, formatPct } from "@/lib/fender-canvas/format";

/** 21b: share of shopping answers with sources that cite the site. */
export const SOURCE_SHARE_THRESHOLD = 0.1;
/** 21b: runs at or over the threshold, of the last published runs read. */
export const SOURCE_RUNS_REQUIRED = 2;
export const SOURCE_RUNS_WINDOW = 3;
/** 21j: categories named on each source action. */
export const SOURCE_CATEGORY_LIMIT = 3;

/** 21a site types. Unlisted sites read Unclassified. */
export type SiteType =
  | "brand_owned"
  | "retailer"
  | "publication"
  | "community"
  | "video"
  | "competitor_brand"
  | "reference"
  | "unclassified";

export const SITE_TYPE_LABELS: Record<SiteType, string> = {
  brand_owned: "Brand-owned",
  retailer: "Retailer",
  publication: "Publication or review",
  community: "Community or forum",
  video: "Video",
  competitor_brand: "Competitor brand",
  reference: "Reference",
  unclassified: "Unclassified",
};

const FROM_SOURCE_CLASS: Record<SourceClass, SiteType> = {
  fender_owned: "brand_owned",
  retailer: "retailer",
  editorial: "publication",
  community: "community",
  video: "video",
  reference: "reference",
  competitor_brand: "competitor_brand",
  other: "unclassified",
};

/** The site's type, from the source lists the Citation Ecosystem already uses. */
export function siteType(domain: string): SiteType {
  return FROM_SOURCE_CLASS[classifySource(domain)];
}

/** 21c, wording for Brian's approval. Brand-owned and Unclassified sites get no source action. */
const ACTIONS: Partial<Record<SiteType, (site: string) => string>> = {
  publication: (site) => `PR and review outreach to get ${brandName()} products into the ${site} buying guides.`,
  community: (site) => `Set a plan to keep ${brandName()}'s presence on ${site} accurate.`,
  retailer: (site) => `Check that ${brandName()} listings on ${site} match the brand's product facts.`,
  video: (site) => `Creator outreach on ${site}.`,
  competitor_brand: (site) => `Publish comparison content on ${brandSite()} for the products ${site} is cited for.`,
  reference: (site) => `Correct the ${brandName()} entry on ${site}.`,
};

export function hasSourceAction(type: SiteType): boolean {
  return ACTIONS[type] != null;
}

/** The 21c action for a site of this type, or null for brand-owned and Unclassified sites. */
export function sourceActionWording(type: SiteType, site: string): string | null {
  return ACTIONS[type]?.(site) ?? null;
}

export type CitedPage = { url: string; title: string | null; answers: number };

export type SourceAction = {
  domain: string;
  type: SiteType;
  /** Shopping answers with sources in the latest run that cite the site. */
  answers: number;
  /** Shopping answers with sources in the latest run. */
  answersWithSources: number;
  /** answers / answersWithSources, 0 to 1. */
  share: number;
  /** Runs read at or over the threshold, and runs read. */
  runsOver: number;
  runsRead: number;
  categories: string[];
  /** Stored category keys the site is cited in, for a client focus (rolling plan). */
  categoryKeys: string[];
  pages: CitedPage[];
  fact: string;
  action: string;
};

export type RunShares = {
  read: ReturnType<typeof citationEvidence>;
  byDomain: Map<string, CitationEvidence[]>;
};

export function runShares(snapshot: AiSearchSnapshot): RunShares {
  const read = citationEvidence(snapshot.calls, snapshot.citations, "commercial");
  const byDomain = new Map<string, CitationEvidence[]>();
  for (const row of read.rows) {
    if (!row.domain) continue;
    const list = byDomain.get(row.domain) ?? [];
    list.push(row);
    byDomain.set(row.domain, list);
  }
  return { read, byDomain };
}

export function answersOf(rows: readonly CitationEvidence[]): number {
  return new Set(rows.map((row) => row.simulationId)).size;
}

export function shareIn(run: RunShares, domain: string): number {
  const total = run.read.answersWithCitation;
  if (total <= 0) return 0;
  return answersOf(run.byDomain.get(domain) ?? []) / total;
}

function topCategories(rows: readonly CitationEvidence[]): string[] {
  const answers = new Map<string, Set<string>>();
  for (const row of rows) {
    const set = answers.get(row.category) ?? new Set<string>();
    set.add(row.simulationId);
    answers.set(row.category, set);
  }
  return [...answers.entries()]
    .map(([key, set]) => ({ label: citationCategoryLabel(key), count: set.size }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, SOURCE_CATEGORY_LIMIT)
    .map((entry) => entry.label);
}

export function citedPages(rows: readonly CitationEvidence[]): CitedPage[] {
  const pages = new Map<string, { title: string | null; answers: Set<string> }>();
  for (const row of rows) {
    const page = pages.get(row.canonicalUrl) ?? { title: row.title, answers: new Set<string>() };
    page.answers.add(row.simulationId);
    if (!page.title && row.title) page.title = row.title;
    pages.set(row.canonicalUrl, page);
  }
  return [...pages.entries()]
    .map(([url, page]) => ({ url, title: page.title, answers: page.answers.size }))
    .sort((a, b) => b.answers - a.answers || a.url.localeCompare(b.url));
}

export function joinList(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function factLine(action: Omit<SourceAction, "fact" | "action">): string {
  const runs = `at 10% or more in ${action.runsOver} of the last ${action.runsRead} published runs`;
  const cited = `${action.domain} is cited in ${formatPct(100 * action.share)} of shopping answers with sources (${formatInt(action.answers)} of ${formatInt(action.answersWithSources)}), ${runs}.`;
  return action.categories.length ? `${cited} Cited most in ${joinList(action.categories)}.` : cited;
}

/**
 * Source actions from the last published runs, latest first. Ranked by the share of answers
 * the site appears in (21f). A site needs `SOURCE_RUNS_REQUIRED` runs at or over the threshold.
 */
export function sourceActions(runs: readonly AiSearchSnapshot[]): SourceAction[] {
  const read = runs.slice(0, SOURCE_RUNS_WINDOW).map(runShares);
  const latest = read[0];
  if (!latest || latest.read.answersWithCitation <= 0) return [];
  const out: SourceAction[] = [];
  for (const [domain, rows] of latest.byDomain) {
    const type = siteType(domain);
    const wording = ACTIONS[type];
    if (!wording) continue;
    const runsOver = read.filter((run) => shareIn(run, domain) >= SOURCE_SHARE_THRESHOLD).length;
    if (runsOver < SOURCE_RUNS_REQUIRED) continue;
    const base = {
      domain,
      type,
      answers: answersOf(rows),
      answersWithSources: latest.read.answersWithCitation,
      share: shareIn(latest, domain),
      runsOver,
      runsRead: read.length,
      categories: topCategories(rows),
      categoryKeys: [...new Set(rows.map((row) => row.category).filter(Boolean))].sort(),
      pages: citedPages(rows),
    };
    out.push({ ...base, fact: factLine(base), action: wording(domain) });
  }
  return out.sort((a, b) => b.share - a.share || a.domain.localeCompare(b.domain));
}
