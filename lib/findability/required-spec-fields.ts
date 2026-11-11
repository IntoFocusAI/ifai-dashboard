import { specFieldLabel } from "@/lib/fender-canvas/catalog-governance-findings";
import { formatInt, formatPct } from "@/lib/fender-canvas/format";

/**
 * Amazon Specs required fields (D-05, decided by Brian Magazu on 11 Nov 2026): each product
 * category's required list is its top 10 spec fields by fill rate across that category's
 * checked listings for the client. Nothing here is kept by hand: the candidate fields are every
 * field the Amazon spec check recorded on the client's listings, filled or missing, so a new
 * client gets its own lists from its own rows. A field no listing in the category fills is left
 * off, so a small category can list fewer than 10.
 */
export const REQUIRED_FIELDS_PER_CATEGORY = 10;

/** The listing name for a row with no stored category. */
export const NO_CATEGORY = "No category recorded";

/** The spec-readiness columns the lists read. Both clients serve these names. */
export type RequiredSpecSourceRow = {
  category?: string | null;
  amazon_checked?: boolean | null;
  amazon_spec_values?: Record<string, unknown> | null;
  amazon_missing_fields?: string | null;
};

export type FieldFill = {
  field: string;
  label: string;
  /** Checked listings in the category with this field filled. */
  filled: number;
  /** filled / listings, 0 to 100. */
  pct: number;
};

export type CategoryRequiredList = {
  category: string;
  /** Checked listings in the category. */
  listings: number;
  fields: FieldFill[];
};

function filledValue(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function filledFields(row: RequiredSpecSourceRow): string[] {
  const values = row.amazon_spec_values;
  if (!values || typeof values !== "object") return [];
  return Object.entries(values)
    .filter(([, value]) => filledValue(value))
    .map(([field]) => field);
}

function missingFields(row: RequiredSpecSourceRow): string[] {
  return (row.amazon_missing_fields ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function categoryOf(row: RequiredSpecSourceRow): string {
  const name = row.category?.trim();
  return name ? name : NO_CATEGORY;
}

/**
 * One list per category, largest category first. A row the Amazon check did not reach is not
 * a listing of the category. Ties on fill rate go to the field filled more often across the
 * client, then to the field name, so the list is stable between reads.
 */
export function requiredSpecListsByCategory(
  rows: readonly RequiredSpecSourceRow[],
  perCategory = REQUIRED_FIELDS_PER_CATEGORY,
): CategoryRequiredList[] {
  const checked = rows.filter((row) => row.amazon_checked !== false);
  const universe = new Set<string>();
  const clientFilled = new Map<string, number>();
  const byCategory = new Map<string, { listings: number; filled: Map<string, number> }>();

  for (const row of checked) {
    const filled = new Set(filledFields(row));
    for (const field of filled) {
      universe.add(field);
      clientFilled.set(field, (clientFilled.get(field) ?? 0) + 1);
    }
    for (const field of missingFields(row)) universe.add(field);
    for (const field of Object.keys(row.amazon_spec_values ?? {})) universe.add(field);
    const name = categoryOf(row);
    const entry = byCategory.get(name) ?? { listings: 0, filled: new Map<string, number>() };
    entry.listings += 1;
    for (const field of filled) entry.filled.set(field, (entry.filled.get(field) ?? 0) + 1);
    byCategory.set(name, entry);
  }

  const fields = [...universe];
  return [...byCategory.entries()]
    .map(([category, entry]) => ({
      category,
      listings: entry.listings,
      fields: fields
        .map((field) => {
          const filled = entry.filled.get(field) ?? 0;
          return { field, label: specFieldLabel(field), filled, pct: (100 * filled) / entry.listings };
        })
        // A field no listing in the category fills is not one the category uses.
        .filter((fill) => fill.filled > 0)
        .sort(
          (a, b) =>
            b.filled - a.filled ||
            (clientFilled.get(b.field) ?? 0) - (clientFilled.get(a.field) ?? 0) ||
            a.field.localeCompare(b.field),
        )
        .slice(0, perCategory),
    }))
    .sort((a, b) => b.listings - a.listings || a.category.localeCompare(b.category));
}

/** "Solid Body (847 listings)"; one listing reads "1 listing". */
export function categoryListingLabel(list: CategoryRequiredList): string {
  return `${list.category} (${formatInt(list.listings)} ${list.listings === 1 ? "listing" : "listings"})`;
}

/** Tooltip body: every field on the category's list with its fill rate. */
export function categoryRequiredTooltip(list: CategoryRequiredList): string {
  const fields = list.fields
    .map((fill) => `${fill.label} ${formatPct(fill.pct)} (${formatInt(fill.filled)} of ${formatInt(list.listings)})`)
    .join("; ");
  const count = list.fields.length;
  const noun = list.listings === 1 ? "listing" : "listings";
  if (count === 0) return `No spec field is filled on the ${formatInt(list.listings)} checked ${list.category} ${noun}.`;
  return `The ${formatInt(count)} spec ${count === 1 ? "field" : "fields"} filled most often across the ${formatInt(list.listings)} checked ${list.category} ${noun}, with fill rate: ${fields}. Candidate fields are every field the Amazon spec check recorded for this brand.`;
}
