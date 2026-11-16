"use client";

import "@/lib/canvas-sdk/canvas-sdk.css";
import "@/lib/canvas-sdk/iom-theme.css";
import { CanvasDrilldownPanel } from "@/lib/canvas-sdk/CanvasDrilldownPanel";
import { CanvasShellHeader } from "@/lib/canvas-sdk/CanvasShellHeader";
import { HubSlots } from "@/lib/canvas-sdk/HubSlots";
import { MetricWidgets } from "@/lib/canvas-sdk/MetricWidgets";
import { usePanelInteractions } from "@/lib/canvas-sdk/panel-interactions";
import type { CanvasRenderContext } from "@/lib/canvas-sdk/types";
import { MinimalView, useCanvasViewMode, type CanvasSpecWithViews } from "@/lib/canvas-sdk/canvas-views";
import { IOM_GRAPH_RAIL_PX } from "@/lib/canvas-sdk/column-layout";
import { iomMotionMs } from "@/lib/canvas-sdk/iom-motion";
import { IOM_CUSTOM_CURSOR, IomCursor } from "@/lib/canvas-sdk/IomCursor";
import { NodeTooltip } from "@/lib/canvas-sdk/NodeTooltip";
import { CanvasHudZoomControls } from "@/lib/canvas-sdk/CanvasHudZoomControls";
import { TourCard } from "@/lib/canvas-sdk/TourCard";
import { TourLauncher } from "@/lib/canvas-sdk/TourLauncher";
import { useCanvasCamera } from "@/lib/canvas-sdk/useCanvasCamera";
import { useCanvasShellFrame } from "@/lib/canvas-sdk/useCanvasShellFrame";
import { useCanvasShellInputs } from "@/lib/canvas-sdk/useCanvasShellInputs";
import { useCanvasShellNav } from "@/lib/canvas-sdk/useCanvasShellNav";
import { useCanvasShellState } from "@/lib/canvas-sdk/useCanvasShellState";
import { useCanvasShellTooltips } from "@/lib/canvas-sdk/useCanvasShellTooltips";
import { useCanvasShellTour, useOverviewChrome } from "@/lib/canvas-sdk/useCanvasShellTour";
import { useCanvasUrlApply } from "@/lib/canvas-sdk/useCanvasUrlApply";
import { useCanvasUrlSync } from "@/lib/canvas-sdk/useCanvasUrlSync";
import { useIomColumnLayout } from "@/lib/canvas-sdk/useIomColumnLayout";
import { Route } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  type CSSProperties,
  type ReactNode,
} from "react";

type Props = {
  spec: CanvasSpecWithViews;
  children: ReactNode | ((ctx: CanvasRenderContext) => ReactNode);
};

/**
 * The map shell: header, map viewport, side panel, tour, and HUD. The state lives in
 * useCanvasShellState and the behavior in the useCanvasShell* hooks.
 */
export function CanvasShell({ spec, children }: Props) {
  const tourSteps = useMemo(() => spec.tour ?? [], [spec.tour]);
  const commandCenter = spec.commandCenter;
  const views = useCanvasViewMode(spec.minimalView);
  const legend = spec.legend ?? [
    { status: "danger" as const, label: "Critical" },
    { status: "warning" as const, label: "At Risk" },
    { status: "success" as const, label: "On Track" },
  ];

  const iom = spec.appearance === "iom";
  const s = useCanvasShellState(spec, iom);
  const { viewportRef, canvasBodyRef, rootRef, svgRef, drilldownBodyRef, tourOverlayRef, tourCardRef, tooltipRef } = s;
  const { activeSpoke, activeTab, panelView, panelLayout, setPanelLayout, tourActive, tourStep, setTourStep } = s;
  const { tourSuspended, tourProgress, hubSlotsVisible, inspectedBubbleId, overviewNonce } = s;
  // V3 / IOM theme: 1.1s camera transition in iom-theme.css (+ buffer), scaled by IOM_MOTION_SCALE
  const cameraAnimationMs = iom ? iomMotionMs(1200) : undefined;
  const { pan, transform, applyTransform, framePoint, panBy, frameOverview, frameOverviewInstant, zoomBy } =
    useCanvasCamera({
      viewBox: spec.viewBox,
      viewportRef,
      svgRef,
      cameraAnimationMs,
    });
  const roadmapOnGraph = useMemo(
    () => Boolean(spec.nodes?.some((node) => node.spokeId === "roadmap")),
    [spec.nodes],
  );
  const { setPromptsOpen } = s;
  const closePrompts = useCallback(() => setPromptsOpen(false), [setPromptsOpen]);
  const chrome = useOverviewChrome(s, tourSteps.length);
  const { restoreTourLauncher } = chrome;

  useCanvasShellFrame(s);

  const layout = useIomColumnLayout({ spec, iom, s, pan, frameOverview, frameOverviewInstant, restoreTourLauncher });
  const { columnLayout, graphColumnLayout, columnRailInteractive, hidePanel } = layout;

  const nav = useCanvasShellNav({
    spec,
    iom,
    s,
    tourStepCount: tourSteps.length,
    drilldownWidth: layout.drilldownWidth,
    frameOverview,
    framePoint,
    hidePanel,
    restoreTourLauncher,
    beginOverviewChromeExit: chrome.beginOverviewChromeExit,
  });
  const { closeDrilldown, resetCanvasView, focusNode } = nav;

  const tour = useCanvasShellTour({
    spec,
    iom,
    s,
    tourSteps,
    framePoint,
    cameraAnimationMs,
    restoreTourLauncher,
    resetCanvasView,
    focusNode,
  });
  const { closeTour, enterTour, startTour, resumeTour, suspendTour, openCommandCenter } = tour;

  const { showTooltip, hideTooltip, inspectBubble } = useCanvasShellTooltips({
    spec,
    iom,
    s,
    graphColumnLayout,
    pan,
    panBy,
    frameOverview,
    settleMs: iom ? iomMotionMs(1200) : 600,
  });

  useEffect(() => {
    if (drilldownBodyRef.current) drilldownBodyRef.current.scrollTop = 0;
  }, [activeTab, activeSpoke, drilldownBodyRef, panelView]);

  // Wires the authored panel HTML: deep links, filters, stars, collapsible explainers.
  usePanelInteractions({
    bodyRef: drilldownBodyRef,
    onOpen: focusNode,
    storageKey: `${commandCenter?.storageKey ?? "ifai"}:panel`,
    scope: `${activeSpoke ?? "none"}:${activeTab}:${panelView}`,
    glossary: spec.glossary,
  });

  useCanvasShellInputs({ spec, s, pan, applyTransform, closeDrilldown, closeTour, tourStepCount: tourSteps.length });

  const applyCanvasUrl = useCanvasUrlApply({
    spec,
    commandCenter,
    iom,
    focusNode,
    enterTour,
    suspendTour,
    openCommandCenter,
    clearDeepLinkView: nav.clearDeepLinkView,
    setPanelLayout,
    setUserMenuOpen: s.setUserMenuOpen,
    setProfileOpen: s.setProfileOpen,
  });
  const { userMenuOpen, profileOpen, lightTheme, promptsOpen } = s;
  const { tourLauncherDismissed, setTourLauncherDismissed, tourLauncherExiting, onOverviewChromePartExitComplete } = chrome;
  const { iomMapExiting, iomMapEntering, iomRailExiting, iomPanelClosing, columnScrollFade, columnScrollKey } = layout;
  const { drilldownWidth, shownDrilldownWidth } = layout;
  const { onColumnRailBackgroundClick, onColumnRailPointerDown, onColumnRailPointerMove, onColumnRailPointerUp } = layout;
  const { nextTourStep, prevTourStep, openDrilldownFromTour } = tour;


  const spokeIds = useMemo(() => Object.keys(spec.spokes), [spec.spokes]);
  const urlSpoke = activeSpoke ? spec.spokes[activeSpoke] : null;

  useCanvasUrlSync({
    spokeIds,
    enabled: true,
    snapshot: {
      spokeId: activeSpoke,
      activeTab,
      tabLabels: urlSpoke?.tabs ?? [],
      panelView,
      panelLayout,
      tourActive,
      tourStep,
      tourSuspended,
      menuOpen: userMenuOpen,
      profileOpen,
    },
    onApplyFromUrl: applyCanvasUrl,
  });

  const spoke = activeSpoke ? spec.spokes[activeSpoke] : null;
  const currentTour = tourSteps[tourStep];
  const spokeBody = spoke ? spoke.render(activeTab) : null;
  const showThemeToggle = spec.showThemeToggle !== false;
  const showingCommand = panelView === "command" && Boolean(commandCenter);
  const panelOpen = showingCommand || Boolean(spoke);
  const tourOverlayVisible = tourActive && !tourSuspended;
  const canResumeTour = !tourActive && tourProgress !== null && tourProgress > 0;
  const tourLauncherEligible = tourSteps.length > 0 && !tourActive;
  const overviewChromeOpen = !tourLauncherDismissed;
  const tourLauncherOpen = tourLauncherEligible && overviewChromeOpen;
  const tourLauncherLabel = canResumeTour
    ? `Resume tour · ${(tourProgress ?? 0) + 1}/${tourSteps.length}`
    : "Guided tour";

  const openTourFromLauncher = useCallback(() => {
    setTourLauncherDismissed(true);
    if (canResumeTour) resumeTour();
    else startTour();
  }, [canResumeTour, resumeTour, setTourLauncherDismissed, startTour]);

  const ctx: CanvasRenderContext = {
    svgRef,
    viewportRef,
    transform,
    tourActive,
    tourX: currentTour?.targetX ?? 800,
    tourY: currentTour?.targetY ?? 500,
    tourRadius: currentTour?.radius ?? 160,
    tourCategory: currentTour?.category ?? "",
    focusNode,
    inspectBubble,
    heldGroupId: hubSlotsVisible && panelLayout === "hidden" ? inspectedBubbleId : null,
    resetView: resetCanvasView,
    overviewNonce,
    focusedSpokeId: activeSpoke,
    columnScrollKey,
    columnLayout: graphColumnLayout,
    mapExiting: iomMapExiting,
    mapEntering: iomMapEntering,
    columnRailExiting: iomRailExiting,
    showTooltip,
    hideTooltip,
  };

  // `ctx` carries svgRef so the child can attach it to its own <svg>. The rule
  // cannot tell a forwarded ref from a read, and nothing reads .current here.
  // eslint-disable-next-line react-hooks/refs
  const viewport = typeof children === "function" ? children(ctx) : children;
  const legendColor: Record<(typeof legend)[number]["status"], string> = {
    danger: "var(--danger-red)",
    warning: "var(--warning-amber)",
    success: "var(--success-green)",
  };

  return (
    <div
      ref={rootRef}
      className={`ifai-canvas${iom ? " theme-iom" : ""}${lightTheme ? " light-theme" : ""}${graphColumnLayout ? " column-layout" : ""}${iomMapExiting ? " iom-map-exiting" : ""}${iomMapEntering ? " iom-map-entering" : ""}${iomPanelClosing ? " iom-panel-closing" : ""}${panelOpen && panelLayout !== "hidden" && !tourOverlayVisible ? " panel-open" : ""}${(columnLayout || (panelLayout === "wide" && !tourOverlayVisible)) ? " panel-expanded" : ""}${panelLayout === "hidden" && !tourOverlayVisible ? " panel-hidden" : ""}${tourOverlayVisible ? " tour-running" : ""}${views.isMinimal ? " view-minimal" : ""}`}
      style={
        {
          "--drilldown-width": `${drilldownWidth}px`,
          "--drilldown-panel-width": `${shownDrilldownWidth}px`,
          ...(iom ? { "--iom-graph-rail-width": `${IOM_GRAPH_RAIL_PX}px` } : {}),
        } as CSSProperties
      }
    >
      <div className="canvas-layout">
        <div className="canvas-body" ref={canvasBodyRef}>
        <CanvasShellHeader
          spec={spec}
          iom={iom}
          s={s}
          views={views}
          showingCommand={showingCommand}
          showThemeToggle={showThemeToggle}
          focusNode={focusNode}
          resetMainView={nav.resetMainView}
          resetCanvasView={resetCanvasView}
          hidePanel={hidePanel}
          openCommandCenter={openCommandCenter}
        />

        <div
          className="viewport-container"
          id="viewport"
          ref={viewportRef}
          onClick={columnRailInteractive ? onColumnRailBackgroundClick : undefined}
          onPointerDown={columnRailInteractive ? onColumnRailPointerDown : undefined}
          onPointerMove={columnRailInteractive ? onColumnRailPointerMove : undefined}
          onPointerUp={columnRailInteractive ? onColumnRailPointerUp : undefined}
          onPointerCancel={columnRailInteractive ? onColumnRailPointerUp : undefined}
        >
          {iom && spec.spokes.roadmap && !roadmapOnGraph ? (
            <button
              type="button"
              className={`strategy-roadmap-btn${activeSpoke === "roadmap" ? " active" : ""}`}
              onClick={() => focusNode("roadmap")}
            >
              <Route size={16} strokeWidth={1.75} />
              Open Roadmap
            </button>
          ) : null}
          {viewport}
        </div>

        {graphColumnLayout ? (
          <div className="column-scroll-edges" aria-hidden="true">
            <div className={`column-scroll-edge column-scroll-edge-top${columnScrollFade.top ? " visible" : ""}`} />
            <div
              className={`column-scroll-edge column-scroll-edge-bottom${columnScrollFade.bottom ? " visible" : ""}`}
            />
          </div>
        ) : null}

        {spec.hubSlots ? (
          hubSlotsVisible && panelLayout === "hidden" ? (
            <HubSlots feeds={spec.hubSlots} bubbleId={inspectedBubbleId} onOpen={focusNode} />
          ) : null
        ) : spec.metricWidgets ? (
          <MetricWidgets
            config={spec.metricWidgets}
            spokes={spec.spokes}
            onOpenMetric={focusNode}
          />
        ) : null}
        <MinimalView views={views} spokes={spec.spokes} onOpenMetric={focusNode} />

        <TourLauncher
          open={tourLauncherOpen && !views.isMinimal}
          exiting={tourLauncherExiting}
          onExitComplete={onOverviewChromePartExitComplete}
          label={tourLauncherLabel}
          onLaunch={openTourFromLauncher}
        />

        <CanvasHudZoomControls
          open={overviewChromeOpen && !views.isMinimal}
          exiting={tourLauncherExiting}
          onExitComplete={onOverviewChromePartExitComplete}
          onZoomIn={() => zoomBy(1.2)}
          onZoomOut={() => zoomBy(1 / 1.2)}
          onResetView={resetCanvasView}
        />

        {spec.showLegend !== false ? (
          <div className="canvas-hud-legend">
            {legend.map((item) => (
              <div key={item.label} className="legend-item">
                <span className="legend-dot" style={{ borderColor: legendColor[item.status] }} />
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        ) : null}

        <NodeTooltip ref={tooltipRef} />

        <CanvasDrilldownPanel
          spec={spec}
          iom={iom}
          s={s}
          spoke={spoke}
          spokeBody={spokeBody}
          showingCommand={showingCommand}
          panelOpen={panelOpen}
          tourOverlayVisible={tourOverlayVisible}
          tourStepCount={tourSteps.length}
          showPanel={nav.showPanel}
          hidePanel={hidePanel}
          closeDrilldown={closeDrilldown}
          openCommandCenter={openCommandCenter}
          resetCanvasView={resetCanvasView}
          frameOverview={frameOverview}
          focusNode={focusNode}
        />

        <div
          ref={tourOverlayRef}
          className={`tour-overlay-container${tourOverlayVisible ? " active" : ""}`}
        >
          <div className="tour-dimmer-backdrop" onClick={() => closeTour()} />

          <TourCard
            ref={tourCardRef}
            steps={tourSteps}
            stepIndex={tourStep}
            onClose={() => closeTour()}
            onPrev={prevTourStep}
            onNext={nextTourStep}
            onSelectStep={(idx) => setTourStep(idx)}
            onOpenDrilldown={openDrilldownFromTour}
          />
        </div>
        </div>
      </div>
      {promptsOpen && spec.promptsEditor ? spec.promptsEditor(closePrompts) : null}
      {iom && IOM_CUSTOM_CURSOR ? <IomCursor rootRef={rootRef} enabled /> : null}
    </div>
  );
}
