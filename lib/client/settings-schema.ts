/* The client settings record (decision 105, X-35): one JSON file per client in data/clients/.
   Field names follow ledlenser.client_config, so the database table that replaces these files
   with X-16 can hold the same shape. validateClientSettings checks a file and lists every
   problem it finds, so a bad file fails the build and the tests with a clear message. */

/** The five seller types in docs/client-seller-models.md, as ledlenser.client_config spells them. */
export const SELLER_TYPES = ["partner_led", "brand_led", "amazon_retail_only", "hybrid", "no_managed_presence"] as const;
export type SellerType = (typeof SELLER_TYPES)[number];

/** Seller types the dashboard draws today. Others are built when a signed client needs one (decision 105). */
export const BUILT_SELLER_TYPES: readonly SellerType[] = ["partner_led", "brand_led"];

/** Column names in the client's canvas views: Fender's (fender_win) or brand-neutral (brand_win). */
export const COLUMN_NAMINGS = ["fender", "neutral"] as const;
export type ColumnNaming = (typeof COLUMN_NAMINGS)[number];

/** Data sources a client can have, keyed as the data-source freshness list keys them. */
export const DATA_SOURCE_KEYS = [
  "ai_search",
  "ai_api",
  "amazon_offers",
  "keepa_history",
  "walmart",
  "musiciansfriend",
  "amazon_specs",
  "amazon_sales",
  "brand_site",
  "brand_sheet",
] as const;
export type DataSourceKey = (typeof DATA_SOURCE_KEYS)[number];

export type ClientCompetitor = {
  name: string;
  /** Lowercase words that name the competitor in a question or answer. */
  terms: string[];
  /** The competitor's own websites. */
  domains: string[];
};

export type ClientRetailer = {
  /** Matches the data-source key: "walmart", "musiciansfriend". */
  key: string;
  name: string;
  /** Normal recheck interval in days. A row is stale after twice this. */
  recheck_days: number;
};

export type AnalystEstimateLine = { label: string; value: string };

export type ClientAnalystEstimates = {
  /** Phase 1 quick-win lift, as entered: "+$680K". */
  phase_one: string;
  /** Full enterprise potential, as entered: "+$38M to $62M". */
  enterprise: string;
  phase_one_lines: AnalystEstimateLine[];
  enterprise_lines: AnalystEstimateLine[];
};

export type ClientSettings = {
  client_key: string;
  /** The client the dashboard shows with no ?client= parameter. Exactly one client sets it. */
  is_default: boolean;
  /** client_key in public.issue_set_asides and the other shared, client-keyed tables. */
  set_aside_key: string;
  display_name: string;
  legal_name: string;
  /** Database schema that holds this client's canvas_* views. */
  data_schema: string;
  column_naming: ColumnNaming;
  /** White logo for the dark Summary bubble, under public/. Null shows the brand name. */
  logo_src: string | null;
  /** The brand the AI lead rates count: "Fender/Squier". */
  lead_brand_label: string;
  /** The same brand in a sentence: "Fender or Squier". */
  lead_brand_phrase: string;
  /** Lowercase words that count as the client brand in an answer. */
  brand_name_terms: string[];
  /** Lowercase model-line words that make a question brand-associated ("stratocaster"). */
  product_line_terms: string[];
  /** Brands the client owns, as copy names them. */
  portfolio_brands: string[];
  /** The brand's own websites. */
  owned_domains: string[];
  /** Short label for the brand's own website: "fender.com". */
  brand_site_label: string;
  /** Regional sites (ledlenser.co.uk) count as brand-owned. */
  regional_site_rule: boolean;
  seller_type: SellerType;
  /** Amazon seller ids that count as the brand selling (brand-led). */
  brand_seller_ids: string[];
  /** Dealers counted as controlled Buy Box until the viewer saves their own list (partner-led). */
  default_authorized_partners: string[];
  /** Brand names as Amazon listings carry them. */
  amazon_brand_names: string[];
  /** Amazon product types the client's listings are checked against (product_type_name). */
  product_types: string[];
  /** Picks the shared reference site lists: "music_instruments", "lighting". */
  vertical: string;
  competitors: ClientCompetitor[];
  /** Retailers other than Amazon whose prices are checked. */
  retailers: ClientRetailer[];
  data_sources: Record<DataSourceKey, boolean>;
  /** The AI collector the client's history view admits, or null for no pin. */
  collector_version_pin: string | null;
  /** Staff can write this client's question list from Build prompts. */
  prompts_editable: boolean;
  /** Roadmap and Action Items focus set by IntoFocus staff; null plans for the whole brand. */
  roadmap_focus_category: string | null;
  /** Analyst estimates as entered, or null when none are prepared yet. */
  analyst_estimates: ClientAnalystEstimates | null;
  /** The approved catalog rotation plan for product fact checks, or null. */
  catalog_rotation_rule: string | null;
  /** Shorter labels for long stored category names in tight cells. */
  category_short_labels: Record<string, string>;
  /** Optional short client note for the Briefing (decision 105). */
  briefing_note?: string | null;
  /**
   * The Amazon category the client's sales ranks are counted in. Names the stored rank curve used
   * when too few listings are tracked to calibrate one (lib/estimates/benchmarks.ts RANK_CURVES).
   */
  amazon_rank_category?: string | null;
};

export class ClientSettingsError extends Error {
  readonly problems: string[];
  constructor(source: string, problems: string[]) {
    super(`Client settings ${source} are not valid:\n- ${problems.join("\n- ")}`);
    this.name = "ClientSettingsError";
    this.problems = problems;
  }
}

const KEY_PATTERN = /^[a-z][a-z0-9-]*$/;
const FIELDS: readonly (keyof ClientSettings)[] = [
  "client_key",
  "is_default",
  "set_aside_key",
  "display_name",
  "legal_name",
  "data_schema",
  "column_naming",
  "logo_src",
  "lead_brand_label",
  "lead_brand_phrase",
  "brand_name_terms",
  "product_line_terms",
  "portfolio_brands",
  "owned_domains",
  "brand_site_label",
  "regional_site_rule",
  "seller_type",
  "brand_seller_ids",
  "default_authorized_partners",
  "amazon_brand_names",
  "product_types",
  "vertical",
  "competitors",
  "retailers",
  "data_sources",
  "collector_version_pin",
  "prompts_editable",
  "roadmap_focus_category",
  "analyst_estimates",
  "catalog_rotation_rule",
  "category_short_labels",
  "briefing_note",
  "amazon_rank_category",
];
const OPTIONAL: ReadonlySet<string> = new Set(["briefing_note", "amazon_rank_category"]);

type Problems = string[];
type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

function text(o: Obj, field: string, out: Problems): void {
  if (!isText(o[field])) out.push(`${field} must be a non-empty string`);
}
function textOrNull(o: Obj, field: string, out: Problems): void {
  if (o[field] !== null && !isText(o[field])) out.push(`${field} must be a non-empty string or null`);
}
function bool(o: Obj, field: string, out: Problems): void {
  if (typeof o[field] !== "boolean") out.push(`${field} must be true or false`);
}
function texts(o: Obj, field: string, out: Problems, opts: { nonEmpty?: boolean; lower?: boolean } = {}): void {
  const v = o[field];
  if (!Array.isArray(v) || !v.every(isText)) {
    out.push(`${field} must be a list of non-empty strings`);
    return;
  }
  if (opts.nonEmpty && v.length === 0) out.push(`${field} must not be empty`);
  if (opts.lower && v.some((s) => s !== s.toLowerCase())) out.push(`${field} must be lowercase`);
  if (new Set(v).size !== v.length) out.push(`${field} has duplicates`);
}
function oneOf(o: Obj, field: string, allowed: readonly string[], out: Problems): void {
  if (!allowed.includes(o[field] as string)) out.push(`${field} must be one of ${allowed.join(", ")}`);
}

function competitors(o: Obj, out: Problems): void {
  const v = o.competitors;
  if (!Array.isArray(v)) {
    out.push("competitors must be a list");
    return;
  }
  v.forEach((c, i) => {
    if (!isObj(c)) return void out.push(`competitors[${i}] must be an object`);
    text(c, "name", out);
    texts(c, "terms", out, { lower: true });
    texts(c, "domains", out, { nonEmpty: true, lower: true });
  });
}

function retailers(o: Obj, out: Problems): void {
  const v = o.retailers;
  if (!Array.isArray(v)) {
    out.push("retailers must be a list");
    return;
  }
  v.forEach((r, i) => {
    if (!isObj(r)) return void out.push(`retailers[${i}] must be an object`);
    text(r, "key", out);
    text(r, "name", out);
    if (typeof r.recheck_days !== "number" || !(r.recheck_days > 0)) out.push(`retailers[${i}].recheck_days must be a positive number`);
  });
}

function dataSources(o: Obj, out: Problems): void {
  const v = o.data_sources;
  if (!isObj(v)) {
    out.push("data_sources must be an object");
    return;
  }
  for (const key of DATA_SOURCE_KEYS) {
    if (typeof v[key] !== "boolean") out.push(`data_sources.${key} must be true or false`);
  }
  for (const key of Object.keys(v)) {
    if (!(DATA_SOURCE_KEYS as readonly string[]).includes(key)) out.push(`data_sources.${key} is not a known data source`);
  }
}

function estimateLines(o: Obj, field: string, out: Problems): void {
  const v = o[field];
  if (!Array.isArray(v) || !v.every((l) => isObj(l) && isText(l.label) && isText(l.value))) {
    out.push(`analyst_estimates.${field} must be a list of {label, value}`);
  }
}

function analystEstimates(o: Obj, out: Problems): void {
  const v = o.analyst_estimates;
  if (v === null) return;
  if (!isObj(v)) return void out.push("analyst_estimates must be an object or null");
  if (!isText(v.phase_one)) out.push("analyst_estimates.phase_one must be a non-empty string");
  if (!isText(v.enterprise)) out.push("analyst_estimates.enterprise must be a non-empty string");
  estimateLines(v, "phase_one_lines", out);
  estimateLines(v, "enterprise_lines", out);
}

function shortLabels(o: Obj, out: Problems): void {
  const v = o.category_short_labels;
  if (!isObj(v) || !Object.values(v).every(isText)) out.push("category_short_labels must map each label to a non-empty string");
}

/**
 * Checks one settings record and returns it typed. Throws ClientSettingsError naming the file and
 * every problem. `source` names the file in the message ("data/clients/fender.json").
 */
export function validateClientSettings(raw: unknown, source: string): ClientSettings {
  if (!isObj(raw)) throw new ClientSettingsError(source, ["the file must hold one JSON object"]);
  const out: Problems = [];
  for (const field of FIELDS) {
    if (!(field in raw) && !OPTIONAL.has(field)) out.push(`${field} is missing`);
  }
  for (const field of Object.keys(raw)) {
    if (!(FIELDS as readonly string[]).includes(field)) out.push(`${field} is not a settings field`);
  }
  if (!isText(raw.client_key) || !KEY_PATTERN.test(raw.client_key)) {
    out.push("client_key must be lowercase letters, digits and hyphens, starting with a letter");
  }
  for (const f of ["set_aside_key", "display_name", "legal_name", "data_schema", "lead_brand_label", "lead_brand_phrase", "brand_site_label", "vertical"]) {
    text(raw, f, out);
  }
  for (const f of ["logo_src", "collector_version_pin", "roadmap_focus_category", "catalog_rotation_rule"]) {
    textOrNull(raw, f, out);
  }
  if (isText(raw.logo_src) && !raw.logo_src.startsWith("/")) out.push("logo_src must be a path under public/, starting with /");
  if ("briefing_note" in raw && raw.briefing_note !== undefined) textOrNull(raw, "briefing_note", out);
  if ("amazon_rank_category" in raw && raw.amazon_rank_category !== undefined) textOrNull(raw, "amazon_rank_category", out);
  for (const f of ["is_default", "regional_site_rule", "prompts_editable"]) bool(raw, f, out);
  texts(raw, "brand_name_terms", out, { nonEmpty: true, lower: true });
  texts(raw, "product_line_terms", out, { lower: true });
  texts(raw, "owned_domains", out, { nonEmpty: true, lower: true });
  for (const f of ["portfolio_brands", "amazon_brand_names"]) texts(raw, f, out, { nonEmpty: true });
  for (const f of ["brand_seller_ids", "default_authorized_partners", "product_types"]) texts(raw, f, out);
  oneOf(raw, "column_naming", COLUMN_NAMINGS, out);
  oneOf(raw, "seller_type", SELLER_TYPES, out);
  if ((SELLER_TYPES as readonly string[]).includes(raw.seller_type as string) && !BUILT_SELLER_TYPES.includes(raw.seller_type as SellerType)) {
    out.push(`seller_type ${raw.seller_type as string} is not built yet; the dashboard draws ${BUILT_SELLER_TYPES.join(" and ")}`);
  }
  competitors(raw, out);
  retailers(raw, out);
  dataSources(raw, out);
  analystEstimates(raw, out);
  shortLabels(raw, out);
  if (out.length > 0) throw new ClientSettingsError(source, out);
  return raw as unknown as ClientSettings;
}
