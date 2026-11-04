export type CanvasPanelLayout = "wide" | "narrow" | "hidden";

export type CanvasUrlState = {
  spokeId: string | null;
  tabSlug: string | null;
  priorities: boolean;
  panelLayout: CanvasPanelLayout | null;
  tourStep: number | null;
  tourPaused: boolean;
  menuOpen: boolean;
  profileOpen: boolean;
};

const CANVAS_PARAM_KEYS = [
  "spoke",
  "tab",
  "priorities",
  "layout",
  "tour",
  "tourPaused",
  "menu",
  "profile",
] as const;

const PRESERVED_QUERY_KEYS = ["next", "ai-history"] as const;

/** Row-level drill-down inside an open spoke, e.g. `evidence=sim:1161`. Dropped with the spoke. */
const SPOKE_QUERY_KEYS = ["evidence"] as const;

export function tabSlug(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Slugs already copied from an earlier tab title. They still open that tab. */
const TAB_SLUG_ALIASES: Record<string, string> = {
  "executive-briefing-buy-box-coverage": "briefing",
  "executive-briefing": "briefing",
  "commercial-sizing-680k-pilot-vs-38m-to-62m-enterprise": "opportunity",
  "catalog-readiness-executive-guide": "amazon-specs",
  "ai-readiness": "amazon-specs",
  "machine-readable-schema-org-json-ld-audit": "brand-site-specs",
  "machine-readability": "brand-site-specs",
  "amazon-a-comparison-matrix-blueprint": "amazon-a-matrix",
  "dual-index-scoring-executive-callout": "run-summary",
  "dual-index": "run-summary",
  simulations: "run-details",
  "100-ai-simulations-interactive-explorer": "run-details",
  "ai-spec-hallucination-engine-root-causes": "product-fact-checks",
  hallucination: "product-fact-checks",
  "ai-drift": "product-fact-checks",
  "citation-ecosystem-fender-dtc-opportunity": "citation-ecosystem",
  citation: "citation-ecosystem",
  "head-to-head-category-battlecards": "category-battlecards",
  "head-to-head": "category-battlecards",
  "rival-strategies-countermeasures": "competitor-wins",
  "multi-marketplace-channel-scope-sweetwater-reverb-walmart": "engine-comparison",
  "current-findings": "urgent-interventions",
};

/**
 * Old Division Performance titles embedded a live SKU count in the slug.
 * Any slug that starts with that prefix still opens Performance.
 */
function resolveTabSlugAlias(slug: string): string {
  const lower = slug.toLowerCase();
  if (lower.startsWith("division-performance")) return "performance";
  return (TAB_SLUG_ALIASES[lower] ?? lower).toLowerCase();
}

export function tabIndexFromSlug(tabs: string[], slug: string | null): number {
  if (!slug) return 0;
  const normalized = resolveTabSlugAlias(slug);
  const exact = tabs.findIndex((tab) => tabSlug(tab) === normalized);
  if (exact >= 0) return exact;
  const partial = tabs.findIndex((tab) => tab.toLowerCase().includes(normalized.replace(/-/g, " ")));
  return partial >= 0 ? partial : 0;
}

function isPanelLayout(value: string | null): value is CanvasPanelLayout {
  return value === "wide" || value === "narrow" || value === "hidden";
}

export function parseCanvasSearchParams(
  searchParams: URLSearchParams,
  spokeIds: readonly string[],
): CanvasUrlState {
  const spokeParam = searchParams.get("spoke");
  const spokeId =
    spokeParam && spokeIds.includes(spokeParam) ? spokeParam : null;

  const tourRaw = searchParams.get("tour");
  let tourStep: number | null = null;
  if (tourRaw) {
    const parsed = Number.parseInt(tourRaw, 10);
    if (Number.isFinite(parsed) && parsed >= 1) tourStep = parsed;
  }

  return {
    spokeId,
    tabSlug: searchParams.get("tab"),
    priorities: searchParams.get("priorities") === "1",
    panelLayout: isPanelLayout(searchParams.get("layout")) ? searchParams.get("layout") as CanvasPanelLayout : null,
    tourStep,
    tourPaused: searchParams.get("tourPaused") === "1",
    menuOpen: searchParams.get("menu") === "1",
    profileOpen: searchParams.get("profile") === "1",
  };
}

export function buildCanvasSearchParams(
  state: CanvasUrlState,
  preserve: URLSearchParams,
): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of PRESERVED_QUERY_KEYS) {
    const value = preserve.get(key);
    if (value) params.set(key, value);
  }

  if (state.priorities) params.set("priorities", "1");
  if (state.spokeId) params.set("spoke", state.spokeId);
  if (state.spokeId && state.tabSlug) params.set("tab", state.tabSlug);
  if (state.spokeId) {
    for (const key of SPOKE_QUERY_KEYS) {
      const value = preserve.get(key);
      if (value) params.set(key, value);
    }
  }
  if (state.panelLayout) params.set("layout", state.panelLayout);
  if (state.tourStep !== null) params.set("tour", String(state.tourStep));
  if (state.tourPaused) params.set("tourPaused", "1");
  if (state.menuOpen) params.set("menu", "1");
  if (state.profileOpen) params.set("profile", "1");

  return params;
}

export function canvasUrlQueryEquals(a: URLSearchParams, b: URLSearchParams): boolean {
  const strip = (params: URLSearchParams) => {
    const next = new URLSearchParams(params);
    for (const key of CANVAS_PARAM_KEYS) next.delete(key);
    return next.toString();
  };
  if (strip(a) !== strip(b)) return false;
  const build = (params: URLSearchParams) => {
    const slice = new URLSearchParams();
    for (const key of CANVAS_PARAM_KEYS) {
      const value = params.get(key);
      if (value !== null) slice.set(key, value);
    }
    return slice.toString();
  };
  return build(a) === build(b);
}
