import { formatInt, formatPct, formatRatio, pendingLabel } from "@/lib/fender-canvas/format";

export const NO_MISSING_AMAZON_FIELDS = "No missing fields";
export const MISSING_AMAZON_FIELDS_DETAIL_UNAVAILABLE = "Missing-field detail is not stored.";
/** Share refused when the checked-listing total is missing or not the same population. */
export const MISSING_FIELD_SHARE_UNAVAILABLE = "Not available*";
/** Plain name for canvas_spec_missing_fields.sku_count on Amazon source rows. */
export const MISSING_FIELD_COUNT_POPULATION = "checked listings";

/** Semicolon-separated Amazon field names. Blank pieces are not fields. */
export function amazonMissingFieldNames(value: string | null | undefined): string[] {
  return (value ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export type MissingAmazonFieldsPresentation =
  | { kind: "fields"; fields: string[] }
  | { kind: "none"; label: typeof NO_MISSING_AMAZON_FIELDS }
  | { kind: "pending"; label: string }
  | { kind: "detail-unavailable"; label: typeof MISSING_AMAZON_FIELDS_DETAIL_UNAVAILABLE };

/**
 * Empty stored fields at 100% completeness mean nothing is missing.
 * Pending data is only for a completeness figure or field list that is not stored.
 * A known gap without the field names says the detail is unavailable.
 */
export function presentMissingAmazonFields(
  missingFields: string | null | undefined,
  completenessPct: number | null | undefined,
): MissingAmazonFieldsPresentation {
  const fields = amazonMissingFieldNames(missingFields);
  if (fields.length > 0) return { kind: "fields", fields };
  const completeness =
    typeof completenessPct === "number" && Number.isFinite(completenessPct) ? completenessPct : null;
  if (completeness == null) return { kind: "pending", label: pendingLabel() };
  if (completeness >= 100) return { kind: "none", label: NO_MISSING_AMAZON_FIELDS };
  return { kind: "detail-unavailable", label: MISSING_AMAZON_FIELDS_DETAIL_UNAVAILABLE };
}

export type MissingFieldSharePresentation =
  | {
      kind: "share";
      /** "N of M (P%)" against the checked-listing total. */
      label: string;
      ratio: string;
      percent: string;
      /** Bar width as that share of checked listings (0-100). */
      barPct: number;
    }
  | {
      kind: "count-only";
      /** Named count with no invented percent, e.g. "340 checked listings". */
      label: string;
      shareLabel: typeof MISSING_FIELD_SHARE_UNAVAILABLE;
      barPct: null;
    }
  | {
      kind: "pending";
      label: string;
      shareLabel: typeof MISSING_FIELD_SHARE_UNAVAILABLE;
      barPct: null;
    };

/**
 * Amazon Top missing fields rows: sku_count is how many checked listings in the
 * same canvas_spec_readiness / canvas_metrics.spec_checked population are missing
 * that Amazon field (source map: frequencies inside the unfinished spec read).
 * Pair with spec_checked only when both are stored and the count fits that total.
 * A missing or zero checked total never becomes 0% or a full bar.
 */
export function presentMissingFieldShare(
  skuCount: number | null | undefined,
  specChecked: number | null | undefined,
): MissingFieldSharePresentation {
  const count =
    typeof skuCount === "number" && Number.isFinite(skuCount) && skuCount >= 0 ? skuCount : null;
  const checked =
    typeof specChecked === "number" && Number.isFinite(specChecked) && specChecked > 0
      ? specChecked
      : null;

  if (count == null) {
    return {
      kind: "pending",
      label: pendingLabel(),
      shareLabel: MISSING_FIELD_SHARE_UNAVAILABLE,
      barPct: null,
    };
  }

  const samePopulation = checked != null && count <= checked;
  if (samePopulation) {
    const pct = (100 * count) / checked!;
    const ratio = formatRatio(count, checked);
    const percent = formatPct(pct);
    return {
      kind: "share",
      label: `${ratio} (${percent})`,
      ratio,
      percent,
      barPct: Math.max(0, Math.min(100, pct)),
    };
  }

  return {
    kind: "count-only",
    label: `${formatInt(count)} ${MISSING_FIELD_COUNT_POPULATION}`,
    shareLabel: MISSING_FIELD_SHARE_UNAVAILABLE,
    barPct: null,
  };
}
