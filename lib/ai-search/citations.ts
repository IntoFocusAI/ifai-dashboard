import { callOutcome, cleanPrompt, type CallOutcome } from "@/lib/ai-search/run-metrics";
import type { AiCallRow, AiCitationRow } from "@/lib/ai-search/types";
import { activeClientSettings } from "@/lib/client/active-client";
import { brandOwned } from "@/lib/brand-copy";
import {
  matchesDomain,
  REFERENCE_SITE_CLASSES,
  referenceBrandSites,
  referenceDomains,
  verticalReference,
} from "@/lib/ai-search/reference-sites";
import { storedSourceClass } from "@/lib/ai-search/site-types";
import { memoByRead } from "@/lib/ai-search/read-memo";

const EMPTY_VALUES = new Set(["", "null", "undefined", "none", "nan", "n/a"]);

/** A stored URL the dashboard can link to: http(s), a real host, not a literal null. */
export function isValidCitationUrl(url: string | null | undefined): boolean {
  const key = url ?? "";
  const known = validUrls.get(key);
  if (known !== undefined) return known;
  const valid = parsesAsLink(key);
  remember(validUrls, key, valid);
  return valid;
}

/**
 * A window holds tens of thousands of citations and every figure reads them, so each URL is
 * parsed once. The caches are cleared when they grow past this many entries.
 */
const URL_CACHE_LIMIT = 50_000;
const validUrls = new Map<string, boolean>();
const canonicalUrls = new Map<string, string>();

function remember<T>(cache: Map<string, T>, key: string, value: T): void {
  if (cache.size >= URL_CACHE_LIMIT) cache.clear();
  cache.set(key, value);
}

function parsesAsLink(url: string): boolean {
  const text = url.trim();
  if (EMPTY_VALUES.has(text.toLowerCase())) return false;
  try {
    const parsed = new URL(text);
    return (parsed.protocol === "http:" || parsed.protocol === "https:") && parsed.hostname.includes(".");
  } catch {
    return false;
  }
}

const TRACKING_PARAM = /^(utm_|gclid$|fbclid$|msclkid$|mc_|ref$|ref_src$|srsltid$)/i;

/** Same page, one spelling: lowercase host without www, no fragment, no tracking parameters. */
export function canonicalUrl(url: string): string {
  const known = canonicalUrls.get(url);
  if (known !== undefined) return known;
  const canonical = parseCanonical(url);
  remember(canonicalUrls, url, canonical);
  return canonical;
}

function parseCanonical(url: string): string {
  const parsed = new URL(url.trim());
  parsed.hash = "";
  parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
  for (const key of [...parsed.searchParams.keys()]) {
    if (TRACKING_PARAM.test(key)) parsed.searchParams.delete(key);
  }
  let text = parsed.toString();
  if (parsed.pathname !== "/" && text.endsWith("/") && !parsed.search) text = text.slice(0, -1);
  return text;
}

export function normalizeDomain(domain: string | null | undefined, url?: string | null): string {
  const raw = (domain ?? "").trim().toLowerCase();
  if (raw && !EMPTY_VALUES.has(raw)) return raw.replace(/^www\./, "");
  if (url && isValidCitationUrl(url)) return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  return "";
}

export type SourceClass =
  | "fender_owned"
  | "retailer"
  | "editorial"
  | "community"
  | "video"
  | "reference"
  | "competitor_brand"
  | "other";

export const SOURCE_CLASS_LABELS: Record<SourceClass, string> = {
  get fender_owned() {
    return brandOwned();
  },
  retailer: "Retailer",
  editorial: "Editorial",
  community: "Community",
  video: "Video",
  reference: "Reference and manuals",
  competitor_brand: "Competitor brand site",
  /** A vertical with no reference list cannot tell its other sites apart, so the bucket reads Not available*. */
  get other() {
    return verticalReference(activeClientSettings().vertical) ? "Other sites" : "Not available*";
  },
};

export const SOURCE_CLASS_ORDER: SourceClass[] = [
  "fender_owned",
  "retailer",
  "editorial",
  "community",
  "video",
  "reference",
  "competitor_brand",
  "other",
];

/** Brand-owned domains for the active client (owned_domains in its settings). The class keeps its fender_owned key. */
export function ownedDomains(): string[] {
  return activeClientSettings().owned_domains;
}

/** Regional copies of the brand's own sites: ledlenser.co.uk, ledlenser.com.au, media.ledlenser.com. */
function isRegionalOwnedSite(domain: string): boolean {
  const stems = ownedDomains().map((root) => root.split(".")[0]!.replace(/[^a-z0-9-]/g, ""));
  return stems.some((stem) => new RegExp(`(^|\\.)${stem}\\.[a-z]{2,3}(\\.[a-z]{2})?$`).test(domain));
}

/**
 * A brand-owned site: one of the client's owned_domains or a subdomain of one, plus the brand's
 * regional sites when the settings turn regional_site_rule on.
 */
export function isOwnedDomain(domain: string): boolean {
  const d = domain.toLowerCase();
  if (ownedDomains().some((root) => matchesDomain(d, root))) return true;
  return activeClientSettings().regional_site_rule && isRegionalOwnedSite(d);
}

/** Competitor brand websites: the client's competitors' domains, then the vertical's brand websites. */
export function competitorSiteDomains(): string[] {
  const settings = activeClientSettings();
  const domains = settings.competitors.flatMap((competitor) => competitor.domains);
  for (const [domain] of referenceBrandSites(settings.vertical)) if (!domains.includes(domain)) domains.push(domain);
  return domains;
}

/**
 * Source-class domain lists for the brand on screen: the shared sites plus the lists for the
 * client's vertical (data/reference/), then competitor brand websites. A vertical with no list
 * reads only the shared sites and the client's own settings, never another vertical's list.
 */
export function classDomains(): Array<[SourceClass, string[]]> {
  const vertical = activeClientSettings().vertical;
  return [
    ...REFERENCE_SITE_CLASSES.map((kind): [SourceClass, string[]] => [kind, referenceDomains(vertical, kind)]),
    ["competitor_brand", competitorSiteDomains()],
  ];
}

/**
 * IntoFocus's source class for a cited domain. The stored site type (staff override, else AI or
 * seed; public.canvas_site_types) answers first. A domain with no stored type, or any domain
 * while the view is not there, uses the lists in code.
 */
export function classifySource(domain: string): SourceClass {
  const d = domain.toLowerCase();
  const stored = storedSourceClass(d);
  if (stored) return stored;
  if (isOwnedDomain(d)) return "fender_owned";
  for (const [kind, roots] of classDomains()) {
    if (roots.some((root) => matchesDomain(d, root))) return kind;
  }
  if (/(^|\.)forums?\.|forum/.test(d)) return "community";
  return "other";
}

export type CitationEvidence = {
  key: string;
  simId: number;
  simulationId: string;
  prompt: string;
  promptKind: string;
  engine: string;
  model: string | null;
  category: string;
  outcome: CallOutcome;
  position: number | null;
  rawUrl: string;
  canonicalUrl: string;
  domain: string;
  sourceClass: SourceClass;
  title: string | null;
};

export type CitationScope = "commercial" | "probe" | "all";

export type CitationRead = {
  rows: CitationEvidence[];
  /** Stored citation rows in scope before cleanup. */
  stored: number;
  /** Empty, literal null, or unparseable URLs. */
  invalid: number;
  /** The same canonical page cited twice in one answer. */
  duplicates: number;
  answered: number;
  answersWithCitation: number;
};

/** Each read's citation evidence by scope, computed once per pair of call and citation lists. */
const evidenceReads = memoByRead<AiCallRow[], (citations: AiCitationRow[]) => Map<CitationScope, CitationRead>>(() =>
  memoByRead<AiCitationRow[], Map<CitationScope, CitationRead>>(() => new Map()),
);

/** Valid, de-duplicated citations on answered calls in scope, joined to their prompt. */
export function citationEvidence(
  calls: AiCallRow[],
  citations: AiCitationRow[],
  scope: CitationScope,
): CitationRead {
  const byScope = evidenceReads(calls)(citations);
  const known = byScope.get(scope);
  if (known) return known;
  const read = readCitationEvidence(calls, citations, scope);
  byScope.set(scope, read);
  return read;
}

function readCitationEvidence(
  calls: AiCallRow[],
  citations: AiCitationRow[],
  scope: CitationScope,
): CitationRead {
  const inScope = (kind: string | null) => scope === "all" || kind === scope;
  const answered = calls.filter((call) => call.call_status === "answered" && inScope(call.prompt_kind));
  const byId = new Map(answered.map((call) => [call.id, call]));
  const seen = new Set<string>();
  const rows: CitationEvidence[] = [];
  let stored = 0;
  let invalid = 0;
  let duplicates = 0;

  for (const citation of citations) {
    const call = byId.get(citation.simulation_id);
    if (!call) continue;
    stored += 1;
    if (!isValidCitationUrl(citation.url)) {
      invalid += 1;
      continue;
    }
    const rawUrl = (citation.url as string).trim();
    const canonical = canonicalUrl(rawUrl);
    const dedupe = `${call.id}|${canonical}`;
    if (seen.has(dedupe)) {
      duplicates += 1;
      continue;
    }
    seen.add(dedupe);
    const domain = normalizeDomain(citation.domain, rawUrl);
    rows.push({
      key: `${call.id}:${citation.position ?? rows.length}`,
      simId: call.sim_id,
      simulationId: call.id,
      prompt: cleanPrompt(call.prompt),
      promptKind: call.prompt_kind ?? "",
      engine: (call.engine ?? "").toLowerCase(),
      model: call.model,
      category: call.category ?? "",
      outcome: callOutcome(call),
      position: citation.position,
      rawUrl,
      canonicalUrl: canonical,
      domain,
      sourceClass: classifySource(domain),
      title: citation.title?.trim() || null,
    });
  }

  return {
    rows,
    stored,
    invalid,
    duplicates,
    answered: answered.length,
    answersWithCitation: new Set(rows.map((row) => row.simulationId)).size,
  };
}

export type CitationGroup = { key: string; rows: number; answers: number; fenderOwnedRows: number };

export function groupCitations(
  rows: CitationEvidence[],
  keyOf: (row: CitationEvidence) => string,
): CitationGroup[] {
  const map = new Map<string, { rows: number; answers: Set<string>; fender: number }>();
  for (const row of rows) {
    const key = keyOf(row);
    const entry = map.get(key) ?? { rows: 0, answers: new Set<string>(), fender: 0 };
    entry.rows += 1;
    entry.answers.add(row.simulationId);
    if (row.sourceClass === "fender_owned") entry.fender += 1;
    map.set(key, entry);
  }
  return [...map.entries()]
    .map(([key, entry]) => ({ key, rows: entry.rows, answers: entry.answers.size, fenderOwnedRows: entry.fender }))
    .sort((a, b) => b.rows - a.rows || a.key.localeCompare(b.key));
}

/** Answered calls per engine or category, with and without at least one valid citation. */
export function citedAnswers(
  calls: AiCallRow[],
  rows: CitationEvidence[],
  scope: CitationScope,
  keyOf: (call: AiCallRow) => string,
): Array<{ key: string; answered: number; cited: number }> {
  const cited = new Set(rows.map((row) => row.simulationId));
  const map = new Map<string, { answered: number; cited: number }>();
  for (const call of calls) {
    if (call.call_status !== "answered") continue;
    if (scope !== "all" && call.prompt_kind !== scope) continue;
    const key = keyOf(call);
    const entry = map.get(key) ?? { answered: 0, cited: 0 };
    entry.answered += 1;
    if (cited.has(call.id)) entry.cited += 1;
    map.set(key, entry);
  }
  return [...map.entries()]
    .map(([key, entry]) => ({ key, ...entry }))
    .sort((a, b) => b.answered - a.answered || a.key.localeCompare(b.key));
}
