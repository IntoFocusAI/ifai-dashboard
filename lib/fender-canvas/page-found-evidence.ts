/**
 * Evidence behind the fender.com page found hero: one row per checked SKU.
 * canvas_metrics counts spec_checked and spec_fender_found over the same latest row per
 * listing that canvas_spec_readiness serves, so these rows add up to the hero's N of M.
 * A null fender_found is checked but not found, the way that count treats it.
 */

import { PRODUCT_BASIC_FIELDS, SPEC_BLOCK_FIELD } from "@/lib/fender-canvas/machine-readability";
import type { PageFoundHeroModel } from "@/lib/fender-canvas/page-found-hero";
import { schemaPageHref } from "@/lib/fender-canvas/spec-table-sort";
import { specModelTitle } from "@/lib/fender-canvas/types";
import { getCanvasSupabase } from "@/lib/supabase/canvas-client";

export const REASON_NOT_RECORDED = "Reason not recorded";

export const PAGE_FOUND_COLUMNS =
  "asin,title,fender_url,fender_found,fender_missing_fields,checked_at";

export type PageFoundSourceRow = {
  asin: string;
  title: string | null;
  fender_url: string | null;
  fender_found: boolean | null;
  fender_missing_fields: string | null;
  checked_at: string | null;
};

export type PageFoundRow = {
  asin: string;
  model: string;
  found: boolean;
  /** The stored fender.com page on a found row. Null when that address is not a web link. */
  pageHref: string | null;
  /** The stored reason on a not-found row, or REASON_NOT_RECORDED. Null on a found row. */
  reason: string | null;
  checkedAt: string | null;
};

export type PageFoundEvidence = {
  rows: PageFoundRow[];
  found: number;
  notFound: number;
  checked: number;
};

/** The eight fields the spec read scores on a fender.com page. Naming one is not a reason. */
const FENDER_SPEC_FIELDS = new Set<string>([...PRODUCT_BASIC_FIELDS, SPEC_BLOCK_FIELD]);

function sentenceCase(token: string): string {
  const words = token.replace(/_+/g, " ").replace(/\s+/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "";
}

/**
 * The reason a not-found row stores, in plain words. The older collector wrote it into
 * fender_missing_fields (for example "not_found_on_fender.com"). Field names are skipped.
 */
export function storedNotFoundReason(missingFields: string | null | undefined): string | null {
  const reasons = (missingFields ?? "")
    .split(";")
    .map((token) => token.trim())
    .filter((token) => token && !FENDER_SPEC_FIELDS.has(token))
    .map(sentenceCase)
    .filter(Boolean);
  return reasons.length > 0 ? reasons.join("; ") : null;
}

export function pageFoundRow(row: PageFoundSourceRow): PageFoundRow {
  const found = row.fender_found === true;
  return {
    asin: row.asin,
    model: specModelTitle(row.title),
    found,
    pageHref: found ? schemaPageHref(row.fender_url) : null,
    reason: found ? null : (storedNotFoundReason(row.fender_missing_fields) ?? REASON_NOT_RECORDED),
    checkedAt: row.checked_at,
  };
}

/** Every checked SKU. Not-found rows lead; ASIN breaks ties. */
export function buildPageFoundEvidence(rows: readonly PageFoundSourceRow[]): PageFoundEvidence {
  const out = rows
    .map(pageFoundRow)
    .sort((a, b) => Number(a.found) - Number(b.found) || a.asin.localeCompare(b.asin));
  const found = out.filter((row) => row.found).length;
  return { rows: out, found, notFound: out.length - found, checked: out.length };
}

/** True when the SKU rows add up to the hero's found of checked. */
export function evidenceMatchesHero(
  evidence: Pick<PageFoundEvidence, "found" | "checked">,
  hero: Pick<PageFoundHeroModel, "numerator" | "denominator">,
): boolean {
  return hero.numerator === evidence.found && hero.denominator === evidence.checked;
}

type PageRead = PromiseLike<{ data: unknown; error: { message: string } | null }>;

export type PageFoundClient = {
  from: (view: string) => {
    select: (columns: string) => {
      order: (column: string, options: { ascending: boolean }) => {
        range: (from: number, to: number) => PageRead;
      };
    };
  };
};

const READ_PAGE = 1000;
const MAX_READS = 20;

/** Every checked SKU on the spec view, read in pages. Throws on a failed read. */
export async function loadPageFoundEvidence(client?: PageFoundClient): Promise<PageFoundEvidence> {
  const supabase = client ?? (getCanvasSupabase() as unknown as PageFoundClient);
  const rows: PageFoundSourceRow[] = [];
  for (let read = 0; read < MAX_READS; read += 1) {
    const from = read * READ_PAGE;
    const { data, error } = await supabase
      .from("canvas_spec_readiness")
      .select(PAGE_FOUND_COLUMNS)
      .order("asin", { ascending: true })
      .range(from, from + READ_PAGE - 1);
    if (error) throw new Error(`canvas_spec_readiness: ${error.message}`);
    const batch = (data ?? []) as PageFoundSourceRow[];
    rows.push(...batch);
    if (batch.length < READ_PAGE) break;
  }
  return buildPageFoundEvidence(rows);
}
