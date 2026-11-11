import type { AmazonSpecGap } from "@/lib/fender-canvas/portfolio-retail";

/** Plain labels for Amazon spec fields (24 characters or fewer). */
const SPEC_FIELD_LABELS: Record<string, string> = {
  scale_length: "Scale length",
  hand_orientation: "Handedness",
  item_weight: "Weight",
  item_dimensions: "Dimensions",
  number_of_strings: "Strings",
  fretboard_material_type: "Fretboard",
  guitar_bridge_system: "Bridge",
  guitar_pickup_configuration: "Pickups",
  neck_material_type: "Neck",
  manufacturer_part_number: "Part number",
  body_material_type: "Body",
  color: "Color",
  upc: "UPC",
  // Lighting (Ledlenser)
  light_output_maximum: "Max lumens",
  beam_distance: "Beam distance",
  runtime: "Runtime",
  water_resistance_level: "Water resistance",
  battery_type: "Battery type",
  power_source: "Power source",
  light_source_type: "Light source",
  material_type: "Material",
};

export type SpecFieldFindingLine = {
  field: string;
  label: string;
  count: number;
};

export type SpecFieldFindings = {
  fillFirst: SpecFieldFindingLine[];
  howClose: {
    oneField: number;
    twoFields: number;
    mostOfTheSpec: number;
  };
};

/** How-close filter: exclusive choice, or none. */
export type SpecHowCloseFilter = "one" | "two" | "most" | null;

const LABEL_MAX = 24;
const LABEL_ELLIPSIS_AT = 21;

/** Display label for a stored Amazon field name. */
export function specFieldLabel(field: string): string {
  const known = SPEC_FIELD_LABELS[field];
  if (known) return known;
  const titled = field
    .split("_")
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
  if (titled.length <= LABEL_MAX) return titled;
  return `${titled.slice(0, LABEL_ELLIPSIS_AT).trimEnd()}...`;
}

/** Distinct missing Amazon field names on one listing (order preserved). */
export function distinctMissingFields(gap: AmazonSpecGap): string[] {
  return [...new Set(gap.missingFields)];
}

/**
 * Short Fields cell for a gap listing.
 * One field → plain label. Two → both labels when ≤24 chars, else "2 fields".
 * Three to ten → "N fields". Eleven or more → "Most of the spec".
 */
export function specGapFieldsCell(missingFields: readonly string[]): string {
  const unique = [...new Set(missingFields)];
  const n = unique.length;
  if (n === 0) return "";
  if (n === 1) return specFieldLabel(unique[0]!);
  if (n === 2) {
    const joined = `${specFieldLabel(unique[0]!)}, ${specFieldLabel(unique[1]!)}`;
    return joined.length <= LABEL_MAX ? joined : "2 fields";
  }
  if (n <= 10) return `${n} fields`;
  return "Most of the spec";
}

/**
 * Whether a gap listing matches the Specs complete filters.
 * Selected fields are AND. How close is one exclusive choice (or none).
 */
export function listingMatchesSpecFilters(
  gap: AmazonSpecGap,
  selectedFields: readonly string[],
  howClose: SpecHowCloseFilter,
): boolean {
  const unique = new Set(gap.missingFields);
  for (const field of selectedFields) {
    if (!unique.has(field)) return false;
  }
  if (howClose === "one") return unique.size === 1;
  if (howClose === "two") return unique.size === 2;
  if (howClose === "most") return unique.size >= 11;
  return true;
}

/**
 * Rank missing Amazon spec fields across checked listings with gaps.
 * Count a field once per listing. Fill first is the top three by count, then label.
 * How close uses distinct field counts on each listing.
 */
export function specFieldFindings(gaps: AmazonSpecGap[]): SpecFieldFindings {
  const fieldCounts = new Map<string, number>();
  let oneField = 0;
  let twoFields = 0;
  let mostOfTheSpec = 0;

  for (const gap of gaps) {
    const unique = new Set(gap.missingFields);
    for (const field of unique) {
      fieldCounts.set(field, (fieldCounts.get(field) ?? 0) + 1);
    }
    const n = unique.size;
    if (n === 1) oneField += 1;
    else if (n === 2) twoFields += 1;
    else if (n >= 11) mostOfTheSpec += 1;
  }

  const fillFirst = [...fieldCounts.entries()]
    .map(([field, count]) => ({ field, label: specFieldLabel(field), count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, 3);

  return {
    fillFirst,
    howClose: { oneField, twoFields, mostOfTheSpec },
  };
}
