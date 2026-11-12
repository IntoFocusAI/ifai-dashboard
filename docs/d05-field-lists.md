# D-05 Amazon required field lists per product type

Draft, awaiting IntoFocus staff approval. Worker 26.9, 11 Nov 2026. The lists live in
`lib/findability/amazon-field-lists.ts`; this page is the evidence for staff review.

## How the lists were built

- **One list per Amazon product type**, shared by every client. The product type is Keepa's
  `product_type_name` (Amazon's product type, for example GUITARS or FLASHLIGHT).
- **Sample:** the current Amazon best sellers in the product type's main category (Keepa best
  sellers, 11 Nov 2026), other brands only. Fender and Squier listings were dropped from the
  guitar sample; no Ledlenser listing was in the lighting samples. Each page was read with the
  Toolbelt Amazon scraper (`scrape_product`, raw fields), and the field set is the page's
  "Product details" and "Technical details" table (`product_details`).
- **Rule:** a field is on the list when at least 30% of the sampled competitor pages fill it.
- **Left off as identifiers or page facts** (the brief's list): `upc`, `ean`,
  `manufacturer_part_number`, `model_number`, `asin`, `brand_name`, `manufacturer`,
  `item_dimensions`, `item_weight`, `number_of_items`, `customer_reviews`,
  `warranty_description`.
- **Also left off, staff to confirm:** `best_sellers_rank`, `global_trade_identification_number`,
  `item_dimensions_l_x_w_x_h`, `item_dimensions_d_x_w_x_h` (dimension variants), `unit_count`
  and `number_of_packs` (counts, like `number_of_items`), `manufacturer_warranty_description`
  and `warranty_type` (warranty variants), `model_name`, `model_series`, `set_name` (naming),
  `item_type_name` (Amazon's category label), and `item_highlight` (a marketing line).
- **Spec check records it:** whether the current Amazon spec check stores the field for that
  client (Fender: 13 fields, Ledlenser: 13 fields). Amazon Specs judges only those fields as
  missing or present. The rest show as not checked, named in the asterisk tooltip.

## Coverage of each client's listings (11 Nov 2026)

| Client | Product type | Listings | Share | List |
|---|---|---|---|---|
| Fender | GUITARS | 1,031 of 1,059 | 97.4% | Yes |
| Ledlenser | FLASHLIGHT | 152 of 181 | 84.0% | Yes |
| Ledlenser | ELECTRIC_LIGHT | 6 of 181 | 3.3% | Yes |
| Ledlenser | ELECTRIC_LANTERN | 5 of 181 | 2.8% | Yes |

Covered: Fender 97.4%, Ledlenser 90.1% (163 of 181).

**Not yet covered** (these listings keep the interim rule, top 10 by fill rate in their category):

- Fender (28): STRINGED_INSTRUMENTS 16, no product type recorded 4,
  INSTRUMENT_PARTS_AND_ACCESSORIES 3, SHIRT 2, MUSICAL_INSTRUMENT_STRING 1, CAPACITOR 1,
  CARRIER_BAG_CASE 1.
- Ledlenser (18): UTILITY_HOLSTER_POUCH 4, OUTDOOR_RECREATION_PRODUCT 4, POWER_BANK 1,
  CHARGING_ADAPTER 1, HOME_LIGHTING_AND_LAMPS 1, CAMERA_LENS_FILTERS 1, WALL_PLATE 1,
  BICYCLE_LIGHT 1, CARRIER_BAG_CASE 1, LIGHT_FIXTURE 1, ELECTRONIC_CABLE 1,
  VEHICLE_LIGHT_ASSEMBLY 1.

## The lists

### GUITARS (guitars): 17 fields, 15 competitor listings

| Field id | Label | Competitors filling | Fill rate | Spec check records it |
|---|---|---|---|---|
| `back_material_type` | Back material | 15 of 15 | 100% | No |
| `body_material_type` | Body | 15 of 15 | 100% | Yes |
| `color` | Color | 15 of 15 | 100% | Yes |
| `guitar_bridge_system` | Bridge | 15 of 15 | 100% | Yes |
| `guitar_pickup_configuration` | Pickups | 15 of 15 | 100% | Yes |
| `hand_orientation` | Handedness | 15 of 15 | 100% | Yes |
| `instrument` | Instrument | 15 of 15 | 100% | No |
| `neck_material_type` | Neck | 15 of 15 | 100% | Yes |
| `top_material_type` | Top material | 15 of 15 | 100% | No |
| `fretboard_material_type` | Fretboard | 14 of 15 | 93% | Yes |
| `number_of_strings` | Strings | 14 of 15 | 93% | Yes |
| `string_material_type` | String material | 13 of 15 | 87% | No |
| `included_components` | Included components | 9 of 15 | 60% | No |
| `instrument_size` | Instrument size | 8 of 15 | 53% | No |
| `scale_length` | Scale length | 8 of 15 | 53% | Yes |
| `connector_type` | Connector type | 6 of 15 | 40% | No |
| `material_type` | Material | 5 of 15 | 33% | No |

### FLASHLIGHT (flashlights): 25 fields, 17 competitor listings

| Field id | Label | Competitors filling | Fill rate | Spec check records it |
|---|---|---|---|---|
| `additional_features` | Additional features | 17 of 17 | 100% | No |
| `color` | Color | 17 of 17 | 100% | Yes |
| `light_source_type` | Light source | 17 of 17 | 100% | Yes |
| `number_of_light_sources` | Number of light sources | 17 of 17 | 100% | No |
| `power_source` | Power source | 17 of 17 | 100% | Yes |
| `light_source_special_features` | Light special features | 16 of 17 | 94% | No |
| `water_resistance_level` | Water resistance | 16 of 17 | 94% | Yes |
| `white_brightness` | Brightness | 16 of 17 | 94% | No |
| `battery_type` | Battery type | 15 of 17 | 88% | Yes |
| `included_components` | Included components | 15 of 17 | 88% | No |
| `material_type` | Material | 15 of 17 | 88% | Yes |
| `mounting_type` | Mounting type | 15 of 17 | 88% | No |
| `number_of_batteries` | Number of batteries | 15 of 17 | 88% | No |
| `item_shape` | Shape | 14 of 17 | 82% | No |
| `recommended_uses_for_product` | Recommended uses | 14 of 17 | 82% | No |
| `style_name` | Style | 14 of 17 | 82% | No |
| `runtime` | Runtime | 13 of 17 | 76% | Yes |
| `battery_description` | Battery description | 12 of 17 | 71% | No |
| `finish_types` | Finish | 12 of 17 | 71% | No |
| `size` | Size | 12 of 17 | 71% | No |
| `light_output_maximum` | Max lumens | 10 of 17 | 59% | Yes |
| `voltage` | Voltage | 9 of 17 | 53% | No |
| `battery_life` | Battery life | 7 of 17 | 41% | No |
| `light_source_wattage` | Light wattage | 7 of 17 | 41% | No |
| `wattage` | Wattage | 6 of 17 | 35% | No |

### ELECTRIC_LIGHT (work and utility lights): 21 fields, 12 competitor listings

| Field id | Label | Competitors filling | Fill rate | Spec check records it |
|---|---|---|---|---|
| `color` | Color | 12 of 12 | 100% | Yes |
| `included_components` | Included components | 12 of 12 | 100% | No |
| `light_source_special_features` | Light special features | 10 of 12 | 83% | No |
| `light_source_type` | Light source | 10 of 12 | 83% | Yes |
| `material_type` | Material | 10 of 12 | 83% | Yes |
| `mounting_type` | Mounting type | 10 of 12 | 83% | No |
| `light_output_maximum` | Max lumens | 9 of 12 | 75% | Yes |
| `number_of_light_sources` | Number of light sources | 9 of 12 | 75% | No |
| `number_of_batteries` | Number of batteries | 8 of 12 | 67% | No |
| `power_source` | Power source | 8 of 12 | 67% | Yes |
| `finish_types` | Finish | 7 of 12 | 58% | No |
| `style_name` | Style | 7 of 12 | 58% | No |
| `voltage` | Voltage | 7 of 12 | 58% | No |
| `wattage` | Wattage | 7 of 12 | 58% | No |
| `color_temperature` | Color temperature | 5 of 12 | 42% | No |
| `shade_material` | Shade material | 5 of 12 | 42% | No |
| `shape` | Shape | 5 of 12 | 42% | No |
| `additional_features` | Additional features | 4 of 12 | 33% | No |
| `battery_type` | Battery type | 4 of 12 | 33% | Yes |
| `beam_angle` | Beam angle | 4 of 12 | 33% | No |
| `size` | Size | 4 of 12 | 33% | No |

### ELECTRIC_LANTERN (lanterns): 21 fields, 17 competitor listings

| Field id | Label | Competitors filling | Fill rate | Spec check records it |
|---|---|---|---|---|
| `color` | Color | 17 of 17 | 100% | Yes |
| `light_source_type` | Light source | 17 of 17 | 100% | Yes |
| `material_type` | Material | 17 of 17 | 100% | Yes |
| `number_of_light_sources` | Number of light sources | 17 of 17 | 100% | No |
| `water_resistance_level` | Water resistance | 17 of 17 | 100% | Yes |
| `light_source_special_features` | Light special features | 16 of 17 | 94% | No |
| `mounting_type` | Mounting type | 16 of 17 | 94% | No |
| `power_source` | Power source | 16 of 17 | 94% | Yes |
| `finish_types` | Finish | 15 of 17 | 88% | No |
| `included_components` | Included components | 15 of 17 | 88% | No |
| `light_output_maximum` | Max lumens | 15 of 17 | 88% | Yes |
| `number_of_batteries` | Number of batteries | 15 of 17 | 88% | No |
| `battery_description` | Battery description | 11 of 17 | 65% | No |
| `specification_met` | Certifications | 11 of 17 | 65% | No |
| `light_source_wattage` | Light wattage | 10 of 17 | 59% | No |
| `shade_material` | Shade material | 10 of 17 | 59% | No |
| `voltage` | Voltage | 10 of 17 | 59% | No |
| `wattage` | Wattage | 10 of 17 | 59% | No |
| `battery_life` | Battery life | 9 of 17 | 53% | No |
| `beam_angle` | Beam angle | 9 of 17 | 53% | No |
| `bulb_base` | Bulb base | 6 of 17 | 35% | No |

## ASINs sampled

The ASIN is the one the scraped page returned (a variation link can land on a sibling ASIN).

- **GUITARS** (best sellers in Solid Body Electric Guitars, node 11971421; 15): B0010X7LF8 Yamaha,
  B001UR0TVM Yamaha, B07MLGTGXS Ibanez, B0943WH72B SAYHA, B0B3C32DDH Ktaxon, B0BYJD9ZWG Soulmate,
  B0CW8RF9JD AODSK, B0D5TSLBHB Leo Jaymz, B0D7PY7RRB Leo Jaymz, B0DCFWK4C7 EART, B0DCMKDZ35 Leo Jaymz,
  B0DQP56TT6 Enya, B0GGYTMN1Q AKLOT, B0H29CZ7FT Tostar, B0H8X4C5F9 Grote. Dropped: B0C24D1VXW and
  B0GY5CTYPM (Fender Squier).
- **FLASHLIGHT** (best sellers in Handheld Flashlights, node 2445457011, and Headlamps, node 3401361;
  17): B01DNDMSLY Lepro, B071SJ6NBS EverBrite, B08D66HCXW LHKNL, B08YM5S28F Eveready, B09WDGNHCY
  EverBrite, B0B4KJ3MWK BIAT, B0B9GVXLKB Blukar, B0BJPTVCRH Faxins, B0BL3ZVLLH WopkDupk, B0CBPHGWJ2
  Blukar, B0DJQF83C2 TrixHub, B0DT6SS412 Wuben, B0F4KXRGVT Klein Tools, B0GHR5DXFC Olight,
  B0GXYN6KJD Olight, B0H7W1Z2JQ ATFIXM, B0H82TDJFG Victoper.
- **ELECTRIC_LIGHT** (best sellers in Job Site Lighting, node 553504, where Ledlenser's
  ELECTRIC_LIGHT listings sit; 12): B00KWRM78E DeWalt, B08LQQN7VL EZRED, B0CC51Q3K2 Hotligh,
  B0D37LRKJ7 PacoLit, B0FGQ27B34 MechaniLite, B0GHF5Y4J3 Fibrave, B0GQ6VHMWM LNRYY, B0H4QGM83C
  ATFIXM, B0H73MVHD9 Ruboliy, B0H7QRS93P Jinlite, B0HCNFNRXM Ruboliy, B0HFJNVCWN Livowalny.
  Dropped as not portable lights: B01MDLWVRQ Globe Electric clamp lamp, B0DYDW1GNS Adiding and
  B0H7W3FJ5D Tanbaby ceiling garage lights.
- **ELECTRIC_LANTERN** (best sellers in Electric Lanterns, node 21222469011; 17): B0078ZTWP4 Lepro,
  B01C5QSENQ Etekcity, B0716JV1SG LuminAID, B07MKBKN4H FLY2SKY, B082HD5JDH Consciot, B083TXB5QY
  Lepro, B08BFC87D2 Lepro, B08YF4VY7P AlpsWolf, B0915B6X66 XTAUTO, B09329QHWN Energizer, B0BNZB7WNX
  ILEEDear, B0DKY1TY48 SSAV, B0DRR3GGY6 SAMUUN, B0DW48CVCY Lichamp, B0FL22QSGP Glocusent,
  B0GGHCPRVQ Glocusent, B0GTYWCJHX Westinghouse.

## Questions for staff review

1. **Competitor product type was not checked per ASIN.** The samples are best sellers of the
   category where the client's listings of that type sit, read by title. Staff may want to
   confirm each competitor's `product_type_name` in Keepa before approving, mainly for
   ELECTRIC_LIGHT (work lights can be filed under other product types).
2. **Lumens appears twice on lighting pages:** `white_brightness` (16 of 17 flashlights) and
   `light_output_maximum` (10 of 17). The spec check records `light_output_maximum` only.
3. **Beam distance:** the spec check records `beam_distance`, which no competitor page shows
   under that id; Amazon pages use `light_path_distance` (under 30% of the flashlight sample, so
   not on the list).
4. **Variation fields** (`style_name`, `size`) qualify on lighting pages. Staff may prefer to
   leave them off, as they describe the variation rather than the product.
5. **Small samples:** ELECTRIC_LIGHT has 12 listings and covers 6 Ledlenser listings; staff may
   decide that type and ELECTRIC_LANTERN (5 listings) are not worth their own list yet.

## Judging every field later

The current spec check records 13 fields per client, so most required fields are named as not
checked. A scheduled scrape of each client's own Amazon pages with the same scraper would judge
every field on every list. At about 0.06 Toolbelt credits per Amazon page, one weekly pass costs
about 64 credits for Fender (1,059 listings) and 11 credits for Ledlenser (181 listings), about
75 credits a week, or about 325 credits a month. Not built here (no tables or Toolbelt tasks).
