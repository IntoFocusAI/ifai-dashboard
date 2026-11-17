/**
 * Approved 16 Nov 2026 by Brian Magazu (decision 100).
 *
 * Amazon required spec fields per Amazon product type (D-05, direction approved by Brian Magazu on
 * 11 Nov 2026). One list per product type serves every client: a flashlight is FLASHLIGHT for every
 * brand. Amazon's own per-product-type attribute list (SP-API) is pending Amazon developer approval;
 * until then IntoFocus staff approve these lists by hand.
 *
 * How each list was built (worker 26.9, 11 Nov 2026): Amazon best sellers in the product
 * type's main category, other brands only, product pages read with the Toolbelt Amazon scraper.
 * A field qualifies when at least 30% of those competitor pages fill it. Identifiers and page facts
 * are left off (UPC, EAN, part and model numbers, ASIN, brand, manufacturer, dimensions, weight,
 * item and pack counts, reviews, warranty, sales rank, model name, series, set name, item type
 * name, and the item highlight blurb). The ASINs sampled and every field's fill rate are in
 * docs/d05-field-lists.md.
 *
 * Decision 100 (16 Nov 2026): competitor product types are judged by title; brightness
 * (white_brightness) and max lumens (light_output_maximum) are one field, filled when either is;
 * beam distance (under 30% fill) and the variation fields style_name and size stay off; ELECTRIC_LIGHT
 * and ELECTRIC_LANTERN have no list yet (AMAZON_NO_LIST_PRODUCT_TYPES).
 */

export type AmazonRequiredField = {
  /** The Amazon product-page field id, the same id the Amazon spec check stores. */
  field: string;
  /** Plain name for client copy. */
  label: string;
  /** Competitor listings in the sample that fill the field. */
  filled: number;
  /**
   * Other Amazon field ids that count as this same field: the field is filled when this id or any
   * of these is filled (decision 100: brightness and max lumens are one field).
   */
  alsoCounts?: readonly string[];
};

export type AmazonFieldList = {
  /** Amazon's product type, as Keepa reports it (product_type_name). */
  productType: string;
  /** Plain name for client copy, lower case ("guitars"). */
  label: string;
  /** Competitor listings sampled. */
  sampled: number;
  /** Day the competitor pages were read (ISO date). */
  sourceDate: string;
  /** Most-filled first. */
  fields: AmazonRequiredField[];
};

const SOURCE_DATE = "2026-11-11";

function list(
  productType: string,
  label: string,
  sampled: number,
  fields: Array<[field: string, label: string, filled: number, alsoCounts?: readonly string[]]>,
): AmazonFieldList {
  return {
    productType,
    label,
    sampled,
    sourceDate: SOURCE_DATE,
    fields: fields.map(([field, fieldLabel, filled, alsoCounts]) => ({
      field,
      label: fieldLabel,
      filled,
      ...(alsoCounts ? { alsoCounts } : {}),
    })),
  };
}

export const AMAZON_FIELD_LISTS: Readonly<Record<string, AmazonFieldList>> = {
  GUITARS: list("GUITARS", "guitars", 15, [
    ["back_material_type", "Back material", 15],
    ["body_material_type", "Body", 15],
    ["color", "Color", 15],
    ["guitar_bridge_system", "Bridge", 15],
    ["guitar_pickup_configuration", "Pickups", 15],
    ["hand_orientation", "Handedness", 15],
    ["instrument", "Instrument", 15],
    ["neck_material_type", "Neck", 15],
    ["top_material_type", "Top material", 15],
    ["fretboard_material_type", "Fretboard", 14],
    ["number_of_strings", "Strings", 14],
    ["string_material_type", "String material", 13],
    ["included_components", "Included components", 9],
    ["instrument_size", "Instrument size", 8],
    ["scale_length", "Scale length", 8],
    ["connector_type", "Connector type", 6],
    ["material_type", "Material", 5],
  ]),
  FLASHLIGHT: list("FLASHLIGHT", "flashlights", 17, [
    ["additional_features", "Additional features", 17],
    ["color", "Color", 17],
    ["light_source_type", "Light source", 17],
    ["number_of_light_sources", "Number of light sources", 17],
    ["power_source", "Power source", 17],
    ["light_source_special_features", "Light special features", 16],
    ["water_resistance_level", "Water resistance", 16],
    ["white_brightness", "Brightness", 16, ["light_output_maximum"]],
    ["battery_type", "Battery type", 15],
    ["included_components", "Included components", 15],
    ["material_type", "Material", 15],
    ["mounting_type", "Mounting type", 15],
    ["number_of_batteries", "Number of batteries", 15],
    ["item_shape", "Shape", 14],
    ["recommended_uses_for_product", "Recommended uses", 14],
    ["runtime", "Runtime", 13],
    ["battery_description", "Battery description", 12],
    ["finish_types", "Finish", 12],
    ["voltage", "Voltage", 9],
    ["battery_life", "Battery life", 7],
    ["light_source_wattage", "Light wattage", 7],
    ["wattage", "Wattage", 6],
  ]),
};

/**
 * Product types with no approved list yet (decision 100). Their listings read "Not available*" for
 * required fields; they never fall back to another list or count as complete.
 */
export const AMAZON_NO_LIST_PRODUCT_TYPES: Readonly<Record<string, string>> = {
  ELECTRIC_LIGHT: "work and utility lights",
  ELECTRIC_LANTERN: "lanterns",
};

/** Plain name of a product type that has no approved list yet, or null. */
export function noListProductTypeLabel(productType: string | null | undefined): string | null {
  const key = productType?.trim().toUpperCase();
  return key ? (AMAZON_NO_LIST_PRODUCT_TYPES[key] ?? null) : null;
}

/**
 * Other product types the clients sell in that have no list yet, with their listing counts on
 * 11 Nov 2026. Those listings keep the interim rule. The covered types hold 97.4% of Fender's
 * listings (1,031 of 1,059) and 84.0% of Ledlenser's (152 of 181); ELECTRIC_LIGHT (6) and
 * ELECTRIC_LANTERN (5) are in AMAZON_NO_LIST_PRODUCT_TYPES.
 */
export const AMAZON_FIELD_LISTS_NOT_COVERED: Readonly<Record<string, Readonly<Record<string, number>>>> = {
  fmic: {
    STRINGED_INSTRUMENTS: 16,
    "(no product type recorded)": 4,
    INSTRUMENT_PARTS_AND_ACCESSORIES: 3,
    SHIRT: 2,
    MUSICAL_INSTRUMENT_STRING: 1,
    CAPACITOR: 1,
    CARRIER_BAG_CASE: 1,
  },
  ledlenser: {
    UTILITY_HOLSTER_POUCH: 4,
    OUTDOOR_RECREATION_PRODUCT: 4,
    POWER_BANK: 1,
    CHARGING_ADAPTER: 1,
    HOME_LIGHTING_AND_LAMPS: 1,
    CAMERA_LENS_FILTERS: 1,
    WALL_PLATE: 1,
    BICYCLE_LIGHT: 1,
    CARRIER_BAG_CASE: 1,
    LIGHT_FIXTURE: 1,
    ELECTRONIC_CABLE: 1,
    VEHICLE_LIGHT_ASSEMBLY: 1,
  },
};

/** The list for an Amazon product type, or null when there is none. */
export function amazonFieldList(productType: string | null | undefined): AmazonFieldList | null {
  const key = productType?.trim().toUpperCase();
  return key ? (AMAZON_FIELD_LISTS[key] ?? null) : null;
}

/** Competitor fill rate, 0 to 100. */
export function competitorFillPct(list: AmazonFieldList, field: AmazonRequiredField): number {
  return list.sampled > 0 ? (100 * field.filled) / list.sampled : 0;
}
