/**
 * Machine Readability: fender.com product pages, not Amazon listings.
 * Several listings can resolve to one page, so every count here is per distinct page URL.
 * A page's fields are the latest stored read of that page's Schema.org Product block.
 */

import type { PieDiscData } from "@/lib/ai-search/citation-pies";
import type { PartialFigure } from "@/lib/fender-canvas/canvas-reads";
import { RECHECK_DAYS, rowsStale } from "@/lib/fender-canvas/row-stale";
import { formatInt, formatPct, formatRatio } from "@/lib/fender-canvas/format";
import { getCanvasSupabase } from "@/lib/supabase/canvas-client";
import { brandSite } from "@/lib/brand-copy";

/** The spec field. Neck, pickup, and hardware specs live here. */
export const SPEC_BLOCK_FIELD = "additionalProperty";

/** The seven product basics the spec read checks, in the order the job stores them. */
export const PRODUCT_BASIC_FIELDS = [
  "name",
  "sku",
  "brand",
  "gtin12",
  "description",
  "image",
  "offers_price",
] as const;

const FIELD_LABEL: Record<string, string> = {
  name: "Name",
  sku: "SKU",
  brand: "Brand",
  gtin12: "UPC",
  description: "Description",
  image: "Image",
  offers_price: "Price",
  [SPEC_BLOCK_FIELD]: "Spec block",
};

export function fieldLabel(field: string): string {
  return FIELD_LABEL[field] ?? field;
}

export const SPEC_PAGE_COLUMNS =
  "asin,fender_url,fender_found,fender_missing_fields,checked_at";

export type SpecPageSourceRow = {
  asin: string;
  fender_url: string | null;
  fender_found: boolean | null;
  fender_missing_fields: string | null;
  checked_at: string | null;
};

export type SpecPage = {
  url: string;
  /** Page name from the fender.com product handle. Listing titles can name a different model. */
  model: string;
  asins: string[];
  missingFields: string[];
  hasSpecBlock: boolean;
  basicsPresent: number;
  missingBasics: string[];
  checkedAt: string | null;
};

/** One checked row of the spec read: its listing and its own check time (X-25). */
export type SpecCheckedRow = { asin: string; checkedAt: string | null };

export type SpecPageSummary = {
  /** Every checked listing (fender_found stored as true or false), with its own check time. Optional on fixtures. */
  checkedRows?: SpecCheckedRow[];
  pages: SpecPage[];
  withSpecBlock: number;
  withAllBasics: number;
  listings: number;
};

function pageKey(url: string): string {
  return url.split(/[?#]/)[0].replace(/\/+$/, "").toLowerCase();
}

const UPPER_TOKENS = new Set(["ii", "iii", "iv", "hss", "hh", "hs", "ss", "sss", "sh", "fsr", "usa", "mij", "lh", "p90", "jv"]);

/** "75th-anniversary-player-ii-telecaster" -> "75th Anniversary Player II Telecaster". */
export function pageNameFromUrl(url: string): string {
  const handle = url.split(/[?#]/)[0].replace(/\/+$/, "").split("/").pop() ?? "";
  return handle
    .split("-")
    .filter(Boolean)
    .map((token) =>
      UPPER_TOKENS.has(token) ? token.toUpperCase() : token.charAt(0).toUpperCase() + token.slice(1),
    )
    .join(" ");
}

function splitFields(value: string | null): string[] {
  return (value ?? "")
    .split(";")
    .map((field) => field.trim())
    .filter(Boolean);
}

function later(a: string | null, b: string | null): boolean {
  if (!a) return false;
  if (!b) return true;
  return Date.parse(a) > Date.parse(b);
}

/** Group found rows into one entry per fender.com page. Rows without a page URL are not pages. */
export function buildSpecPages(rows: readonly SpecPageSourceRow[]): SpecPageSummary {
  const checkedRows: SpecCheckedRow[] = rows
    .filter((row) => row.fender_found === true || row.fender_found === false)
    .map((row) => ({ asin: row.asin, checkedAt: row.checked_at }));
  const latest = new Map<string, SpecPageSourceRow>();
  const asins = new Map<string, Set<string>>();

  for (const row of rows) {
    if (row.fender_found !== true || !row.fender_url) continue;
    const key = pageKey(row.fender_url);
    const seen = latest.get(key);
    if (!seen || later(row.checked_at, seen.checked_at)) latest.set(key, row);
    const set = asins.get(key) ?? new Set<string>();
    set.add(row.asin);
    asins.set(key, set);
  }

  const pages: SpecPage[] = [...latest.entries()].map(([key, row]) => {
    const missingFields = splitFields(row.fender_missing_fields);
    const missingBasics = PRODUCT_BASIC_FIELDS.filter((field) => missingFields.includes(field));
    return {
      url: row.fender_url!.split(/[?#]/)[0],
      model: pageNameFromUrl(row.fender_url!),
      asins: [...(asins.get(key) ?? [])].sort(),
      missingFields,
      hasSpecBlock: !missingFields.includes(SPEC_BLOCK_FIELD),
      basicsPresent: PRODUCT_BASIC_FIELDS.length - missingBasics.length,
      missingBasics,
      checkedAt: row.checked_at,
    };
  });

  pages.sort((a, b) => b.asins.length - a.asins.length || a.url.localeCompare(b.url));

  return {
    checkedRows,
    pages,
    withSpecBlock: pages.filter((page) => page.hasSpecBlock).length,
    withAllBasics: pages.filter((page) => page.missingBasics.length === 0).length,
    listings: pages.reduce((sum, page) => sum + page.asins.length, 0),
  };
}

type PageRead = PromiseLike<{ data: unknown; error: { message: string } | null }>;

export type SpecPageClient = {
  from: (view: string) => {
    select: (columns: string) => {
      order: (column: string, options: { ascending: boolean }) => {
        range: (from: number, to: number) => PageRead;
      };
    };
  };
};

const READ_PAGE = 1000;
const MAX_READS = 10;

/** Every checked row on the spec view, read in pages (found pages, and the check time of every checked listing). Throws on a failed read. */
export async function loadSpecPages(client?: SpecPageClient): Promise<SpecPageSummary> {
  const supabase = client ?? (getCanvasSupabase() as unknown as SpecPageClient);
  const rows: SpecPageSourceRow[] = [];
  for (let read = 0; read < MAX_READS; read += 1) {
    const from = read * READ_PAGE;
    const { data, error } = await supabase
      .from("canvas_spec_readiness")
      .select(SPEC_PAGE_COLUMNS)
      .order("asin", { ascending: true })
      .range(from, from + READ_PAGE - 1);
    if (error) throw new Error(`canvas_spec_readiness: ${error.message}`);
    const batch = (data ?? []) as SpecPageSourceRow[];
    rows.push(...batch);
    if (batch.length < READ_PAGE) break;
  }
  return buildSpecPages(rows);
}

export type MachineHeroId = "missing_specs" | "product_basics";

export type MachineHeroModel = {
  id: MachineHeroId;
  label: string;
  definition: string;
  percent: string;
  ratio: string | null;
  color: string;
  pie: PieDiscData | null;
  tip: string | null;
  explainer: string;
  numerator: number | null;
  denominator: number | null;
  /** Stale figure (X-25) when the page read is past its weekly schedule. */
  partial?: PartialFigure | null;
};

/** Same bands as Specs complete on Catalog Governance (higher share is better). */
function shareColor(pct: number): string {
  if (pct >= 98) return "var(--success-green)";
  if (pct >= 95) return "var(--warning-amber)";
  return "var(--danger-red)";
}

/** Missing-share bands: a higher missing share is worse. */
function missingShareColor(pct: number): string {
  if (pct <= 2) return "var(--success-green)";
  if (pct <= 5) return "var(--warning-amber)";
  return "var(--danger-red)";
}

/** Plain operator name for a stored missing field. Never invents a field. */
export function plainSpecFieldName(field: string): string {
  if (field === SPEC_BLOCK_FIELD) return "spec block";
  const known = FIELD_LABEL[field];
  if (known) return known.toLowerCase();
  return field
    .split("_")
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/**
 * Plain names of fields missing on pages that lack machine-readable specs.
 * Only fields present in the stored read are named.
 */
export function namedMissingMachineSpecs(summary: SpecPageSummary): string[] {
  const names = new Set<string>();
  for (const page of summary.pages) {
    if (page.hasSpecBlock) continue;
    for (const field of page.missingFields) {
      names.add(plainSpecFieldName(field));
    }
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

function sharePie(
  id: string,
  title: string,
  hasLabel: string,
  lacksLabel: string,
  has: number,
  total: number,
): PieDiscData | null {
  if (total <= 0 || has < 0 || has > total) return null;
  return {
    id,
    title,
    total,
    totalLabel: `${brandSite()} pages checked`,
    slices: [
      { key: "matched", label: hasLabel, count: has },
      { key: "contradicted", label: lacksLabel, count: total - has },
    ].filter((slice) => slice.count > 0),
  };
}

function hero(
  id: MachineHeroId,
  label: string,
  definition: string,
  has: number | null,
  total: number | null,
  pieLabels: [string, string],
  explainer: string,
): MachineHeroModel {
  const ready = has != null && total != null && total > 0;
  const pct = ready ? (100 * has!) / total! : null;
  return {
    id,
    label,
    definition,
    percent: pct != null ? formatPct(pct) : "Not available*",
    ratio: ready ? formatRatio(has, total) : null,
    color: pct != null ? shareColor(pct) : "var(--warning-amber)",
    pie: ready ? sharePie(`machine-${id}`, label, pieLabels[0], pieLabels[1], has!, total!) : null,
    tip: ready ? `${formatInt(has)} of ${formatInt(total)} ${brandSite()} pages checked.` : null,
    explainer: ready ? explainer : `The ${brandSite()} page read could not be loaded.`,
    numerator: ready ? has : null,
    denominator: ready ? total : null,
  };
}

export const SPEC_BLOCK_DEFINITION =
  "Schema.org additionalProperty on the page's product data. It carries specs such as nut width, fingerboard radius, and pickups as facts an AI engine can read.";

export const MISSING_MACHINE_SPECS_DEFINITION =
  `Share of found ${brandSite()} pages whose Schema.org product data is missing the spec block (additionalProperty) AI engines read as product facts.`;

export const PRODUCT_BASICS_DEFINITION =
  "Name, SKU, brand, UPC, description, image, and price in the page's Schema.org product data.";

function missingSpecsHero(summary: SpecPageSummary | null): MachineHeroModel {
  const total = summary ? summary.pages.length : null;
  const missing = summary ? summary.pages.length - summary.withSpecBlock : null;
  const ready = missing != null && total != null && total > 0;
  const pct = ready ? (100 * missing!) / total! : null;
  const named = summary ? namedMissingMachineSpecs(summary) : [];
  const namedLine =
    named.length > 0
      ? `Missing on these pages: ${named.join(", ")}.`
      : ready
        ? "Every checked page has machine-readable specs."
        : `The ${brandSite()} page read could not be loaded.`;
  return {
    id: "missing_specs",
    label: "Found pages missing machine-readable specs",
    definition: MISSING_MACHINE_SPECS_DEFINITION,
    percent: pct != null ? formatPct(pct) : "Not available*",
    ratio: ready ? formatRatio(missing, total) : null,
    color: pct != null ? missingShareColor(pct) : "var(--warning-amber)",
    pie: ready
      ? sharePie(
          "machine-missing_specs",
          "Found pages missing machine-readable specs",
          "Missing machine-readable specs",
          "Specs present",
          missing!,
          total!,
        )
      : null,
    tip: ready ? `${formatInt(missing)} of ${formatInt(total)} found ${brandSite()} pages.` : null,
    explainer: namedLine,
    numerator: ready ? missing : null,
    denominator: ready ? total : null,
  };
}

/** The stale reading for the page figures: each found page's own latest check against twice the weekly schedule. */
export function specPagesStale(summary: SpecPageSummary | null, now: number = Date.now()): PartialFigure | null {
  if (!summary) return null;
  return rowsStale(
    summary.pages,
    (page) => page.checkedAt,
    {
      intervalDays: RECHECK_DAYS.weekly,
      check: `${brandSite()} product check`,
      source: "canvas_spec_readiness",
      figure: "page shares",
      unit: "pages",
    },
    now,
  );
}

/**
 * The stale reading for the page-found figures (the AI Readiness map bubble and the Brand-Site Specs
 * lead): each checked listing's own check against twice the weekly schedule. Null when the read
 * carries no per-row times.
 */
export function pageFoundRowsStale(summary: SpecPageSummary | null | undefined, now: number = Date.now()): PartialFigure | null {
  if (!summary?.checkedRows) return null;
  return rowsStale(
    summary.checkedRows,
    (row) => row.checkedAt,
    {
      intervalDays: RECHECK_DAYS.weekly,
      check: `${brandSite()} product check`,
      source: "canvas_spec_readiness",
      figure: "page-found figures",
    },
    now,
  );
}

/** Brand-Site Specs heroes. Missing machine-readable specs leads; product basics follow. */
export function machineReadabilityHeroes(summary: SpecPageSummary | null): MachineHeroModel[] {
  const total = summary ? summary.pages.length : null;
  const partial = specPagesStale(summary);
  return machineHeroes(summary, total).map((hero) =>
    hero.denominator != null && partial ? { ...hero, partial } : hero,
  );
}

function machineHeroes(summary: SpecPageSummary | null, total: number | null): MachineHeroModel[] {
  return [
    missingSpecsHero(summary),
    hero(
      "product_basics",
      "Product basics present",
      PRODUCT_BASICS_DEFINITION,
      summary ? summary.withAllBasics : null,
      total,
      ["All seven basics", "Missing a basic"],
      "All seven basics are in the product data.",
    ),
  ];
}

/**
 * One sentence for the explainer when every checked page has the same gap.
 * Null when pages differ, or when there is nothing to say.
 */
export function sharedGapSentence(summary: SpecPageSummary | null): string | null {
  if (!summary || summary.pages.length === 0) return null;
  const first = summary.pages[0].missingFields.join(";");
  if (!summary.pages.every((page) => page.missingFields.join(";") === first)) return null;
  if (summary.withSpecBlock === 0 && summary.withAllBasics === summary.pages.length) {
    return `All ${formatInt(summary.pages.length)} checked pages have every basic and none has a spec block. The same gap on every page points to ${brandSite()}'s shared product template, so one template change adds the spec block to every page.`;
  }
  return null;
}

export type SpecPageCounts = {
  pages: number;
  withSpecBlock: number;
  missingSpecBlock: number;
  /** Share of checked pages with a spec block, 0-100. */
  specBlockPct: number;
};

/** Page counts for satellites, widgets, and queue items. Null when the page read failed or is empty. */
export function specPageCounts(summary: SpecPageSummary | null | undefined): SpecPageCounts | null {
  if (!summary || summary.pages.length === 0) return null;
  const pages = summary.pages.length;
  return {
    pages,
    withSpecBlock: summary.withSpecBlock,
    missingSpecBlock: pages - summary.withSpecBlock,
    specBlockPct: (100 * summary.withSpecBlock) / pages,
  };
}
