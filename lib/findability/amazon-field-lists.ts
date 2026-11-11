/**
 * Draft, awaiting IntoFocus staff approval.
 *
 * Amazon required spec fields per Amazon product type (D-05, direction approved by Brian Magazu on
 * 11 Nov 2026). One list per product type serves every client: a flashlight is FLASHLIGHT for every
 * brand. Amazon's own per-product-type attribute list (SP-API) is pending Amazon developer approval;
 * until then IntoFocus staff approve these lists by hand.
 *
 * How each draft list was built (worker 26.9, 11 Nov 2026): Amazon best sellers in the product
 * type's main category, other brands only, product pages read with the Toolbelt Amazon scraper.
 * A field qualifies when at least 30% of those competitor pages fill it. Identifiers and page facts
 * are left off (UPC, EAN, part and model numbers, ASIN, brand, manufacturer, dimensions, weight,
 * item and pack counts, reviews, warranty, sales rank, model name, series, set name, item type
 * name, and the item highlight blurb). The ASINs sampled and every field's fill rate are in
 * docs/d05-field-lists.md for staff review.
 */

export type AmazonFieldListStatus = "draft" | "approved";

export type AmazonRequiredField = {
  /** The Amazon product-page field id, the same id the Amazon spec check stores. */
  field: string;
  /** Plain name for client copy. */
  label: string;
  /** Competitor listings in the sample that fill the field. */
  filled: number;
};

export type AmazonFieldList = {
  /** Amazon's product type, as Keepa reports it (product_type_name). */
  productType: string;
  /** Plain name for client copy, lower case ("guitars"). */
  label: string;
  status: AmazonFieldListStatus;
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
  fields: Array<[field: string, label: string, filled: number]>,
): AmazonFieldList {
  return {
    productType,
    label,
    status: "draft",
    sampled,
    sourceDate: SOURCE_DATE,
    fields: fields.map(([field, fieldLabel, filled]) => ({ field, label: fieldLabel, filled })),
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
    ["white_brightness", "Brightness", 16],
    ["battery_type", "Battery type", 15],
    ["included_components", "Included components", 15],
    ["material_type", "Material", 15],
    ["mounting_type", "Mounting type", 15],
    ["number_of_batteries", "Number of batteries", 15],
    ["item_shape", "Shape", 14],
    ["recommended_uses_for_product", "Recommended uses", 14],
    ["style_name", "Style", 14],
    ["runtime", "Runtime", 13],
    ["battery_description", "Battery description", 12],
    ["finish_types", "Finish", 12],
    ["size", "Size", 12],
    ["light_output_maximum", "Max lumens", 10],
    ["voltage", "Voltage", 9],
    ["battery_life", "Battery life", 7],
    ["light_source_wattage", "Light wattage", 7],
    ["wattage", "Wattage", 6],
  ]),
  ELECTRIC_LIGHT: list("ELECTRIC_LIGHT", "work and utility lights", 12, [
    ["color", "Color", 12],
    ["included_components", "Included components", 12],
    ["light_source_special_features", "Light special features", 10],
    ["light_source_type", "Light source", 10],
    ["material_type", "Material", 10],
    ["mounting_type", "Mounting type", 10],
    ["light_output_maximum", "Max lumens", 9],
    ["number_of_light_sources", "Number of light sources", 9],
    ["number_of_batteries", "Number of batteries", 8],
    ["power_source", "Power source", 8],
    ["finish_types", "Finish", 7],
    ["style_name", "Style", 7],
    ["voltage", "Voltage", 7],
    ["wattage", "Wattage", 7],
    ["color_temperature", "Color temperature", 5],
    ["shade_material", "Shade material", 5],
    ["shape", "Shape", 5],
    ["additional_features", "Additional features", 4],
    ["battery_type", "Battery type", 4],
    ["beam_angle", "Beam angle", 4],
    ["size", "Size", 4],
  ]),
  ELECTRIC_LANTERN: list("ELECTRIC_LANTERN", "lanterns", 17, [
    ["color", "Color", 17],
    ["light_source_type", "Light source", 17],
    ["material_type", "Material", 17],
    ["number_of_light_sources", "Number of light sources", 17],
    ["water_resistance_level", "Water resistance", 17],
    ["light_source_special_features", "Light special features", 16],
    ["mounting_type", "Mounting type", 16],
    ["power_source", "Power source", 16],
    ["finish_types", "Finish", 15],
    ["included_components", "Included components", 15],
    ["light_output_maximum", "Max lumens", 15],
    ["number_of_batteries", "Number of batteries", 15],
    ["battery_description", "Battery description", 11],
    ["specification_met", "Certifications", 11],
    ["light_source_wattage", "Light wattage", 10],
    ["shade_material", "Shade material", 10],
    ["voltage", "Voltage", 10],
    ["wattage", "Wattage", 10],
    ["battery_life", "Battery life", 9],
    ["beam_angle", "Beam angle", 9],
    ["bulb_base", "Bulb base", 6],
  ]),
};

/**
 * Product types the clients sell in that have no list yet, with their listing counts on
 * 11 Nov 2026. The covered types hold 97.4% of Fender's listings (1,031 of 1,059) and 90.1% of
 * Ledlenser's (163 of 181).
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
