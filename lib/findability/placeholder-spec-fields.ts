/**
 * Placeholder required-spec field sets for the AI Foundation score's "Required marketplace specs
 * filled" component, keyed by Amazon product type (P-29, P-30, decision 105). One set serves every
 * client whose settings list that product type (product_types in data/clients/<key>.json), so the
 * choice comes from the settings record, never from the client's name. A client whose product
 * types have no set here gets no placeholder figure (Not available*), never another client's set.
 *
 * These are the placeholder lists that stand until the approved per-product-type lists
 * (amazon-field-lists.ts, D-05) replace them in the score.
 */

import { activeClientSettings } from "@/lib/client/active-client";

export type PlaceholderSpecGroup = {
  /** Amazon product types (product_type_name) this set serves. */
  productTypes: readonly string[];
  /** Plain name of the field set in the tooltip: "guitar and instrument". */
  label: string;
  /** Amazon field ids the spec check stores. */
  fields: readonly string[];
  /** Plain labels for the tooltip, in field order. */
  labels: readonly string[];
  /** The specs a brand-site spec block carries, for copy: "neck, pickup, and hardware specs". */
  specPhrase: string | null;
};

/** Guitar and instrument fields used for the D-05 required-spec placeholder. */
export const GUITAR_PLACEHOLDER_SPEC_FIELDS = [
  "scale_length",
  "hand_orientation",
  "item_weight",
  "item_dimensions",
  "number_of_strings",
  "fretboard_material_type",
  "guitar_bridge_system",
  "guitar_pickup_configuration",
  "neck_material_type",
  "manufacturer_part_number",
  "body_material_type",
  "color",
  "upc",
] as const;

/** Plain labels for the placeholder tooltip (same wording as Catalog Governance). */
export const GUITAR_PLACEHOLDER_SPEC_LABELS = [
  "scale length",
  "handedness",
  "weight",
  "dimensions",
  "strings",
  "fretboard",
  "bridge",
  "pickups",
  "neck",
  "part number",
  "body",
  "color",
  "UPC",
] as const;

/** Lighting fields (flashlights, headlamps, lanterns) for the same placeholder. */
export const LIGHTING_PLACEHOLDER_SPEC_FIELDS = [
  "light_output_maximum",
  "beam_distance",
  "runtime",
  "water_resistance_level",
  "battery_type",
  "power_source",
  "light_source_type",
  "item_weight",
  "item_dimensions",
  "material_type",
  "color",
  "upc",
  "manufacturer_part_number",
] as const;

const LIGHTING_PLACEHOLDER_SPEC_LABELS = [
  "max lumens",
  "beam distance",
  "runtime",
  "water resistance",
  "battery type",
  "power source",
  "light source",
  "weight",
  "dimensions",
  "material",
  "color",
  "UPC",
  "part number",
] as const;

export const PLACEHOLDER_SPEC_GROUPS: readonly PlaceholderSpecGroup[] = [
  {
    productTypes: ["GUITARS"],
    label: "guitar and instrument",
    fields: GUITAR_PLACEHOLDER_SPEC_FIELDS,
    labels: GUITAR_PLACEHOLDER_SPEC_LABELS,
    specPhrase: "neck, pickup, and hardware specs",
  },
  {
    productTypes: ["FLASHLIGHT", "ELECTRIC_LIGHT", "ELECTRIC_LANTERN"],
    label: "lighting",
    fields: LIGHTING_PLACEHOLDER_SPEC_FIELDS,
    labels: LIGHTING_PLACEHOLDER_SPEC_LABELS,
    specPhrase: null,
  },
];

/** "a, b, and c" */
function series(items: readonly string[]): string {
  if (items.length <= 2) return items.join(" and ");
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

/** The placeholder sets for the product types in the client's settings, in settings order, once each. */
export function placeholderSpecGroups(productTypes: readonly string[] = activeClientSettings().product_types): PlaceholderSpecGroup[] {
  const groups: PlaceholderSpecGroup[] = [];
  for (const type of productTypes) {
    const group = PLACEHOLDER_SPEC_GROUPS.find((g) => g.productTypes.includes(type.toUpperCase()));
    if (group && !groups.includes(group)) groups.push(group);
  }
  return groups;
}

/** Every placeholder field for the client on screen, or null when its product types have no set. */
export function placeholderSpecFieldSet(): ReadonlySet<string> | null {
  const groups = placeholderSpecGroups();
  return groups.length ? new Set(groups.flatMap((g) => g.fields)) : null;
}

/** The placeholder tooltip, naming each set the client's product types use. */
export function placeholderSpecTooltip(): string {
  const groups = placeholderSpecGroups();
  const lead = "Placeholder: this list is a default until required specs are approved by category.";
  if (groups.length === 0) return `${lead} No placeholder list covers this brand's Amazon product types yet.`;
  return [lead, ...groups.map((g) => `The ${g.label} fields are ${series(g.labels)}.`)].join(" ");
}

/** What a brand-site spec block carries for the client's product types, for copy. */
export function specBlockPhrase(): string {
  const phrases = placeholderSpecGroups()
    .map((g) => g.specPhrase)
    .filter((p): p is string => p != null);
  return phrases.length === 1 ? phrases[0]! : "detailed product specs";
}
