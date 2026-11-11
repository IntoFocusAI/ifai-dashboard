"use client";

import { useEffect, useMemo } from "react";
import { AiHistoryProvider, useAiHistory, useDisplayedAiSearch } from "@/components/v3/live/ai-search/AiHistoryContext";
import { AiSearchProvider, useAiSearchRead } from "@/components/v3/live/ai-search/AiSearchContext";
import { useMapAiSearch } from "@/components/v3/live/ai-search/useApiEngineLoad";
import { FindabilityProvider, useFindabilityRead } from "@/components/v3/live/findability/FindabilityContext";
import { CanvasLoadingShell } from "@/components/v3/live/CanvasLoadingShell";
import { ClientSwitcher } from "@/components/v3/live/ClientSwitcher";
import { DataFreshnessBar } from "@/components/v3/live/DataFreshnessBar";
import { useAmazonFieldTotals, useStockLossRead } from "@/components/v3/live/useMinimalMetricReads";
import { usePortfolioRetailSnapshot } from "@/components/v3/live/usePortfolioRetailSnapshot";
import { useFenderCanvasData } from "@/components/v3/use-fender-canvas-data";
import { aiSpokeDesc } from "@/lib/ai-search/canvas-surfaces";
import { historySpokeDescription } from "@/lib/ai-search/history-mode";
import { authorizedPartnersFromSave } from "@/lib/fender-canvas/authorized-sellers";
import { useAuthorizedSellers } from "@/lib/fender-canvas/authorized-sellers-store";
import { buildFenderCanvasSpec } from "@/lib/fender-canvas/build-canvas-spec";
import { IntelligenceCanvas } from "@/lib/canvas-sdk";
import type { CanvasUserMenu } from "@/lib/canvas-sdk/types";
import type { AiSearchRead } from "@/lib/ai-search/types";
import type { FindabilityRead } from "@/lib/findability/copy";
import type { CanvasBundle } from "@/lib/fender-canvas/types";
import type { RetailCanvasRead } from "@/lib/fender-canvas/portfolio-retail-display";

declare global {
  interface Window {
    toggleResourcingMode?: (mode: "managed" | "copilot") => void;
  }
}

function togglePair(
  activeBtnId: string,
  inactiveBtnId: string,
  showId: string,
  hideId: string,
) {
  const activeBtn = document.getElementById(activeBtnId);
  const inactiveBtn = document.getElementById(inactiveBtnId);
  const show = document.getElementById(showId);
  const hide = document.getElementById(hideId);
  if (!activeBtn || !inactiveBtn || !show || !hide) return;
  activeBtn.classList.add("active");
  inactiveBtn.classList.remove("active");
  show.style.display = "block";
  hide.style.display = "none";
}

function viewerStorageScope(viewerId?: string) {
  if (!viewerId) return "anonymous";
  let hash = 2166136261;
  for (const character of viewerId.trim().toLowerCase()) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function FenderBrandCanvasBody({
  userMenu,
  viewerId,
  bundle,
  loading,
  stale,
  error,
  retail,
  aiSearch,
  findability,
}: {
  userMenu?: CanvasUserMenu;
  viewerId?: string;
  bundle: CanvasBundle | null;
  loading: boolean;
  stale: boolean;
  error: Error | null;
  retail: RetailCanvasRead;
  aiSearch: AiSearchRead;
  findability: FindabilityRead;
}) {
  const history = useAiHistory();
  const displayedAiSearch = useDisplayedAiSearch(aiSearch);
  const mapAiSearch = useMapAiSearch(aiSearch);
  const selectedPhase = history.selected.phase;
  const selectedMessage = "message" in history.selected ? history.selected.message : null;
  const panelDescription = historySpokeDescription({
    mode: history.mode.kind,
    source: history.source,
    selectedPhase,
    selectedMessage,
    runDescription: displayedAiSearch.phase === "ready" ? aiSpokeDesc(displayedAiSearch) : null,
  });
  const [savedSellers] = useAuthorizedSellers();
  const authorizedPartners = authorizedPartnersFromSave(savedSellers);
  const stockLoss = useStockLossRead();
  const amazonFieldTotals = useAmazonFieldTotals(bundle?.m ?? null);
  const spec = useMemo(() => {
    if (!bundle) return null;
    const built = buildFenderCanvasSpec(bundle, {
      userMenu,
      viewerId,
      retail,
      aiSearch: mapAiSearch,
      findability,
      authorizedPartners,
      stockLoss,
      amazonFieldTotals,
      metricStorageSuffix: viewerStorageScope(viewerId),
      headerSlot: (
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <ClientSwitcher />
          <DataFreshnessBar fresh={bundle.fresh} stale={stale} />
        </div>
      ),
    });
    if (!panelDescription || !built.spokes.aeo) return built;
    return {
      ...built,
      spokes: {
        ...built.spokes,
        aeo: { ...built.spokes.aeo, desc: panelDescription },
      },
    };
  }, [amazonFieldTotals, authorizedPartners, bundle, findability, mapAiSearch, panelDescription, retail, stale, stockLoss, userMenu, viewerId]);

  if (loading && !spec) return <CanvasLoadingShell />;
  if (!spec) {
    return (
      <div style={{ padding: 24, color: "var(--danger-red, #ef4444)" }}>
        Could not load live canvas data.{error ? ` ${error.message}` : ""}
      </div>
    );
  }

  return (
    <FindabilityProvider read={findability}>
      <AiSearchProvider read={displayedAiSearch}>
        <IntelligenceCanvas spec={spec} />
      </AiSearchProvider>
    </FindabilityProvider>
  );
}

export function FenderBrandCanvas({
  userMenu,
  viewerId,
}: {
  userMenu?: CanvasUserMenu;
  viewerId?: string;
}) {
  const { bundle, loading, stale, error } = useFenderCanvasData();
  const retail = usePortfolioRetailSnapshot();
  const aiSearch = useAiSearchRead();
  const findability = useFindabilityRead();

  useEffect(() => {
    window.toggleResourcingMode = (mode) => {
      if (mode === "copilot") {
        togglePair(
          "btn-resourcing-copilot",
          "btn-resourcing-managed",
          "resourcing-content-copilot",
          "resourcing-content-managed",
        );
      } else {
        togglePair(
          "btn-resourcing-managed",
          "btn-resourcing-copilot",
          "resourcing-content-managed",
          "resourcing-content-copilot",
        );
      }
    };

    return () => {
      delete window.toggleResourcingMode;
    };
  }, []);

  return (
    <AiHistoryProvider current={aiSearch}>
      <FenderBrandCanvasBody
        userMenu={userMenu}
        viewerId={viewerId}
        bundle={bundle}
        loading={loading}
        stale={stale}
        error={error}
        retail={retail}
        aiSearch={aiSearch}
        findability={findability}
      />
    </AiHistoryProvider>
  );
}
