import { formatInt, formatPct } from "@/lib/fender-canvas/format";
import { formatLastCheckDay, type PartialFigure } from "@/lib/fender-canvas/canvas-reads";
import {
  amazonFieldList,
  competitorFillPct,
  type AmazonFieldList,
  type AmazonRequiredField,
} from "@/lib/findability/amazon-field-lists";
import type { RequiredSpecSourceRow } from "@/lib/findability/required-spec-fields";

/**
 * Amazon Specs required fields by Amazon product type (D-05). The required list is the staff list
 * for the listing's product type (lib/findability/amazon-field-lists.ts). The Amazon spec check
 * records a fixed set of fields per client, so a required field it does not record is named as
 * not checked, never as missing. Listings whose product type has no list keep the interim rule
 * (top 10 by fill rate in their category).
 */

export type ProductTypeSourceRow = RequiredSpecSourceRow & { asin: string };

export type CheckedRequiredField = AmazonRequiredField & {
  /** Checked listings of the type the check found without this field. */
  missing: number;
};

export type ProductTypeCoverage = {
  list: AmazonFieldList;
  /** Checked listings of this product type. */
  listings: number;
  /** Required fields the spec check records for this client. */
  checked: CheckedRequiredField[];
  /** Required fields the spec check does not record. */
  unchecked: AmazonRequiredField[];
  /** Listings missing at least one checked required field. */
  listingsMissing: number;
};

export type ProductTypeSplit<Row extends ProductTypeSourceRow> = {
  coverage: ProductTypeCoverage[];
  /** Checked listings whose product type has no list, or no product type at all. */
  unlisted: Row[];
};

function missingFields(row: RequiredSpecSourceRow): string[] {
  return (row.amazon_missing_fields ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/** Every field the spec check recorded on the client's checked listings, filled or missing. */
export function recordedSpecFields(rows: readonly RequiredSpecSourceRow[]): Set<string> {
  const fields = new Set<string>();
  for (const row of rows) {
    if (row.amazon_checked === false) continue;
    for (const field of Object.keys(row.amazon_spec_values ?? {})) fields.add(field);
    for (const field of missingFields(row)) fields.add(field);
  }
  return fields;
}

/**
 * Split the checked listings by Amazon product type. Types with a list come first, largest
 * first; the rest are returned for the interim rule.
 */
export function requiredFieldsByProductType<Row extends ProductTypeSourceRow>(
  rows: readonly Row[],
  productTypes: ReadonlyMap<string, string>,
): ProductTypeSplit<Row> {
  const checkedRows = rows.filter((row) => row.amazon_checked !== false);
  const recorded = recordedSpecFields(checkedRows);
  const byType = new Map<string, { list: AmazonFieldList; rows: Row[] }>();
  const unlisted: Row[] = [];
  for (const row of checkedRows) {
    const list = amazonFieldList(productTypes.get(row.asin.trim()));
    if (!list) {
      unlisted.push(row);
      continue;
    }
    const entry = byType.get(list.productType) ?? { list, rows: [] };
    entry.rows.push(row);
    byType.set(list.productType, entry);
  }

  const coverage = [...byType.values()].map(({ list, rows: typeRows }) => {
    const checkedFields = list.fields.filter((field) => recorded.has(field.field));
    const checkedIds = new Set(checkedFields.map((field) => field.field));
    const missingCount = new Map<string, number>();
    let listingsMissing = 0;
    for (const row of typeRows) {
      const missing = missingFields(row).filter((field) => checkedIds.has(field));
      if (missing.length > 0) listingsMissing += 1;
      for (const field of new Set(missing)) missingCount.set(field, (missingCount.get(field) ?? 0) + 1);
    }
    return {
      list,
      listings: typeRows.length,
      checked: checkedFields.map((field) => ({ ...field, missing: missingCount.get(field.field) ?? 0 })),
      unchecked: list.fields.filter((field) => !checkedIds.has(field.field)),
      listingsMissing,
    };
  });
  coverage.sort((a, b) => b.listings - a.listings || a.list.productType.localeCompare(b.list.productType));
  return { coverage, unlisted };
}

function listingNoun(count: number): string {
  return count === 1 ? "listing" : "listings";
}

/** "guitars (1,031 listings)". */
export function productTypeListingLabel(coverage: ProductTypeCoverage): string {
  return `${coverage.list.label} (${formatInt(coverage.listings)} ${listingNoun(coverage.listings)})`;
}

/** "Checks 9 of 17 required fields". */
export function productTypeCoverageLabel(coverage: ProductTypeCoverage): string {
  return `checks ${formatInt(coverage.checked.length)} of ${formatInt(coverage.list.fields.length)} required fields`;
}

function sourceLine(list: AmazonFieldList): string {
  return `Required list: every field filled on at least 30% of ${formatInt(list.sampled)} best-selling ${list.label} listings from other brands on Amazon, read ${formatLastCheckDay(`${list.sourceDate}T12:00:00Z`) ?? list.sourceDate}.`;
}

/** Tooltip on the product type: the checked fields with listings missing each, then the source. */
export function productTypeRequiredTooltip(coverage: ProductTypeCoverage): string {
  const { list, listings } = coverage;
  const checked = coverage.checked
    .map(
      (field) =>
        `${field.label} missing on ${formatInt(field.missing)} of ${formatInt(listings)} (competitors ${formatPct(competitorFillPct(list, field))})`,
    )
    .join("; ");
  const lead =
    coverage.checked.length > 0
      ? `${formatInt(coverage.listingsMissing)} of ${formatInt(listings)} checked ${list.label} ${listingNoun(listings)} miss at least one checked required field. Checked: ${checked}.`
      : `The Amazon spec check records none of the ${formatInt(list.fields.length)} required fields for ${list.label}.`;
  return `${lead}\n${sourceLine(list)}`;
}

/** The X-25 partial figure: the required fields the spec check does not record. */
export function productTypeCoveragePartial(coverage: ProductTypeCoverage): PartialFigure | null {
  if (coverage.unchecked.length === 0) return null;
  const { list } = coverage;
  const names = coverage.unchecked
    .map((field) => `${field.label} (competitors ${formatPct(competitorFillPct(list, field))})`)
    .join(", ");
  return {
    reason: "coverage",
    missing: `The Amazon spec check does not record ${formatInt(coverage.unchecked.length)} of the ${formatInt(list.fields.length)} required fields for ${list.label}, so they are not judged: ${names}`,
    coverage: `${formatInt(coverage.checked.length)} of ${formatInt(list.fields.length)} required fields`,
    source: "canvas_spec_readiness",
  };
}
