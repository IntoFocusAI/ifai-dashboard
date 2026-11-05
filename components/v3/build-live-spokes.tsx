import type { ReactNode } from "react";
import { CatalogGovernancePanel } from "@/components/v3/live/CatalogGovernancePanel";
import { AiDriftPanel } from "@/components/v3/live/ai-search/AiDriftPanel";
import { CategoryBattlecardsPanel } from "@/components/v3/live/ai-search/CategoryBattlecardsPanel";
import { CitationEcosystemPanel } from "@/components/v3/live/ai-search/CitationEcosystemPanel";
import { CompetitorWinsPanel } from "@/components/v3/live/ai-search/CompetitorWinsPanel";
import { EngineComparisonPanel } from "@/components/v3/live/ai-search/EngineComparisonPanel";
import { AiSearchSurface } from "@/components/v3/live/ai-search/AiSearchSurface";
import { CompetitorsSpokeDescription } from "@/components/v3/live/ai-search/CompetitorsSpokeDescription";
import { RunHistoryControl } from "@/components/v3/live/ai-search/RunHistoryControl";
import { RunSummaryPanel } from "@/components/v3/live/ai-search/RunSummaryPanel";
import { SimulationsExplorer } from "@/components/v3/live/ai-search/SimulationsExplorer";
import { BriefingRetailHero } from "@/components/v3/live/BriefingRetailHero";
import { ConsensusScoresPanel } from "@/components/v3/live/ConsensusScoresPanel";
import { FenderDivisionsTable } from "@/components/v3/live/FenderDivisionsTable";
import { MapChannelPanel } from "@/components/v3/live/MapChannelPanel";
import { RetailOverview } from "@/components/v3/live/RetailOverview";
import { RoadmapFindingsPanel } from "@/components/v3/live/RoadmapFindingsPanel";
import { StockLossPanel } from "@/components/v3/live/StockLossPanel";
import { SuppressedListingsPanel } from "@/components/v3/live/SuppressedListingsPanel";
import { CatalogReadinessSpec } from "@/components/v3/live/CatalogReadinessSpec";
import { FindabilityPanel } from "@/components/v3/live/findability/FindabilityPanel";
import { AplusMatrixPanel } from "@/components/v3/live/AplusMatrixPanel";
import { MachineReadabilityPanel } from "@/components/v3/live/MachineReadabilityPanel";
import { readFallbackTab } from "@/components/v3/read-fallbacks";
import type { SpokeDefinition, SpokeId } from "@/components/v3/spoke-data-types";
import { spokeData } from "@/components/v3/spoke-data";
import narrative from "@/data/fender-v3-spec.json";
import { aiSpokeDesc, competitorsSpokeDesc } from "@/lib/ai-search/canvas-surfaces";
import type { AiSearchRead } from "@/lib/ai-search/types";
import type { FindabilityRead } from "@/lib/findability/copy";
import type { CanvasBundle } from "@/lib/fender-canvas/types";
import {
  RETAIL_PANEL_TABS,
  STOCK_LOSS_TAB,
  type RetailCanvasRead,
} from "@/lib/fender-canvas/portfolio-retail-display";
import { MUSICIANS_FRIEND_FRESHNESS_JOB } from "@/lib/fender-canvas/map-reading-status";
import { retailTemplateVars } from "@/lib/fender-canvas/retail-copy";
import { bindNarrativeSpoke } from "@/lib/fender-canvas/spoke-narrative";
import { bindCopy, buildTemplateVars } from "@/lib/fender-canvas/template-vars";
import { urgentInterventionsHtml } from "@/lib/fender-canvas/urgent-interventions-html";

function htmlBlock(html: string) {
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

type TabOverride = (
  bundle: CanvasBundle,
  vars: Record<string, string>,
  retail: RetailCanvasRead,
) => ReactNode | null;

const HUB_BRIEFING_HTML = (narrative.spokes as { hub: { tabTemplates: string[] } }).hub
  .tabTemplates[0];

const TAB_OVERRIDES: Partial<
  Record<SpokeId, Partial<Record<number, TabOverride>>>
> = {
  hub: {
    0: (bundle, vars, retail) => (
      <>
        <BriefingRetailHero bundle={bundle} read={retail} />
        {htmlBlock(bindCopy(HUB_BRIEFING_HTML, vars))}
      </>
    ),
    1: (bundle, _vars, retail) => (
      <>
        <ConsensusScoresPanel bundle={bundle} retail={retail} />
        <FenderDivisionsTable divisions={bundle.divisions} />
      </>
    ),
  },
  ecommerce: {
    0: (bundle, _vars, retail) => <RetailOverview read={retail} freshness={bundle.fresh} />,
    1: (bundle, _vars, retail) => (
      <SuppressedListingsPanel read={retail} freshness={bundle.fresh} />
    ),
    2: (bundle, _vars, retail) => (
      <MapChannelPanel
        read={retail}
        musiciansFriendFreshness={
          bundle.fresh.find((row) => row.job_key === MUSICIANS_FRIEND_FRESHNESS_JOB) ?? null
        }
      />
    ),
    3: (_bundle, _vars, retail) => <CatalogGovernancePanel read={retail} />,
    4: () => <StockLossPanel />,
  },
  aeo: {
    0: () => (
      <AiSearchSurface trend>
        <RunSummaryPanel />
      </AiSearchSurface>
    ),
    1: () => (
      <AiSearchSurface>
        <SimulationsExplorer />
      </AiSearchSurface>
    ),
    2: () => (
      <AiSearchSurface>
        <AiDriftPanel />
      </AiSearchSurface>
    ),
    3: () => (
      <AiSearchSurface followsRange>
        <CitationEcosystemPanel />
      </AiSearchSurface>
    ),
  },
  specs: {
    0: () => <FindabilityPanel />,
    1: (bundle) => <CatalogReadinessSpec bundle={bundle} />,
    2: (bundle) => <MachineReadabilityPanel summary={bundle.specPages ?? null} metrics={bundle.m} />,
    3: (bundle) => <AplusMatrixPanel summary={bundle.listingContent ?? null} />,
  },
  competitors: {
    0: () => <CategoryBattlecardsPanel />,
    1: () => <CompetitorWinsPanel />,
    2: () => <EngineComparisonPanel />,
  },
  roadmap: {
    0: (_bundle, _vars, retail) => <RoadmapFindingsPanel read={retail} />,
  },
};

function wrapSpoke(
  id: SpokeId,
  bundle: CanvasBundle,
  vars: Record<string, string>,
  retail: RetailCanvasRead,
  ai: AiSearchRead,
  _findability: FindabilityRead,
): SpokeDefinition {
  const bound = bindNarrativeSpoke(spokeData[id], vars);
  const overrides = TAB_OVERRIDES[id] ?? {};

  return {
    ...bound,
    ...(id === "ecommerce"
      ? {
          title: "Catalog Health",
          desc: "Suppressed Buy Boxes, MAP leakage, unnested bundles, and out-of-stock days, and how those catalog and retail issues change what AI search can recommend.",
          tabs: [...RETAIL_PANEL_TABS],
          newTabs: [STOCK_LOSS_TAB],
        }
      : {}),
    ...(id === "aeo"
      ? {
          desc: aiSpokeDesc(ai),
          headerAccessory: <RunHistoryControl />,
        }
      : {}),
    ...(id === "competitors"
      ? {
          desc: competitorsSpokeDesc(ai),
          descSlot: <CompetitorsSpokeDescription />,
          headerAccessory: <RunHistoryControl />,
        }
      : {}),
    // Findability counts live in the tab body. An empty desc must not leave a gap.
    ...(id === "specs" ? { desc: "" } : {}),
    // Strategy Roadmap first tab opens on the five finding figures; no retail-headline preface.
    ...(id === "roadmap" ? { desc: "" } : {}),
    render: (tabIdx) => {
      const custom =
        readFallbackTab(id, tabIdx, bundle, retail) ?? overrides[tabIdx]?.(bundle, vars, retail);
      if (custom) return custom;
      const content = bound.render(tabIdx);
      if (typeof content === "string") return htmlBlock(content);
      return content;
    },
  };
}

export function buildLiveSpokes(
  bundle: CanvasBundle,
  retail: RetailCanvasRead = { phase: "loading" },
  ai: AiSearchRead = { phase: "loading" },
  findability: FindabilityRead = { phase: "loading" },
): Record<SpokeId, SpokeDefinition> {
  const vars = {
    ...buildTemplateVars(bundle),
    ...retailTemplateVars(bundle, retail),
    urgent_interventions: urgentInterventionsHtml(retail, findability, ai),
  };
  const ids = Object.keys(spokeData) as SpokeId[];
  const out = {} as Record<SpokeId, SpokeDefinition>;
  for (const id of ids) out[id] = wrapSpoke(id, bundle, vars, retail, ai, findability);
  return out;
}
