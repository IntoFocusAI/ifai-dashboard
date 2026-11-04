import { callOutcome, cleanPrompt, type CallOutcome } from "@/lib/ai-search/run-metrics";
import type { AiCallRow, AiCitationRow } from "@/lib/ai-search/types";
import { activeClient } from "@/lib/client/active-client";
import { brandOwned, isFenderClient } from "@/lib/brand-copy";

const EMPTY_VALUES = new Set(["", "null", "undefined", "none", "nan", "n/a"]);

/** A stored URL the dashboard can link to: http(s), a real host, not a literal null. */
export function isValidCitationUrl(url: string | null | undefined): boolean {
  const text = (url ?? "").trim();
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
  other: "Other sites",
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

/** FMIC's brand sites. Other clients use their own brand-site domains. */
const FMIC_OWNED_DOMAINS = ["fender.com", "fmicassets.com", "squier.com", "gretschguitars.com", "jacksonguitars.com", "charvel.com", "evhgear.com"];

/** Brand-owned domains for the active client. The class keeps its fender_owned key. */
export function ownedDomains(): string[] {
  return isFenderClient() ? FMIC_OWNED_DOMAINS : activeClient().brandSiteDomains;
}

const OTHER_CLASS_DOMAINS: Array<[SourceClass, string[]]> = [
  [
    "retailer",
    [
      "amazon.com", "amazon.co.uk", "amazon.ca", "sweetwater.com", "guitarcenter.com", "musiciansfriend.com",
      "zzounds.com", "thomann.de", "thomannmusic.com", "andertons.co.uk", "guitarguitar.co.uk", "reverb.com",
      "walmart.com", "bestbuy.com", "samash.com", "gear4music.com", "americanmusical.com", "pmtonline.co.uk",
    ],
  ],
  [
    "editorial",
    [
      "guitarworld.com", "musicradar.com", "premierguitar.com", "guitarplayer.com", "guitar.com",
      "guitarinteractivemagazine.com", "acousticguitar.com", "bassplayer.com", "bassmagazine.com", "nytimes.com",
      "wirecutter.com", "rollingstone.com",
    ],
  ],
  ["community", ["reddit.com", "talkbass.com", "thegearpage.net", "tdpri.com", "quora.com", "ultimate-guitar.com"]],
  ["video", ["youtube.com", "youtu.be", "vimeo.com", "tiktok.com"]],
  ["reference", ["wikipedia.org", "manualslib.com", "manuals.plus", "equipboard.com"]],
  [
    "competitor_brand",
    [
      "yamaha.com", "gibson.com", "epiphone.com", "taylorguitars.com", "prsguitars.com", "ibanez.com",
      "sire-usa.com", "boss.info", "positivegrid.com", "martinguitar.com", "schecterguitars.com",
    ],
  ],
];

function matchesDomain(domain: string, root: string) {
  return domain === root || domain.endsWith(`.${root}`);
}

/** IntoFocus's source class for a cited domain. Not a field stored by the collector. */
export function classifySource(domain: string): SourceClass {
  const d = domain.toLowerCase();
  if (ownedDomains().some((root) => matchesDomain(d, root))) return "fender_owned";
  for (const [kind, roots] of OTHER_CLASS_DOMAINS) {
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

/** Valid, de-duplicated citations on answered calls in scope, joined to their prompt. */
export function citationEvidence(
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
