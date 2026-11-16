"use client";

import { IOM_GRAPH_RAIL_PX } from "@/lib/canvas-sdk/column-layout";
import { IOM_MAP_EXIT_BASE_MS, IOM_RAIL_MOTION_BASE_MS, iomMotionMs } from "@/lib/canvas-sdk/iom-motion";
import type { CanvasSpecWithViews } from "@/lib/canvas-sdk/canvas-views";
import type { CanvasShellState } from "@/lib/canvas-sdk/useCanvasShellState";
import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";

const DEFAULT_DRILLDOWN_WIDTH = 620;
const EXPANDED_WIDTH_CAP = 1180;
const EXPANDED_WIDTH_RATIO = 0.68;
/** Never squeeze the graph rail below this. */
const MIN_GRAPH_RAIL = 260;

type Args = {
  spec: CanvasSpecWithViews;
  iom: boolean;
  s: CanvasShellState;
  pan: { current: { isPanning: boolean } };
  frameOverview: () => void;
  frameOverviewInstant: () => void;
  restoreTourLauncher: () => void;
};

/**
 * The IOM column layout (map rail beside the open panel), its open and close motion,
 * the panel width, and Hide panel. Split from CanvasShell without behavior change.
 */
export function useIomColumnLayout({ spec, iom, s, pan, frameOverview, frameOverviewInstant, restoreTourLauncher }: Args) {
  const { viewportRef, columnLayoutRef, panelLayoutBeforeHideRef, activeSpoke, setActiveSpoke, panelLayout, setPanelLayout } = s;
  const { panelView, tourActive, tourSuspended, windowWidth, setOverviewNonce } = s;
  const commandCenter = spec.commandCenter;
  const baseDrilldownWidth = spec.drilldownWidth ?? DEFAULT_DRILLDOWN_WIDTH;

  // Single source of truth for the panel width: CSS and the camera offset both read it.
  const tourOverlayVisibleForLayout = tourActive && !tourSuspended;
  const panelOpenForLayout =
    (panelView === "command" && Boolean(commandCenter)) ||
    Boolean(activeSpoke && spec.spokes[activeSpoke]);
  const columnLayout =
    iom &&
    panelOpenForLayout &&
    panelLayout !== "hidden" &&
    !tourOverlayVisibleForLayout;

  const [iomMapExiting, setIomMapExiting] = useState(false);
  const [iomMapEntering, setIomMapEntering] = useState(false);
  const [iomRailExiting, setIomRailExiting] = useState(false);
  const [iomPanelClosing, setIomPanelClosing] = useState(false);
  const iomColumnPanelRef = useRef(false);
  const iomTransitionLockRef = useRef(false);
  const iomCloseTimersRef = useRef({ rail: 0, map: 0 });

  useEffect(() => {
    return () => {
      window.clearTimeout(iomCloseTimersRef.current.rail);
      window.clearTimeout(iomCloseTimersRef.current.map);
    };
  }, []);

  useEffect(() => {
    if (!iom) return;
    const panelOpened = columnLayout && !iomColumnPanelRef.current;
    iomColumnPanelRef.current = columnLayout;

    if (panelOpened && !iomTransitionLockRef.current) {
      setIomMapExiting(true);
      const timer = window.setTimeout(
        () => setIomMapExiting(false),
        iomMotionMs(IOM_MAP_EXIT_BASE_MS),
      );
      return () => window.clearTimeout(timer);
    }
    if (!columnLayout) {
      setIomMapExiting(false);
    }
  }, [columnLayout, iom]);

  const graphColumnLayout =
    (columnLayout && !iomMapExiting && !iomMapEntering && !iomRailExiting) ||
    iomRailExiting;

  const columnRailInteractive =
    graphColumnLayout && !iomRailExiting && !iomMapEntering && !iomMapExiting;
  columnLayoutRef.current = columnRailInteractive;

  useEffect(() => {
    if (!columnLayout) return;
    pan.current.isPanning = false;
  }, [columnLayout, pan]);

  useEffect(() => {
    if (!columnLayout || iomMapExiting || iomMapEntering || iomRailExiting) return;
    frameOverviewInstant();
  }, [columnLayout, frameOverviewInstant, iomMapEntering, iomMapExiting, iomRailExiting]);

  useEffect(() => {
    if (graphColumnLayout && !columnLayoutWasActiveRef.current && activeSpoke) {
      setColumnScrollKey((key) => key + 1);
    }
    columnLayoutWasActiveRef.current = graphColumnLayout;
  }, [activeSpoke, graphColumnLayout]);

  const [columnScrollFade, setColumnScrollFade] = useState({ top: false, bottom: false });
  const [columnScrollKey, setColumnScrollKey] = useState(0);
  const columnLayoutWasActiveRef = useRef(false);

  const syncColumnScrollFade = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const maxScroll = viewport.scrollHeight - viewport.clientHeight;
    if (maxScroll <= 2) {
      setColumnScrollFade({ top: true, bottom: false });
      return;
    }
    setColumnScrollFade({
      top: true,
      bottom: viewport.scrollTop < maxScroll - 2,
    });
  }, [viewportRef]);

  useEffect(() => {
    if (!graphColumnLayout) {
      setColumnScrollFade({ top: false, bottom: false });
      return;
    }
    const viewport = viewportRef.current;
    if (!viewport) return;

    syncColumnScrollFade();
    viewport.addEventListener("scroll", syncColumnScrollFade, { passive: true });
    const resizeObserver = new ResizeObserver(syncColumnScrollFade);
    resizeObserver.observe(viewport);
    const list = viewport.querySelector(".column-bubble-list");
    if (list) resizeObserver.observe(list);

    return () => {
      viewport.removeEventListener("scroll", syncColumnScrollFade);
      resizeObserver.disconnect();
    };
  }, [graphColumnLayout, syncColumnScrollFade, activeSpoke, viewportRef]);

  /* A hidden panel keeps the width it opens at, so opening only slides it in. Growing
     it from 0 reflowed the tabs into a tall stack that moved under the pointer. The
     column width applies from the first frame of the open, while the panel is still
     off screen, rather than after the map's exit, so the panel never animates width. */
  const shownDrilldownWidth = (() => {
    if (columnLayout && windowWidth > 0) {
      return Math.max(baseDrilldownWidth, windowWidth - IOM_GRAPH_RAIL_PX);
    }
    if (!iom && (panelLayout === "narrow" || windowWidth === 0)) return baseDrilldownWidth;
    if (iom && windowWidth === 0) return baseDrilldownWidth;
    const target =
      spec.drilldownExpandedWidth ??
      Math.round(Math.min(EXPANDED_WIDTH_CAP, windowWidth * EXPANDED_WIDTH_RATIO));
    return Math.max(baseDrilldownWidth, Math.min(target, windowWidth - MIN_GRAPH_RAIL));
  })();
  const drilldownWidth = panelLayout === "hidden" ? 0 : shownDrilldownWidth;

  const hidePanel = useCallback(() => {
    if (panelLayout !== "hidden") {
      panelLayoutBeforeHideRef.current = panelLayout === "wide" ? "wide" : "narrow";
    }

    const animateClose =
      iom &&
      columnLayoutRef.current &&
      !iomTransitionLockRef.current &&
      !iomMapExiting;

    if (!animateClose) {
      window.clearTimeout(iomCloseTimersRef.current.rail);
      window.clearTimeout(iomCloseTimersRef.current.map);
      setIomRailExiting(false);
      setIomMapEntering(false);
      setIomPanelClosing(false);
      iomTransitionLockRef.current = false;
      if (iom) setActiveSpoke(null);
      setPanelLayout("hidden");
      setOverviewNonce((nonce) => nonce + 1);
      frameOverview();
      restoreTourLauncher();
      return;
    }

    iomTransitionLockRef.current = true;
    setIomRailExiting(true);

    iomCloseTimersRef.current.rail = window.setTimeout(() => {
      setIomRailExiting(false);
      setIomPanelClosing(true);
      setIomMapEntering(true);

      iomCloseTimersRef.current.map = window.setTimeout(() => {
        setIomMapEntering(false);
        setIomPanelClosing(false);
        setActiveSpoke(null);
        setPanelLayout("hidden");
        setOverviewNonce((nonce) => nonce + 1);
        frameOverview();
        iomTransitionLockRef.current = false;
        restoreTourLauncher();
      }, iomMotionMs(IOM_MAP_EXIT_BASE_MS));
    }, iomMotionMs(IOM_RAIL_MOTION_BASE_MS));
  }, [
    columnLayoutRef,
    frameOverview,
    iom,
    iomMapExiting,
    panelLayout,
    panelLayoutBeforeHideRef,
    restoreTourLauncher,
    setActiveSpoke,
    setOverviewNonce,
    setPanelLayout,
  ]);

  const columnRailScrollGuardRef = useRef({ tracking: false, moved: false, startY: 0 });

  const onColumnRailPointerDown = useCallback((event: React.PointerEvent) => {
    if (!columnLayoutRef.current) return;
    columnRailScrollGuardRef.current = {
      tracking: true,
      moved: false,
      startY: event.clientY,
    };
  }, [columnLayoutRef]);

  const onColumnRailPointerMove = useCallback((event: React.PointerEvent) => {
    const guard = columnRailScrollGuardRef.current;
    if (!guard.tracking) return;
    if (Math.abs(event.clientY - guard.startY) > 6) guard.moved = true;
  }, []);

  const onColumnRailPointerUp = useCallback(() => {
    columnRailScrollGuardRef.current.tracking = false;
  }, []);

  const onColumnRailBackgroundClick = useCallback(
    (event: ReactMouseEvent) => {
      if (!columnLayoutRef.current) return;
      if (columnRailScrollGuardRef.current.moved) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest(".graph-node")) return;
      if (target.closest(".strategy-roadmap-btn")) return;
      hidePanel();
    },
    [columnLayoutRef, hidePanel],
  );

  return {
    columnLayout,
    graphColumnLayout,
    columnRailInteractive,
    iomMapExiting,
    iomMapEntering,
    iomRailExiting,
    iomPanelClosing,
    columnScrollFade,
    columnScrollKey,
    shownDrilldownWidth,
    drilldownWidth,
    hidePanel,
    onColumnRailPointerDown,
    onColumnRailPointerMove,
    onColumnRailPointerUp,
    onColumnRailBackgroundClick,
  };
}
