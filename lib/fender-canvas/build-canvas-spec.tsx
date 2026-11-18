import { clientStorageKey } from "@/lib/client/active-client";
import { DASHBOARD_PATH } from "@/lib/auth/dashboard-path";
import { activeSetAsideClientKey } from "@/lib/set-aside/keys";
import type { ReactNode } from "react";
import { buildLiveSpokes } from "@/components/v3/build-live-spokes";
import { fenderCommandCenter } from "@/components/v3/command-center-data";
import { fenderGlossary } from "@/components/v3/glossary";
import { FENDER_METRICS } from "@/components/v3/fender-metrics";
import { fenderStaticNodes } from "@/components/v3/fender-static-nodes";
import { PromptsEditor } from "@/components/v3/prompts/PromptsEditor";
import { spokeData } from "@/components/v3/spoke-data";
import staticTourSteps from "@/data/canvas-tour.json";
import graphLayout from "@/data/fender-v3-spokes.json";
import type { TourStep } from "@/lib/canvas-sdk/types";
import type { CanvasUserMenu } from "@/lib/canvas-sdk/types";
import { defineCanvas } from "@/lib/canvas-sdk/types";
import type { CanvasSpecWithViews } from "@/lib/canvas-sdk/minimal-view-types";
import { aiMetrics } from "@/lib/ai-search/canvas-surfaces";
import type { AiSearchRead } from "@/lib/ai-search/types";
import type { FindabilityRead } from "@/lib/findability/copy";
import { buildLiveCommandCenter } from "@/lib/fender-canvas/command-center-from-live";
import { specPageCounts } from "@/lib/fender-canvas/machine-readability";
import { buildHubSlots } from "@/lib/fender-canvas/hub-slots";
import { headlineSentence, headlineSurface } from "@/lib/fender-canvas/portfolio-retail-display";
import { buildLiveMetrics } from "@/lib/fender-canvas/metrics-from-live";
import { withAiEstimates } from "@/lib/estimates/ai-gap-read";
import type { AmazonFieldTotals } from "@/lib/fender-canvas/ai-readiness-lead";
import { buildMinimalMetrics, type StockLossRead } from "@/lib/fender-canvas/minimal-metrics";
import { buildLiveNodes } from "@/lib/fender-canvas/nodes-from-live";
import type { RetailCanvasRead } from "@/lib/fender-canvas/portfolio-retail-display";
import { fenderCanvasEdges, frameTourStep, withPrimaryFocusTargets } from "@/lib/fender-canvas/primary-spoke-layout";
import { buildLiveTourSteps } from "@/lib/fender-canvas/tour-from-live";
import { enterprisePotentialEstimate, phaseOneLiftEstimate } from "@/lib/fender-canvas/analyst-estimates";
import { bindBrandTokens } from "@/lib/fender-canvas/spoke-narrative";
import { bindCopy } from "@/lib/fender-canvas/template-vars";
import type { CanvasBundle } from "@/lib/fender-canvas/types";

/** Documentation version shown beside the product name in the canvas header. */
export const DOCUMENTATION_VERSION = "29.16";

const FOCUS_TARGETS = withPrimaryFocusTargets(
  graphLayout.focusTargets as Record<string, { x: number; y: number }>,
);
/** The brand-free fallback tour, filled from the client's settings; estimates read Loading until the bundle arrives. */
function staticTour(): TourStep[] {
  const vars = { phase_one_lift: phaseOneLiftEstimate(null), enterprise_potential: enterprisePotentialEstimate(null) };
  const fill = (value: unknown): unknown => {
    if (typeof value === "string") return bindCopy(bindBrandTokens(value), vars);
    if (Array.isArray(value)) return value.map(fill);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fill(v)]));
    return value;
  };
  return (staticTourSteps as TourStep[]).map((step) => frameTourStep(fill(step) as TourStep));
}

export type BuildCanvasSpecOptions = {
  userMenu?: CanvasUserMenu;
  viewerId?: string;
  headerSlot?: ReactNode;
  metricStorageSuffix?: string;
  retail?: RetailCanvasRead;
  aiSearch?: AiSearchRead;
  findability?: FindabilityRead;
  authorizedPartners?: readonly string[] | null;
  stockLoss?: StockLossRead;
  amazonFieldTotals?: AmazonFieldTotals | null;
};

/** Static fallback when Supabase is unavailable on first paint. */
export function buildStaticFenderCanvasSpec(options: BuildCanvasSpecOptions = {}) {
  return buildFenderCanvasSpec(null, options);
}

/** Minimal view keys are new, so a first visit opens on Balanced with six empty slots. */
function minimalViewKeys(scope: string) {
  return {
    viewStorageKey: `ifai:fender:canvas-view:v1:${scope}`,
    smallStorageKey: `ifai:fender:minimal-small:v1:${scope}`,
    largeStorageKey: `ifai:fender:minimal-large:v1:${scope}`,
  };
}

export function buildFenderCanvasSpec(
  readBundle: CanvasBundle | null,
  options: BuildCanvasSpecOptions = {},
): CanvasSpecWithViews {
  const retail = options.retail ?? { phase: "loading" as const };
  const aiSearch = options.aiSearch ?? { phase: "loading" as const };
  // Lines 8 and 9 and Enterprise Potential's AI part follow the date-pill window's AI read.
  const bundle = readBundle?.estimates ? { ...readBundle, estimates: withAiEstimates(readBundle.estimates, aiSearch) } : readBundle;
  const findability = options.findability ?? { phase: "loading" as const };
  const live = bundle ? buildLiveMetrics(bundle, retail, findability, aiSearch) : null;
  const metrics = live ? (Object.assign({}, live, aiMetrics(aiSearch)) as typeof live) : FENDER_METRICS;

  const ai = metrics.overallAiWinRate;
  const headline = headlineSurface(retail);
  const commandCenter = bundle ? buildLiveCommandCenter(bundle, retail, aiSearch) : {
        ...fenderCommandCenter,
        // The offline fallback reads the set-asides and owner chips of the brand on screen.
        storageKey: clientStorageKey(fenderCommandCenter.storageKey ?? "ifai:fender:command-center"),
        setAsideClientKey: activeSetAsideClientKey(),
      };
  const nodes = bundle ? buildLiveNodes(bundle, metrics, retail, aiSearch, findability) : fenderStaticNodes;
  const minimalView = bundle
    ? {
        metrics: buildMinimalMetrics(nodes, {
          bundle,
          retail,
          ai: aiSearch,
          findability,
          authorizedPartners: options.authorizedPartners ?? null,
          stockLoss: options.stockLoss ?? { phase: "loading" },
          amazonFieldTotals: options.amazonFieldTotals ?? null,
          phaseOne: metrics.phaseOneLift,
          enterprise: metrics.enterprisePotential,
        }),
        ...minimalViewKeys(options.metricStorageSuffix ?? "anonymous"),
      }
    : undefined;

  const spec = defineCanvas({
    appearance: "iom",
    commandCenter,
    // Every client has the same view-only Prompts list. Build prompts shows for IntoFocus staff only
    // (decision 99): the header checks staff before it shows the button, and the page checks again.
    promptsEditor: (close) => <PromptsEditor onClose={close} />,
    promptBuilderHref: `${DASHBOARD_PATH}/battery-builder`,
    glossary: fenderGlossary,
    hubSlots: buildHubSlots({
      suppressed: retail.phase === "ready" ? retail.snapshot.suppressedListings : retail.phase,
      ai: aiSearch,
      findability,
      missingSpecPages: specPageCounts(bundle?.specPages)?.missingSpecBlock ?? null,
      phaseOneValue: metrics.phaseOneLift.value,
      phaseOneDetail: metrics.phaseOneLift.detail,
      commandItems: commandCenter.items,
    }),
    brand: {
      name: "IntoFocus AI Consensus Control",
      subtitle: "",
      logoSrc: "/icon.png",
      badge: DOCUMENTATION_VERSION,
    },
    headerSlot: options.headerSlot,
    tickers: [
      {
        id: "buybox",
        tone: "danger",
        icon: "pulse",
        spokeId: "ecommerce",
        subTab: headline.tab,
        label: headlineSentence(headline),
      },
      {
        id: "aeo",
        tone: "warning",
        icon: "sparkles",
        spokeId: "aeo",
        subTab: "run summary",
        label: (
          <>
            AI Win Rate: <strong>{ai.value}</strong> · {ai.detail}
          </>
        ),
      },
      {
        id: "opportunity",
        tone: "success",
        icon: "trending",
        spokeId: "suggestions",
        subTab: "Revenue Estimates",
        label: (
          <>
            Lift: <strong>{metrics.phaseOneLift.value} Phase 1</strong> (
            {metrics.enterprisePotential.value} Enterprise)
          </>
        ),
      },
    ],
    showLegend: false,
    legend: [
      { status: "danger", label: "Critical / Buy Box Suppression" },
      { status: "warning", label: "At Risk / Review Splintering" },
      { status: "success", label: "On Track / Lift Target" },
    ],
    badges: [],
    edges: fenderCanvasEdges(),
    nodes,
    spokes: bundle ? buildLiveSpokes(bundle, retail, aiSearch, findability) : spokeData,
    focusTargets: FOCUS_TARGETS,
    tour: bundle ? buildLiveTourSteps(bundle, retail, aiSearch, findability) : staticTour(),
    ...(options.userMenu
      ? { userMenu: options.userMenu, userEmail: options.userMenu.email }
      : {}),
  });
  return minimalView ? { ...spec, minimalView } : spec;
}
