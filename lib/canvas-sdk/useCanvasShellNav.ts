"use client";

import type { CanvasSpecWithViews } from "@/lib/canvas-sdk/canvas-views";
import { landPanelFrom } from "@/lib/canvas-sdk/panel-landing";
import type { CanvasShellState } from "@/lib/canvas-sdk/useCanvasShellState";
import { useCallback } from "react";

const DEFAULT_FOCUS_SCALE = 1.55;

type Args = {
  spec: CanvasSpecWithViews;
  iom: boolean;
  s: CanvasShellState;
  tourStepCount: number;
  drilldownWidth: number;
  frameOverview: () => void;
  framePoint: (x: number, y: number, scale: number, insetRight?: number) => void;
  hidePanel: () => void;
  restoreTourLauncher: () => void;
  beginOverviewChromeExit: () => void;
};

/**
 * Opening a spoke panel, closing it, and returning to the overview.
 * Split from CanvasShell without behavior change.
 */
export function useCanvasShellNav({
  spec,
  iom,
  s,
  tourStepCount,
  drilldownWidth,
  frameOverview,
  framePoint,
  hidePanel,
  restoreTourLauncher,
  beginOverviewChromeExit,
}: Args) {
  const { tourSuspendedRef, panelViewRef, activeSpokeRef, tourActiveRef, tooltipRef, panelLayoutBeforeHideRef } = s;
  const { setTourSuspended, setPanelView, setActiveSpoke, setInspectedBubbleId, setHubSlotsVisible } = s;
  const { setOverviewNonce, panelLayout, setPanelLayout, setActiveTab } = s;
  const focusScale = spec.focusScale ?? DEFAULT_FOCUS_SCALE;

  const showPanel = useCallback(() => {
    setPanelLayout(panelLayoutBeforeHideRef.current);
  }, [panelLayoutBeforeHideRef, setPanelLayout]);

  const closeDrilldown = useCallback(() => {
    // A suspended tour resumes on close in every appearance, including iom
    // where the panel itself stays pinned open.
    if (tourSuspendedRef.current) {
      setTourSuspended(false);
      return;
    }
    // Leaving the command center falls back to the spoke view (iom keeps a
    // spoke pinned, so the panel stays populated rather than going blank).
    if (panelViewRef.current === "command") {
      setPanelView("spoke");
      if (!activeSpokeRef.current) frameOverview();
      return;
    }
    if (iom) return;
    setActiveSpoke(null);
    if (!tourActiveRef.current) {
      frameOverview();
      restoreTourLauncher();
    }
  }, [activeSpokeRef, frameOverview, iom, panelViewRef, restoreTourLauncher, setActiveSpoke, setPanelView, setTourSuspended, tourActiveRef, tourSuspendedRef]);

  const resetCanvasView = useCallback(() => {
    if (!iom) {
      setActiveSpoke(null);
      restoreTourLauncher();
    }
    setInspectedBubbleId("hub");
    setHubSlotsVisible(false);
    setOverviewNonce((nonce) => nonce + 1);
    frameOverview();
  }, [frameOverview, iom, restoreTourLauncher, setActiveSpoke, setHubSlotsVisible, setInspectedBubbleId, setOverviewNonce]);

  /** Same as the sidebar Close on IOM (hide panel + overview); closes drilldown elsewhere. */
  const resetMainView = useCallback(() => {
    if (tourSuspendedRef.current) {
      setTourSuspended(false);
      return;
    }
    if (panelViewRef.current === "command") {
      setPanelView("spoke");
      if (!activeSpokeRef.current) frameOverview();
    }
    if (iom) hidePanel();
    else closeDrilldown();
    restoreTourLauncher();
  }, [activeSpokeRef, closeDrilldown, frameOverview, hidePanel, iom, panelViewRef, restoreTourLauncher, setPanelView, setTourSuspended, tourSuspendedRef]);

  const focusNode = useCallback(
    (spokeId: string, subTab?: string, fromBubble?: string) => {
      const spoke = spec.spokes[spokeId];
      if (!spoke) return;
      landPanelFrom(fromBubble ?? null);
      activeSpokeRef.current = spokeId;
      setActiveSpoke(spokeId);
      setPanelView("spoke");
      if (iom && panelLayout === "hidden") {
        setPanelLayout(panelLayoutBeforeHideRef.current);
      }
      if (subTab) {
        const found = spoke.tabs.findIndex((tab) =>
          tab.toLowerCase().includes(subTab.toLowerCase()),
        );
        const nextTab = found >= 0 ? found : 0;
        setActiveTab(nextTab);
        if (spoke.tabs[nextTab] === "Citation Ecosystem") {
          setPanelLayout((current) => (current === "narrow" ? "wide" : current));
        }
      } else {
        setActiveTab(0);
      }
      tooltipRef.current?.hide();
      beginOverviewChromeExit();
      if (iom) {
        if (spokeId === "hub") setOverviewNonce((nonce) => nonce + 1);
        return;
      }
      if (spokeId === "hub") {
        setOverviewNonce((nonce) => nonce + 1);
        frameOverview();
        return;
      }
      const key = subTab ? `${spokeId}:${subTab}` : spokeId;
      const pos = spec.focusTargets[key] ?? spec.focusTargets[spokeId];
      if (pos) framePoint(pos.x, pos.y, focusScale, drilldownWidth);
    },
    [
      drilldownWidth,
      focusScale,
      frameOverview,
      framePoint,
      iom,
      panelLayout,
      spec.focusTargets,
      spec.spokes,
      beginOverviewChromeExit,
      restoreTourLauncher,
      tourStepCount,
      activeSpokeRef,
      panelLayoutBeforeHideRef,
      setActiveSpoke,
      setActiveTab,
      setOverviewNonce,
      setPanelLayout,
      setPanelView,
      tooltipRef,
    ],
  );

  const clearDeepLinkView = useCallback(() => {
    if (panelViewRef.current === "command") setPanelView("spoke");
    if (!activeSpokeRef.current) return;
    if (iom) {
      hidePanel();
      setActiveSpoke(null);
      frameOverview();
      return;
    }
    closeDrilldown();
  }, [activeSpokeRef, closeDrilldown, frameOverview, hidePanel, iom, panelViewRef, setActiveSpoke, setPanelView]);

  return { showPanel, closeDrilldown, resetCanvasView, resetMainView, focusNode, clearDeepLinkView };
}
