/**
 * AI Foundation (SC-01), AI Commerce (SC-02), and AI Consensus (SC-04) scores.
 * Each component is a measured share from 0 to 100. A missing input drops that
 * component and rescales the remaining weights to 100. Missing is never scored as zero.
 * AI Actuation (SC-03) has no records in this pilot and stays omitted.
 */

/** Minimal gap shape so this module does not import portfolio-retail (avoids a cycle). */
export type RequiredSpecGap = {
  missingFields: string[];
};

/** Guitar and instrument fields used for the D-05 required-spec placeholder. */
export const REQUIRED_MARKETPLACE_SPEC_FIELDS = [
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

export const REQUIRED_MARKETPLACE_SPEC_FIELD_SET: ReadonlySet<string> = new Set(
  REQUIRED_MARKETPLACE_SPEC_FIELDS,
);

/** Plain labels for the placeholder tooltip (same wording as Catalog Governance). */
export const REQUIRED_MARKETPLACE_SPEC_LABELS = [
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

export const AUTHORIZED_BUY_BOX_PARTNERS = ["Austin Bazaar", "GearTree"] as const;

export const REQUIRED_SPECS_PLACEHOLDER_TOOLTIP =
  "Placeholder: this list is a default until required specs are approved by category. The guitar and instrument fields are scale length, handedness, weight, dimensions, strings, fretboard, bridge, pickups, neck, part number, body, color, and UPC.";

export const CONTROLLED_BUY_BOX_PLACEHOLDER_TOOLTIP =
  "Placeholder: Amazon Retail, Austin Bazaar, and GearTree are the set used until the authorized-partner list is confirmed.";

export type ScoreCoverage = {
  numerator: number;
  denominator: number;
};

export type ScoreComponentId =
  | "exact_official_pages"
  | "machine_readable_specs"
  | "required_marketplace_specs"
  | "unbranded_named_most"
  | "fact_check_match"
  | "controlled_buy_box"
  | "not_suppressed"
  | "active_products_available"
  | "not_splintered"
  | "no_map_violation";

export type ScoreComponentSpec = {
  id: ScoreComponentId;
  name: string;
  /** Nominal weight before rescale. */
  weight: number;
  placeholder?: boolean;
  placeholderTitle?: string;
  placeholderTooltip?: string;
};

export type ScoreComponentInput = ScoreComponentSpec & {
  /** Measured share 0-100. Null drops this component (never treated as zero). */
  score: number | null;
  coverage: ScoreCoverage | null;
};

export type ScoredComponent = ScoreComponentSpec & {
  /** Rescaled weight among included components. Sums to 100 when any are included. */
  weight: number;
  score: number;
  coverage: ScoreCoverage;
  included: true;
};

export type DroppedComponent = ScoreComponentSpec & {
  included: false;
  reason: "missing_input";
};

export type PillarScore = {
  id: "foundation" | "commerce" | "actuation";
  name: string;
  /** Nominal consensus weight before Actuation drop / rescale. */
  nominalWeight: number;
  /** Null when the pillar is omitted (Actuation) or has no included components. */
  score: number | null;
  /** Rescaled consensus weight. Null when omitted. */
  weight: number | null;
  included: boolean;
  omittedLabel?: string;
  components: Array<ScoredComponent | DroppedComponent>;
  /** Included components of planned components. */
  coverage: ScoreCoverage | null;
};

export type ConsensusScore = {
  score: number | null;
  coverage: ScoreCoverage;
  foundation: PillarScore;
  commerce: PillarScore;
  actuation: PillarScore;
};

export type ShareInput = {
  numerator: number;
  denominator: number;
};

/** Share as 0-100. Null when the population is empty or not stored. */
export function shareScore(input: ShareInput | null | undefined): number | null {
  if (!input) return null;
  if (!(input.denominator > 0) || input.numerator < 0) return null;
  if (input.numerator > input.denominator) return null;
  return (100 * input.numerator) / input.denominator;
}

/**
 * Drop missing components and rescale remaining nominal weights so they sum to 100.
 * A dropped component does not become a score of zero.
 */
export function rescaleComponents(components: ScoreComponentInput[]): {
  score: number | null;
  included: ScoredComponent[];
  dropped: DroppedComponent[];
  coverage: ScoreCoverage;
} {
  const includedInputs: ScoreComponentInput[] = [];
  const dropped: DroppedComponent[] = [];

  for (const component of components) {
    if (
      component.score == null ||
      component.coverage == null ||
      !(component.coverage.denominator > 0) ||
      !Number.isFinite(component.score)
    ) {
      dropped.push({
        id: component.id,
        name: component.name,
        weight: component.weight,
        placeholder: component.placeholder,
        placeholderTitle: component.placeholderTitle,
        placeholderTooltip: component.placeholderTooltip,
        included: false,
        reason: "missing_input",
      });
      continue;
    }
    includedInputs.push(component);
  }

  const weightSum = includedInputs.reduce((sum, row) => sum + row.weight, 0);
  if (weightSum <= 0 || includedInputs.length === 0) {
    return {
      score: null,
      included: [],
      dropped,
      coverage: { numerator: 0, denominator: components.length },
    };
  }

  const included: ScoredComponent[] = includedInputs.map((row) => ({
    id: row.id,
    name: row.name,
    weight: (100 * row.weight) / weightSum,
    placeholder: row.placeholder,
    placeholderTitle: row.placeholderTitle,
    placeholderTooltip: row.placeholderTooltip,
    score: row.score as number,
    coverage: row.coverage as ScoreCoverage,
    included: true,
  }));

  const score = included.reduce((sum, row) => sum + (row.score * row.weight) / 100, 0);

  return {
    score,
    included,
    dropped,
    coverage: { numerator: included.length, denominator: components.length },
  };
}

function text(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/** Amazon Retail: buybox_status Amazon 1P, or seller name Amazon / Amazon.com. */
export function isAmazonRetailSeller(row: {
  buybox_status?: string | null;
  buybox_seller_name?: string | null;
}): boolean {
  const status = text(row.buybox_status);
  if (status === "Amazon 1P") return true;
  const seller = text(row.buybox_seller_name)?.toLowerCase();
  return seller === "amazon" || seller === "amazon.com";
}

/**
 * Partner names used for a Controlled Buy Box count.
 * Omit the argument, or pass null, to keep AUTHORIZED_BUY_BOX_PARTNERS.
 * An array, including an empty one, replaces that placeholder set.
 */
function partnerNames(partners?: readonly string[] | null): readonly string[] {
  return partners == null ? AUTHORIZED_BUY_BOX_PARTNERS : partners;
}

/**
 * Named authorized partner.
 * The default is the placeholder set. A saved list replaces it. An empty list matches nobody.
 */
export function isAuthorizedBuyBoxPartner(
  row: {
    buybox_seller_name?: string | null;
  },
  partners?: readonly string[] | null,
): boolean {
  const seller = text(row.buybox_seller_name)?.toLowerCase();
  if (!seller) return false;
  return partnerNames(partners).some((name) => name.trim().toLowerCase() === seller);
}

/** Controlled = Amazon Retail or a named authorized partner. Amazon Retail still counts when the saved list is empty. */
export function isControlledBuyBoxSeller(
  row: {
    buybox_status?: string | null;
    buybox_seller_name?: string | null;
  },
  partners?: readonly string[] | null,
): boolean {
  return isAmazonRetailSeller(row) || isAuthorizedBuyBoxPartner(row, partners);
}

/**
 * Known seller identity for the Controlled Buy Box denominator.
 * Unknown sellers drop out. They are not failures.
 */
export function hasKnownBuyBoxSeller(row: {
  buybox_status?: string | null;
  buybox_seller_name?: string | null;
}): boolean {
  if (isAmazonRetailSeller(row)) return true;
  return text(row.buybox_seller_name) != null;
}

export type ControlledBuyBoxDetail = {
  controlled: number;
  known: number;
  population: number;
};

/** Controlled Buy Box share among listings with a known seller. */
export function controlledBuyBoxFinding(
  rows: Array<{
    buybox_status?: string | null;
    buybox_seller_name?: string | null;
  }> | null,
  partners?: readonly string[] | null,
): ControlledBuyBoxDetail | null {
  if (rows == null) return null;
  let controlled = 0;
  let known = 0;
  for (const row of rows) {
    if (!hasKnownBuyBoxSeller(row)) continue;
    known += 1;
    if (isControlledBuyBoxSeller(row, partners)) controlled += 1;
  }
  return { controlled, known, population: rows.length };
}

/** One non-Amazon seller name present in the Buy Box read, and how many known listings it holds. */
export type BuyBoxSellerChoice = {
  name: string;
  listings: number;
};

/**
 * Seller tally from the Buy Box read.
 * Amazon Retail is a count, not a checkbox name. Unknown sellers are omitted.
 */
export type BuyBoxSellerCensus = {
  amazonRetail: number;
  sellers: BuyBoxSellerChoice[];
  known: number;
  population: number;
};

/** Distinct non-Amazon seller names in the Buy Box read, with listing counts. Null when the read did not load. */
export function buyBoxSellerCensus(
  rows: Array<{
    buybox_status?: string | null;
    buybox_seller_name?: string | null;
  }> | null,
): BuyBoxSellerCensus | null {
  if (rows == null) return null;
  const byKey = new Map<string, BuyBoxSellerChoice>();
  let amazonRetail = 0;
  let known = 0;
  for (const row of rows) {
    if (!hasKnownBuyBoxSeller(row)) continue;
    known += 1;
    if (isAmazonRetailSeller(row)) {
      amazonRetail += 1;
      continue;
    }
    const name = text(row.buybox_seller_name);
    if (!name) continue;
    const key = name.toLowerCase();
    const found = byKey.get(key);
    if (found) found.listings += 1;
    else byKey.set(key, { name, listings: 1 });
  }
  return {
    amazonRetail,
    sellers: [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name)),
    known,
    population: rows.length,
  };
}

/** Same Controlled Buy Box count as the row walk, from the stored seller tally. */
export function controlledBuyBoxFromCensus(
  census: BuyBoxSellerCensus,
  partners?: readonly string[] | null,
): ControlledBuyBoxDetail {
  const allowed = new Set(partnerNames(partners).map((name) => name.trim().toLowerCase()));
  let partnerListings = 0;
  for (const seller of census.sellers) {
    if (allowed.has(seller.name.toLowerCase())) partnerListings += seller.listings;
  }
  return {
    controlled: census.amazonRetail + partnerListings,
    known: census.known,
    population: census.population,
  };
}

/**
 * Checked listings where none of the placeholder required fields are missing.
 * A gap listing that only misses other fields still counts as filled for this list.
 */
export function requiredMarketplaceSpecShare(
  gaps: RequiredSpecGap[] | null | undefined,
  checked: number | null | undefined,
): ShareInput | null {
  if (gaps == null || checked == null || !(checked > 0)) return null;
  const missingRequired = gaps.filter((gap) =>
    gap.missingFields.some((field) => REQUIRED_MARKETPLACE_SPEC_FIELD_SET.has(field)),
  ).length;
  const filled = Math.max(0, checked - missingRequired);
  return { numerator: filled, denominator: checked };
}

export const FOUNDATION_COMPONENT_SPECS: ScoreComponentSpec[] = [
  {
    id: "exact_official_pages",
    name: "Exact official product pages",
    weight: 25,
  },
  {
    id: "machine_readable_specs",
    name: "Machine-readable brand-site specs",
    weight: 25,
  },
  {
    id: "required_marketplace_specs",
    name: "Required marketplace specs filled",
    weight: 20,
    placeholder: true,
    placeholderTitle: "Required marketplace specs",
    placeholderTooltip: REQUIRED_SPECS_PLACEHOLDER_TOOLTIP,
  },
  {
    id: "unbranded_named_most",
    name: "Resolved unbranded answers where Fender/Squier is named most",
    weight: 20,
  },
  {
    id: "fact_check_match",
    name: "Fact checks that match a verified fact",
    weight: 10,
  },
];

export const COMMERCE_COMPONENT_SPECS: ScoreComponentSpec[] = [
  {
    id: "controlled_buy_box",
    name: "Controlled Buy Box",
    weight: 35,
    placeholder: true,
    placeholderTitle: "Controlled Buy Box",
    placeholderTooltip: CONTROLLED_BUY_BOX_PLACEHOLDER_TOOLTIP,
  },
  {
    id: "not_suppressed",
    name: "Not suppressed",
    weight: 25,
  },
  {
    id: "active_products_available",
    name: "Active products available",
    weight: 15,
  },
  {
    id: "not_splintered",
    name: "Not splintered",
    weight: 15,
  },
  {
    id: "no_map_violation",
    name: "No current MAP violation",
    weight: 10,
  },
];

export type FoundationInputs = {
  exactOfficialPages: ShareInput | null;
  machineReadableSpecs: ShareInput | null;
  requiredMarketplaceSpecs: ShareInput | null;
  unbrandedNamedMost: ShareInput | null;
  factCheckMatch: ShareInput | null;
};

export type CommerceInputs = {
  controlledBuyBox: ShareInput | null;
  notSuppressed: ShareInput | null;
  /** Null omits this component. Do not invent from 12-month out-of-stock history. */
  activeProductsAvailable: ShareInput | null;
  notSplintered: ShareInput | null;
  noMapViolation: ShareInput | null;
};

function pillarFromComponents(
  id: PillarScore["id"],
  name: string,
  nominalWeight: number,
  specs: ScoreComponentSpec[],
  scores: Record<string, ShareInput | null>,
): PillarScore {
  const inputs: ScoreComponentInput[] = specs.map((spec) => {
    const share = scores[spec.id] ?? null;
    return {
      ...spec,
      score: shareScore(share),
      coverage: share,
    };
  });
  const result = rescaleComponents(inputs);
  const components: Array<ScoredComponent | DroppedComponent> = [
    ...result.included,
    ...result.dropped,
  ];
  // Keep planned order for the UI.
  const byId = new Map(components.map((row) => [row.id, row]));
  const ordered = specs.map((spec) => byId.get(spec.id)!);

  return {
    id,
    name,
    nominalWeight,
    score: result.score,
    weight: null,
    included: result.score != null,
    components: ordered,
    coverage: result.coverage,
  };
}

/** AI Foundation (SC-01). Same weights for every seller type. */
export function foundationScore(inputs: FoundationInputs): PillarScore {
  return pillarFromComponents("foundation", "AI Foundation", 40, FOUNDATION_COMPONENT_SPECS, {
    exact_official_pages: inputs.exactOfficialPages,
    machine_readable_specs: inputs.machineReadableSpecs,
    required_marketplace_specs: inputs.requiredMarketplaceSpecs,
    unbranded_named_most: inputs.unbrandedNamedMost,
    fact_check_match: inputs.factCheckMatch,
  });
}

export type CommerceScoreOptions = {
  /**
   * Null keeps AUTHORIZED_BUY_BOX_PARTNERS and the Controlled Buy Box placeholder mark.
   * An array replaces that set. An empty array counts Amazon Retail only and clears the mark.
   */
  authorizedPartners?: readonly string[] | null;
};

function commerceSpecs(authorizedPartners: readonly string[] | null): ScoreComponentSpec[] {
  if (authorizedPartners == null) return COMMERCE_COMPONENT_SPECS;
  return COMMERCE_COMPONENT_SPECS.map((spec) =>
    spec.id === "controlled_buy_box"
      ? {
          ...spec,
          placeholder: false,
          placeholderTitle: undefined,
          placeholderTooltip: undefined,
        }
      : spec,
  );
}

/** AI Commerce (SC-02). Partner-led weights for Fender. Other seller-type weights are unchanged. */
export function commerceScore(inputs: CommerceInputs, options?: CommerceScoreOptions): PillarScore {
  const authorizedPartners = options?.authorizedPartners ?? null;
  return pillarFromComponents("commerce", "AI Commerce", 40, commerceSpecs(authorizedPartners), {
    controlled_buy_box: inputs.controlledBuyBox,
    not_suppressed: inputs.notSuppressed,
    active_products_available: inputs.activeProductsAvailable,
    not_splintered: inputs.notSplintered,
    no_map_violation: inputs.noMapViolation,
  });
}

/** AI Actuation (SC-03): no owner, evidence, or date records. Always omitted. */
export function actuationScore(): PillarScore {
  return {
    id: "actuation",
    name: "AI Actuation",
    nominalWeight: 20,
    score: null,
    weight: null,
    included: false,
    omittedLabel: "Not included",
    components: [],
    coverage: null,
  };
}

/**
 * AI Consensus (SC-04): Foundation 40% + Commerce 40% + Actuation 20%.
 * With Actuation omitted, Foundation and Commerce each carry half of the remaining weight.
 */
export function consensusScore(
  foundationInputs: FoundationInputs,
  commerceInputs: CommerceInputs,
  options?: CommerceScoreOptions,
): ConsensusScore {
  const foundation = foundationScore(foundationInputs);
  const commerce = commerceScore(commerceInputs, options);
  const actuation = actuationScore();

  const pillars = [foundation, commerce, actuation];
  const includedPillars = pillars.filter((pillar) => pillar.included && pillar.score != null);
  const weightSum = includedPillars.reduce((sum, pillar) => sum + pillar.nominalWeight, 0);

  let consensus: number | null = null;
  if (weightSum > 0) {
    consensus = 0;
    for (const pillar of includedPillars) {
      const weight = (100 * pillar.nominalWeight) / weightSum;
      pillar.weight = weight;
      consensus += ((pillar.score as number) * weight) / 100;
    }
  }

  for (const pillar of pillars) {
    if (!pillar.included) pillar.weight = null;
  }

  return {
    score: consensus,
    coverage: {
      numerator: includedPillars.length,
      denominator: pillars.length,
    },
    foundation,
    commerce,
    actuation,
  };
}
