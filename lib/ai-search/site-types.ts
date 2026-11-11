/**
 * Site types as data (decision 21a). The view public.canvas_site_types holds one winning type per
 * cited domain and client: a staff override, else the stored classification (AI or seed). The
 * dashboard reads it once per page load. When the view is absent or the read fails, nothing here
 * answers and classifySource falls back to the lists in code, so the dashboard works before the
 * migration is applied.
 *
 * Needs review is for staff. The FDD does not say where, or in what words, a client sees it, so no
 * screen shows it yet; `siteTypeNeedsReview` is the one hook for it.
 */

import type { SourceClass } from "@/lib/ai-search/citations";
import { activeSetAsideClientKey } from "@/lib/set-aside/keys";
import { getPublicCanvasSupabase } from "@/lib/supabase/canvas-client";

export const SITE_TYPE_VIEW = "canvas_site_types";

/** Stored values, in the order decision 21a lists them. */
export const STORED_SITE_TYPES = [
  "brand_owned",
  "retailer",
  "publication",
  "community",
  "video",
  "competitor_brand",
  "reference",
  "other",
] as const;
export type StoredSiteType = (typeof STORED_SITE_TYPES)[number];

/** Confidence below this reads Needs review for staff. The view applies the stored setting. */
export const DEFAULT_REVIEW_BELOW = 0.7;

const TO_SOURCE_CLASS: Record<StoredSiteType, SourceClass> = {
  brand_owned: "fender_owned",
  retailer: "retailer",
  publication: "editorial",
  community: "community",
  video: "video",
  competitor_brand: "competitor_brand",
  reference: "reference",
  other: "other",
};

export type SiteTypeRow = {
  client_key: string;
  domain: string;
  site_type: StoredSiteType;
  source: "staff" | "ai" | "seed";
  confidence: number | null;
  needs_review: boolean;
};

export type SiteTypeIndex = ReadonlyMap<string, SiteTypeRow>;

export type SiteTypeRead =
  | { phase: "stored"; rows: SiteTypeRow[] }
  | { phase: "fallback"; reason: string };

const PAGE = 1000;

type PageResult = PromiseLike<{ data: unknown; error: { message: string } | null }>;

/** The slice of the Supabase client this read uses, so tests can pass a fake. */
export type SiteTypeReadClient = {
  from: (view: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        order: (column: string) => { range: (from: number, to: number) => PageResult };
      };
    };
  };
};

function isStoredType(value: unknown): value is StoredSiteType {
  return typeof value === "string" && (STORED_SITE_TYPES as readonly string[]).includes(value);
}

/** Rows the reader understands. A row with an unknown type or no domain is dropped, never guessed. */
export function parseSiteTypeRows(data: unknown): SiteTypeRow[] {
  if (!Array.isArray(data)) return [];
  const rows: SiteTypeRow[] = [];
  for (const raw of data as Array<Record<string, unknown>>) {
    const domain = typeof raw?.domain === "string" ? raw.domain.trim().toLowerCase().replace(/^www\./, "") : "";
    if (!domain || !isStoredType(raw.site_type)) continue;
    const source = raw.source === "staff" || raw.source === "ai" || raw.source === "seed" ? raw.source : "ai";
    const confidence = typeof raw.confidence === "number" ? raw.confidence : null;
    rows.push({
      client_key: String(raw.client_key ?? ""),
      domain,
      site_type: raw.site_type,
      source,
      confidence,
      needs_review: raw.needs_review === true,
    });
  }
  return rows;
}

/** Reads every row of the view for one client. Never throws: a missing view or a failed page is a fallback. */
export async function loadSiteTypes(client: SiteTypeReadClient, clientKey: string): Promise<SiteTypeRead> {
  try {
    const rows: SiteTypeRow[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await client
        .from(SITE_TYPE_VIEW)
        .select("client_key,domain,site_type,source,confidence,needs_review")
        .eq("client_key", clientKey)
        .order("domain")
        .range(from, from + PAGE - 1);
      if (error) return { phase: "fallback", reason: error.message };
      if (!Array.isArray(data)) return { phase: "fallback", reason: "The site type view returned no rows array." };
      rows.push(...parseSiteTypeRows(data));
      if (data.length < PAGE) break;
    }
    return { phase: "stored", rows };
  } catch (error) {
    return { phase: "fallback", reason: error instanceof Error ? error.message : String(error) };
  }
}

export function siteTypeIndex(rows: readonly SiteTypeRow[]): SiteTypeIndex {
  return new Map(rows.map((row) => [row.domain, row]));
}

/** The stored row for a domain: its own row, else the nearest parent (uk.fender.com reads fender.com). */
export function lookupSiteType(index: SiteTypeIndex, domain: string): SiteTypeRow | null {
  const labels = domain.trim().toLowerCase().replace(/^www\./, "").split(".");
  for (let i = 0; i <= labels.length - 2; i += 1) {
    const hit = index.get(labels.slice(i).join("."));
    if (hit) return hit;
  }
  return null;
}

let current: SiteTypeIndex | null = null;
const loads = new Map<string, Promise<void>>();

/** Tests only: forget which clients have loaded. */
export function resetSiteTypeLoadsForTests() {
  loads.clear();
}

/** Installs (or clears, with null) the stored types classifySource reads first. */
export function setSiteTypes(index: SiteTypeIndex | null) {
  current = index;
}

/** The stored source class for a domain, or null when nothing is stored (use the lists in code). */
export function storedSourceClass(domain: string): SourceClass | null {
  if (!current) return null;
  const hit = lookupSiteType(current, domain);
  return hit ? TO_SOURCE_CLASS[hit.site_type] : null;
}

/** Staff only: the domain's AI type is under the confidence threshold and no staff override covers it. */
export function siteTypeNeedsReview(domain: string): boolean {
  return current ? lookupSiteType(current, domain)?.needs_review === true : false;
}

/** Waits for the stored types, then runs the read. For history reads that start on their own. */
export function afterSiteTypes<T>(client: object, read: () => Promise<T>): Promise<T> {
  return ensureSiteTypes(client).then(read);
}

/**
 * Loads the stored types once per client key, before any run is read, so every later
 * classifySource call sees them. The view lives in `public`, keyed by client_key, so the read
 * always uses the public client; the client the caller holds may be bound to a brand schema
 * (Ledlenser's) where the view does not exist. `readClient` is for tests. Never rejects.
 */
export function ensureSiteTypes(
  _client: object,
  clientKey: string = activeSetAsideClientKey(),
  readClient?: SiteTypeReadClient,
): Promise<void> {
  const existing = loads.get(clientKey);
  if (existing) return existing;
  const pending = Promise.resolve()
    .then(() => loadSiteTypes(readClient ?? (getPublicCanvasSupabase() as unknown as SiteTypeReadClient), clientKey))
    .catch((error): SiteTypeRead => ({ phase: "fallback", reason: String(error) }))
    .then((read) => {
      setSiteTypes(read.phase === "stored" && read.rows.length ? siteTypeIndex(read.rows) : null);
    });
  loads.set(clientKey, pending);
  return pending;
}
