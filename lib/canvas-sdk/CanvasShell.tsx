"use client";

import "@/lib/canvas-sdk/canvas-sdk.css";
import "@/lib/canvas-sdk/iom-theme.css";
import { UserMenuDropdown } from "@/components/auth/UserMenuDropdown";
import { CommandCenter } from "@/lib/canvas-sdk/CommandCenter";
import { HubSlots } from "@/lib/canvas-sdk/HubSlots";
import { MetricWidgets } from "@/lib/canvas-sdk/MetricWidgets";
import { usePanelInteractions } from "@/lib/canvas-sdk/panel-interactions";
import { landPanelFrom } from "@/lib/canvas-sdk/panel-landing";
import type { CanvasRenderContext, TickerIcon } from "@/lib/canvas-sdk/types";
import { MinimalView, ViewModeSwitch, useCanvasViewMode, type CanvasSpecWithViews } from "@/lib/canvas-sdk/canvas-views";
import { SHOW_HEADER_TICKERS } from "@/lib/canvas-sdk/canvas-chrome-flags";
import { IOM_GRAPH_RAIL_PX } from "@/lib/canvas-sdk/column-layout";
import {
  IOM_MAP_EXIT_BASE_MS,
  IOM_RAIL_MOTION_BASE_MS,
  iomMotionMs,
} from "@/lib/canvas-sdk/iom-motion";
import { IOM_CUSTOM_CURSOR, IomCursor } from "@/lib/canvas-sdk/IomCursor";
import { NodeTooltip, type NodeTooltipHandle } from "@/lib/canvas-sdk/NodeTooltip";
import { CanvasHudZoomControls } from "@/lib/canvas-sdk/CanvasHudZoomControls";
import { TourCard } from "@/lib/canvas-sdk/TourCard";
import { TourLauncher } from "@/lib/canvas-sdk/TourLauncher";
import { useTourCard } from "@/lib/canvas-sdk/useTourCard";
import { useDefinitionTooltips } from "@/lib/canvas-sdk/useDefinitionTooltips";
import { useCanvasCamera } from "@/lib/canvas-sdk/useCanvasCamera";
import { useHoverFraming } from "@/lib/canvas-sdk/useHoverFraming";
import { useCanvasUrlApply } from "@/lib/canvas-sdk/useCanvasUrlApply";
import { useCanvasUrlSync } from "@/lib/canvas-sdk/useCanvasUrlSync";
import {
  ChevronLeft,
  Compass,
  ExternalLink,
  Layers,
  ListChecks,
  Maximize2,
  MessageSquareText,
  Minimize2,
  Moon,
  Route,
  Search,
  Sparkles,
  Sun,
  TrendingUp,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";

const DEFAULT_DRILLDOWN_WIDTH = 620;
const DEFAULT_FOCUS_SCALE = 1.55;
const EXPANDED_WIDTH_CAP = 1180;
const EXPANDED_WIDTH_RATIO = 0.68;
/** Never squeeze the graph rail below this. */
const MIN_GRAPH_RAIL = 260;

type PanelLayout = "wide" | "narrow" | "hidden";

type Props = {
  spec: CanvasSpecWithViews;
  children: ReactNode | ((ctx: CanvasRenderContext) => ReactNode);
};

function tickerIcon(kind?: TickerIcon) {
  if (kind === "sparkles") return <Sparkles size={12} />;
  if (kind === "trending") return <TrendingUp size={12} />;
  if (kind === "pulse") return <span className="pulse-dot" />;
  return null;
}

export function CanvasShell({ spec, children }: Props) {
  const baseDrilldownWidth = spec.drilldownWidth ?? DEFAULT_DRILLDOWN_WIDTH;
  const focusScale = spec.focusScale ?? DEFAULT_FOCUS_SCALE;
  const tourSteps = useMemo(() => spec.tour ?? [], [spec.tour]);
  const commandCenter = spec.commandCenter;
  const views = useCanvasViewMode(spec.minimalView);
  const legend = spec.legend ?? [
    { status: "danger" as const, label: "Critical" },
    { status: "warning" as const, label: "At Risk" },
    { status: "success" as const, label: "On Track" },
  ];

  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasBodyRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const drilldownBodyRef = useRef<HTMLDivElement>(null);
  const tourActiveRef = useRef(false);
  const tourSuspendedRef = useRef(false);
  const activeSpokeRef = useRef<string | null>(null);
  const tourStepRef = useRef(0);
  const panelViewRef = useRef<"spoke" | "command">("spoke");
  const tourOverlayRef = useRef<HTMLDivElement>(null);
  const tourCardRef = useRef<HTMLDivElement>(null);
  const columnLayoutRef = useRef(false);

  const iom = spec.appearance === "iom";
  // V3 / IOM theme: 1.1s camera transition in iom-theme.css (+ buffer), scaled by IOM_MOTION_SCALE
  const cameraAnimationMs = iom ? iomMotionMs(1200) : undefined;
  const {
    pan,
    transform,
    applyTransform,
    framePoint,
    panBy,
    frameOverview,
    frameOverviewInstant,
    zoomBy,
  } = useCanvasCamera({
    viewBox: spec.viewBox,
    viewportRef,
    svgRef,
    cameraAnimationMs,
  });
  const roadmapOnGraph = useMemo(
    () => Boolean(spec.nodes?.some((node) => node.spokeId === "roadmap")),
    [spec.nodes],
  );
  const [lightTheme, setLightTheme] = useState(!iom);
  const [promptsOpen, setPromptsOpen] = useState(false);
  const closePrompts = useCallback(() => setPromptsOpen(false), [setPromptsOpen]);
  const tooltipRef = useRef<NodeTooltipHandle>(null);
  const [activeSpoke, setActiveSpoke] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [inspectedBubbleId, setInspectedBubbleId] = useState("hub");
  /** The signal slots show only while a main bubble is hovered or focused. */
  const [hubSlotsVisible, setHubSlotsVisible] = useState(false);
  const [tourActive, setTourActive] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  /** Set when the tour is parked behind an open drilldown rather than ended. */
  const [tourSuspended, setTourSuspended] = useState(false);
  /** Step the user abandoned the tour on, so the launcher can offer a resume. */
  const [tourProgress, setTourProgress] = useState<number | null>(null);
  /** Bottom-left launcher hides after click until the tour closes again. */
  const [tourLauncherDismissed, setTourLauncherDismissed] = useState(false);
  const [tourLauncherExiting, setTourLauncherExiting] = useState(false);
  const overviewChromeExitPartsRef = useRef(0);
  const restoreTourLauncher = useCallback(() => {
    if (!tourActiveRef.current) {
      setTourLauncherExiting(false);
      setTourLauncherDismissed(false);
    }
  }, []);
  const completeOverviewChromeExit = useCallback(() => {
    setTourLauncherExiting(false);
    setTourLauncherDismissed(true);
  }, []);
  const onOverviewChromePartExitComplete = useCallback(() => {
    overviewChromeExitPartsRef.current -= 1;
    if (overviewChromeExitPartsRef.current > 0) return;
    completeOverviewChromeExit();
  }, [completeOverviewChromeExit]);
  const beginOverviewChromeExit = useCallback(() => {
    if (tourLauncherDismissed || tourLauncherExiting) return;
    let parts = 1;
    if (tourSteps.length > 0 && !tourActiveRef.current) parts += 1;
    overviewChromeExitPartsRef.current = parts;
    setTourLauncherExiting(true);
  }, [tourLauncherDismissed, tourLauncherExiting, tourSteps.length]);
  const [panelLayout, setPanelLayout] = useState<PanelLayout>(iom ? "hidden" : "wide");
  const panelLayoutBeforeHide = useRef<Exclude<PanelLayout, "hidden">>("wide");
  const [panelView, setPanelView] = useState<"spoke" | "command">(
    !iom && commandCenter?.openByDefault ? "command" : "spoke",
  );
  const [windowWidth, setWindowWidth] = useState(0);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  /* These refs exist so the document-level pointer/key listeners can read the
     latest values without being re-registered on every change. They are written
     after commit, which is before any user event can read them. */
  useEffect(() => {
    activeSpokeRef.current = activeSpoke;
    tourStepRef.current = tourStep;
    tourSuspendedRef.current = tourSuspended;
    panelViewRef.current = panelView;
  }, [activeSpoke, panelView, tourStep, tourSuspended]);

  useEffect(() => {
    let timer = 0;
    const onResize = () => {
      // Width eases on the expand toggle. A window resize should track the
      // viewport immediately, so the transition is suppressed until it settles.
      rootRef.current?.classList.add("is-resizing");
      setWindowWidth(window.innerWidth);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        rootRef.current?.classList.remove("is-resizing");
      }, 150);
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", onResize);
      rootRef.current?.classList.remove("is-resizing");
    };
  }, []);

  useEffect(() => {
    const header = headerRef.current;
    const root = rootRef.current;
    if (!header || !root) return;

    const syncHeaderHeight = () => {
      root.style.setProperty("--canvas-header-height", `${header.offsetHeight}px`);
    };

    syncHeaderHeight();
    const observer = new ResizeObserver(syncHeaderHeight);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

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
  }, []);

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
  }, [graphColumnLayout, syncColumnScrollFade, activeSpoke]);

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
      panelLayoutBeforeHide.current = panelLayout === "wide" ? "wide" : "narrow";
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
  }, [frameOverview, iom, iomMapExiting, panelLayout, restoreTourLauncher, setPanelLayout]);

  const columnRailScrollGuardRef = useRef({ tracking: false, moved: false, startY: 0 });

  const onColumnRailPointerDown = useCallback((event: React.PointerEvent) => {
    if (!columnLayoutRef.current) return;
    columnRailScrollGuardRef.current = {
      tracking: true,
      moved: false,
      startY: event.clientY,
    };
  }, []);

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
    [hidePanel],
  );

  const showPanel = useCallback(() => {
    setPanelLayout(panelLayoutBeforeHide.current);
  }, [setPanelLayout]);

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
  }, [frameOverview, iom, restoreTourLauncher]);

  const [overviewNonce, setOverviewNonce] = useState(0);
  const resetCanvasView = useCallback(() => {
    if (!iom) {
      setActiveSpoke(null);
      restoreTourLauncher();
    }
    setInspectedBubbleId("hub");
    setHubSlotsVisible(false);
    setOverviewNonce((nonce) => nonce + 1);
    frameOverview();
  }, [frameOverview, iom, restoreTourLauncher]);

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
  }, [closeDrilldown, frameOverview, hidePanel, iom, restoreTourLauncher]);

  const focusNode = useCallback(
    (spokeId: string, subTab?: string, fromBubble?: string) => {
      const spoke = spec.spokes[spokeId];
      if (!spoke) return;
      landPanelFrom(fromBubble ?? null);
      activeSpokeRef.current = spokeId;
      setActiveSpoke(spokeId);
      setPanelView("spoke");
      if (iom && panelLayout === "hidden") {
        setPanelLayout(panelLayoutBeforeHide.current);
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
      tourSteps.length,
    ],
  );

  /** `completed` clears the resume affordance; abandoning keeps the step. */
  const closeTour = useCallback(
    (completed = false) => {
      tourActiveRef.current = false;
      tourSuspendedRef.current = false;
      setTourActive(false);
      setTourSuspended(false);
      setTourProgress(completed ? null : tourStepRef.current);
      restoreTourLauncher();
      resetCanvasView();
    },
    [resetCanvasView, restoreTourLauncher],
  );

  const enterTour = useCallback(
    (stepIdx: number) => {
      if (!tourSteps.length) return;
      const safeStep = Math.min(Math.max(stepIdx, 0), tourSteps.length - 1);
      tourActiveRef.current = true;
      tourSuspendedRef.current = false;
      setTourActive(true);
      setTourSuspended(false);
      setTourStep(safeStep);
      setTourProgress(null);
      tooltipRef.current?.hide();
      if (!iom) setActiveSpoke(null);
    },
    [iom, setTourStep, tourSteps],
  );

  const startTour = useCallback(() => enterTour(0), [enterTour]);
  const resumeTour = useCallback(
    () => enterTour(tourProgress ?? 0),
    [enterTour, tourProgress],
  );

  /** Park the tour behind the drilldown instead of destroying it. */
  const suspendTour = useCallback(() => {
    tourSuspendedRef.current = true;
    setTourSuspended(true);
  }, []);

  const tourTarget = tourSteps[tourStep];
  useTourCard({
    active: tourActive && !tourSuspended,
    stepIndex: tourStep,
    target: tourTarget
      ? { x: tourTarget.targetX, y: tourTarget.targetY, radius: tourTarget.radius }
      : null,
    rootRef,
    overlayRef: tourOverlayRef,
    cardRef: tourCardRef,
    svgRef,
    viewportRef,
    viewBox: spec.viewBox,
    framePoint,
    cameraMs: cameraAnimationMs,
  });

  const showTooltip = useCallback(
    (evt: ReactMouseEvent, title: string, desc: string, hasMoreInfo = true) => {
      if (tourActiveRef.current && !tourSuspendedRef.current) return;
      if (activeSpokeRef.current) return;
      const host = canvasBodyRef.current;
      if (!host) return;
      const hostRect = host.getBoundingClientRect();
      const eventTarget = evt.currentTarget;
      const nodeId =
        eventTarget instanceof Element
          ? (eventTarget.closest("[data-graph-node-id]") ?? eventTarget).getAttribute("data-graph-node-id")
          : null;
      const example = nodeId === "spoke-fixes" || nodeId === "spoke-roadmap";

      if (columnLayoutRef.current) {
        const target = evt.currentTarget;
        if (!(target instanceof Element)) return;
        const node = target.closest(".graph-node") ?? target;
        // The rail hides spoke halos; the soft shadow and the hub's halo reach past their circles.
        const edge = node.querySelector(":scope > .hub-halo-edge, :scope > .node-inner > .node-circle") ?? node;
        const nodeRect = edge.getBoundingClientRect();
        tooltipRef.current?.show(
          { title, desc, hasMoreInfo, example, anchor: "column-right" },
          nodeRect.right - hostRect.left + 14,
          nodeRect.top - hostRect.top + nodeRect.height / 2,
        );
      } else {
        // Nudge toward the pointer; CSS lifts the box by its height + a small gap.
        tooltipRef.current?.show(
          { title, desc, hasMoreInfo, example, anchor: "cursor" },
          evt.clientX - hostRect.left + 10,
          evt.clientY - hostRect.top + 10,
        );
      }
    },
    [],
  );

  const hideTooltip = useCallback(() => {
    tooltipRef.current?.hide();
  }, []);

  useEffect(() => {
    if (activeSpoke || panelView === "command") hideTooltip();
  }, [activeSpoke, hideTooltip, panelView]);

  const frameHoveredBubble = useHoverFraming({
    spec,
    enabled: iom && !activeSpoke && panelView !== "command" && panelLayout === "hidden" && !tourActive && !graphColumnLayout,
    slotsVisible: hubSlotsVisible,
    viewportRef,
    pan,
    panBy,
    frameOverview,
    settleMs: iom ? iomMotionMs(1200) : 600,
  });

  const inspectBubble = useCallback((nodeId: string) => {
    // Hover updates otherwise wait for the next task, a frame after the pointer arrived.
    flushSync(() => {
      setInspectedBubbleId(nodeId);
      setHubSlotsVisible(true);
    });
    frameHoveredBubble(nodeId);
  }, [frameHoveredBubble]);

  // Opening a spoke panel, or returning from one, leaves no bubble hovered or focused.
  useEffect(() => {
    setHubSlotsVisible(false);
  }, [activeSpoke]);

  // A click outside every bubble and the slots themselves closes the slots,
  // the same way a click outside a menu closes the menu.
  useEffect(() => {
    if (!hubSlotsVisible) return;
    function onPointerDown(e: PointerEvent) {
      const target = e.target;
      if (!(target instanceof Element)) return;
      if (target.closest(".graph-node")) return;
      if (target.closest("[data-hub-slots]")) return;
      setHubSlotsVisible(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [hubSlotsVisible]);

  const showDefinitionTooltip = useCallback((target: Element) => {
    if (tourActiveRef.current && !tourSuspendedRef.current) return;
    const title =
      target.getAttribute("data-ifai-tooltip-title")?.trim() ||
      target.textContent?.trim() ||
      "";
    const desc = target.getAttribute("data-ifai-tooltip-desc")?.trim() ?? "";
    if (!desc) return;
    const rect = target.getBoundingClientRect();
    tooltipRef.current?.show(
      { title, desc, hasMoreInfo: false, anchor: "definition" },
      rect.left + rect.width / 2,
      rect.top,
    );
  }, []);

  const definitionTooltipsBlocked = useCallback(
    () => tourActiveRef.current && !tourSuspendedRef.current,
    [],
  );

  useDefinitionTooltips({
    enabled: true,
    isBlocked: definitionTooltipsBlocked,
    onShow: showDefinitionTooltip,
    onHide: hideTooltip,
  });

  useEffect(() => {
    if (drilldownBodyRef.current) drilldownBodyRef.current.scrollTop = 0;
  }, [activeTab, activeSpoke, panelView]);

  // Wires the authored panel HTML: deep links, filters, stars, collapsible explainers.
  usePanelInteractions({
    bodyRef: drilldownBodyRef,
    onOpen: focusNode,
    storageKey: `${commandCenter?.storageKey ?? "ifai"}:panel`,
    scope: `${activeSpoke ?? "none"}:${activeTab}:${panelView}`,
    glossary: spec.glossary,
  });

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const lockScroll = () => {
      root.scrollLeft = 0;
      root.scrollTop = 0;
      const layout = root.querySelector(".canvas-layout");
      if (layout instanceof HTMLElement) {
        layout.scrollLeft = 0;
        layout.scrollTop = 0;
      }
    };
    root.addEventListener("scroll", lockScroll, true);
    return () => root.removeEventListener("scroll", lockScroll, true);
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    function onMouseDown(e: MouseEvent) {
      if (columnLayoutRef.current) return;
      const target = e.target as Element;
      if (
        target.closest(".graph-node") ||
        target.closest(".hud-btn-group") ||
        target.closest(".panel-toggle") ||
        target.closest(".drilldown-hide-btn") ||
        target.closest(".strategy-roadmap-btn")
      ) {
        return;
      }
      if (tourSuspendedRef.current) {
        closeDrilldown();
        return;
      }
      if (activeSpokeRef.current && spec.appearance !== "iom") {
        closeDrilldown();
        return;
      }
      pan.current.isPanning = true;
      pan.current.startX = e.clientX - pan.current.x;
      pan.current.startY = e.clientY - pan.current.y;
    }

    function onMouseMove(e: MouseEvent) {
      if (!pan.current.isPanning) return;
      pan.current.x = e.clientX - pan.current.startX;
      pan.current.y = e.clientY - pan.current.startY;
      applyTransform();
    }

    function onMouseUp() {
      pan.current.isPanning = false;
    }

    function onWheel(e: WheelEvent) {
      if (columnLayoutRef.current) return;
      e.preventDefault();
      const xs = (e.clientX - pan.current.x) / pan.current.scale;
      const ys = (e.clientY - pan.current.y) / pan.current.scale;
      const delta = -e.deltaY;
      pan.current.scale = delta > 0 ? pan.current.scale * 1.08 : pan.current.scale / 1.08;
      pan.current.scale = Math.min(Math.max(0.45, pan.current.scale), 3.0);
      pan.current.x = e.clientX - xs * pan.current.scale;
      pan.current.y = e.clientY - ys * pan.current.scale;
      applyTransform();
    }

    viewport.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    viewport.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      viewport.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      viewport.removeEventListener("wheel", onWheel);
    };
  }, [applyTransform, closeDrilldown, pan, spec.appearance]);

  useEffect(() => {
    // Also runs while a tour is suspended so a click outside resumes it,
    // including in iom where the panel itself never closes.
    if (!tourSuspended && (!activeSpoke || spec.appearance === "iom")) return;

    function onPointerDown(e: PointerEvent) {
      const target = e.target;
      if (!(target instanceof Element)) return;
      if (target.closest(".drilldown-panel")) return;
      if (target.closest(".graph-node")) return;
      if (target.closest(".top-header")) return;
      if (target.closest(".canvas-metric-widgets")) return;
      if (target.closest(".tour-overlay-container")) return;
      closeDrilldown();
    }

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [activeSpoke, closeDrilldown, spec.appearance, tourSuspended]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        // While suspended, Escape backs out of the panel and lands on the tour again.
        if (tourSuspendedRef.current) closeDrilldown();
        else if (tourActiveRef.current) closeTour();
        else closeDrilldown();
      } else if (tourActiveRef.current && !tourSuspendedRef.current) {
        if (e.key === "ArrowRight") {
          if (tourStepRef.current < tourSteps.length - 1) {
            setTourStep(tourStepRef.current + 1);
          } else {
            closeTour(true);
          }
        } else if (e.key === "ArrowLeft") {
          setTourStep((step) => Math.max(step - 1, 0));
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeDrilldown, closeTour, tourSteps.length]);

  function handleFilterChange(value: string) {
    const option = spec.filters?.find((item) => item.value === value);
    const target = option?.target ?? (value === "all" ? "overview" : undefined);
    if (!target || target === "overview") {
      if (iom) hidePanel();
      else resetCanvasView();
    } else focusNode(target);
  }

  function handleSearch(query: string) {
    if (!query.trim()) return;
    const q = query.toLowerCase();
    const match = spec.search?.matchers?.find((item) =>
      item.keywords.some((keyword) => q.includes(keyword.toLowerCase())),
    );
    if (match) focusNode(match.spokeId);
  }

  function nextTourStep() {
    if (tourStep < tourSteps.length - 1) setTourStep(tourStep + 1);
    else closeTour(true);
  }

  function prevTourStep() {
    if (tourStep > 0) setTourStep(tourStep - 1);
  }

  function openDrilldownFromTour() {
    const step = tourSteps[tourStep];
    if (!step || !spec.spokes[step.nodeId]) {
      closeTour();
      return;
    }
    // Suspend rather than close: the step is held so closing the panel returns here.
    suspendTour();
    focusNode(step.nodeId);
  }

  function openCommandCenter() {
    if (!commandCenter) return;
    // Leaving for the queue ends the tour but keeps the step, so the launcher
    // still offers a resume rather than forcing a restart.
    if (tourActiveRef.current) closeTour();
    setPanelView("command");
    setPanelLayout("wide");
  }

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
  }, [closeDrilldown, frameOverview, hidePanel, iom]);

  const applyCanvasUrl = useCanvasUrlApply({
    spec,
    commandCenter,
    iom,
    focusNode,
    enterTour,
    suspendTour,
    openCommandCenter,
    clearDeepLinkView,
    setPanelLayout,
    setUserMenuOpen,
    setProfileOpen,
  });

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
  }, [canResumeTour, resumeTour, startTour]);

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
        <header className="top-header" ref={headerRef}>
          <div className="brand-section">
            <button
              type="button"
              className="brand-home-btn"
              onClick={resetMainView}
              title="Back to map overview"
              aria-label="Back to map overview"
            >
              <img
                src={spec.brand.logoSrc ?? "/icon.png"}
                alt=""
                className="brand-logo-icon"
                aria-hidden
              />
              <div className="brand-title-group">
                <div className="brand-name">
                  {spec.brand.name}
                  {spec.brand.badge ? (
                    <span className="tag-badge tag-version">
                      {spec.brand.badge}
                    </span>
                  ) : null}
                </div>
                {spec.brand.subtitle ? (
                  <div className="brand-sub">{spec.brand.subtitle}</div>
                ) : null}
              </div>
            </button>

            {spec.filters?.length ? (
              <>
                <div className="pill-divider" />
                <div className="filter-selector">
                  <Layers size={13} color="var(--accent-purple)" />
                  <select
                    aria-label="Canvas filter"
                    onChange={(e) => handleFilterChange(e.target.value)}
                  >
                    {spec.filters.map((filter) => (
                      <option key={filter.value} value={filter.value}>
                        {filter.label}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : null}
          </div>

          {SHOW_HEADER_TICKERS && spec.tickers?.length ? (
            <div className="header-ticker">
              {spec.tickers.map((item) => (
                <div
                  key={item.id}
                  className={`ticker-item ticker-badge-${item.tone}`}
                  onClick={() => {
                    if (item.spokeId) focusNode(item.spokeId, item.subTab);
                  }}
                >
                  {tickerIcon(item.icon)}
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          ) : null}

          <div className="header-controls">
            <ViewModeSwitch views={views} />
            {spec.headerSlot}

            {spec.search ? (
              <div className="search-input-wrapper">
                <Search className="search-icon" size={12} />
                <input
                  type="text"
                  className="search-input"
                  placeholder={spec.search.placeholder ?? "Search..."}
                  onInput={(e) => handleSearch(e.currentTarget.value)}
                />
              </div>
            ) : null}

            {spec.promptsEditor ? (
              <button
                className={`hdr-btn${promptsOpen ? " hdr-btn-active" : ""}`}
                onClick={() => setPromptsOpen(true)}
                title="View and edit the AI-Search prompts"
              >
                <MessageSquareText size={12} />
                <span>Prompts</span>
              </button>
            ) : null}

            {commandCenter ? (
              <button
                className={`hdr-btn hdr-btn-priorities${showingCommand ? " hdr-btn-active" : ""}`}
                onClick={openCommandCenter}
                title="What do I need to worry about?"
              >
                <ListChecks size={12} />
                <span>Priorities</span>
                {commandCenter.items.length ? (
                  <span className="hdr-btn-count">{commandCenter.items.length}</span>
                ) : null}
              </button>
            ) : null}

            {spec.headerActions?.map((action) => {
              const className = `hdr-btn${action.variant === "primary" ? " hdr-btn-primary" : ""}`;
              const inner = (
                <>
                  <ExternalLink size={12} />
                  <span>{action.label}</span>
                </>
              );
              if (action.href) {
                return (
                  <a key={action.label} className={className} href={action.href}>
                    {inner}
                  </a>
                );
              }
              return (
                <button key={action.label} className={className} onClick={action.onClick}>
                  {inner}
                </button>
              );
            })}

            {spec.userMenu ?? spec.userEmail ? (
              <UserMenuDropdown
                email={spec.userMenu?.email ?? spec.userEmail!}
                displayName={spec.userMenu?.displayName}
                avatarUrl={spec.userMenu?.avatarUrl}
                organizationName={spec.userMenu?.organizationName}
                roleLabel={spec.userMenu?.roleLabel}
                organizations={spec.userMenu?.organizations}
                activeOrganizationId={spec.userMenu?.activeOrganizationId}
                variant="canvas"
                lightTheme={lightTheme}
                showThemeToggle={showThemeToggle}
                onThemeToggle={() => setLightTheme((value) => !value)}
                menuOpen={userMenuOpen}
                onMenuOpenChange={setUserMenuOpen}
                profileOpen={profileOpen}
                onProfileOpenChange={setProfileOpen}
              />
            ) : showThemeToggle ? (
              <button
                className="hdr-btn"
                onClick={() => setLightTheme((value) => !value)}
                title="Toggle Light / Dark"
              >
                {lightTheme ? <Sun size={13} /> : <Moon size={13} />}
              </button>
            ) : null}
          </div>
        </header>

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

        {panelOpen && panelLayout === "hidden" && !tourOverlayVisible ? (
          <button
            type="button"
            className="drilldown-panel-toggle panel-toggle"
            onClick={showPanel}
            title="Show sidebar"
            aria-label="Show sidebar"
          >
            <ChevronLeft size={18} strokeWidth={2} />
          </button>
        ) : null}

        <aside className={`drilldown-panel${panelOpen && !tourOverlayVisible ? " open" : ""}`}>
          <div className="drilldown-header">
            <div className="drilldown-title-wrap">
              <div className="drilldown-title-main">
                {commandCenter && !showingCommand ? (
                  <button className="drilldown-back-btn" onClick={openCommandCenter}>
                    <ChevronLeft size={12} />
                    Priorities
                  </button>
                ) : null}
                {showingCommand ? (
                  <>
                    <span className="drilldown-badge">{commandCenter?.badge ?? "COMMAND CENTER"}</span>
                    <h2 className="drilldown-title">{commandCenter?.title}</h2>
                  </>
                ) : null}
                {showingCommand ? (
                  commandCenter?.desc?.trim() ? (
                    <p className="drilldown-desc">{commandCenter.desc}</p>
                  ) : null
                ) : spoke?.descSlot ? (
                  <p className="drilldown-desc">{spoke.descSlot}</p>
                ) : spoke?.desc?.trim() ? (
                  <p className="drilldown-desc">{spoke.desc}</p>
                ) : null}
                {!showingCommand && spoke?.headerAccessory ? spoke.headerAccessory : null}
              </div>
            </div>

            <div className="drilldown-header-actions">
              {tourSuspended ? (
                <button
                  className="drilldown-resume-btn"
                  onClick={closeDrilldown}
                  title="Back to the guided tour"
                >
                  <Compass size={13} />
                  Resume tour · {tourStep + 1}/{tourSteps.length}
                </button>
              ) : null}
              {iom ? null : (
                <button
                  className="drilldown-expand-btn"
                  onClick={() =>
                    setPanelLayout((value) => (value === "wide" ? "narrow" : "wide"))
                  }
                  title={panelLayout === "wide" ? "Use narrow sidebar" : "Use wide sidebar"}
                  aria-pressed={panelLayout === "wide"}
                >
                  {panelLayout === "wide" ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>
              )}
              <button
                className="drilldown-hide-btn"
                onClick={hidePanel}
                title={iom ? "Show full map" : "Hide sidebar"}
                aria-label={iom ? "Show full map" : "Hide sidebar"}
              >
                <X size={15} strokeWidth={3} aria-hidden="true" />
                <span>Close panel</span>
              </button>
              {iom ? null : (
                <button
                  className="drilldown-close-btn"
                  onClick={closeDrilldown}
                  title="Close panel"
                >
                  <X size={18} />
                </button>
              )}
            </div>
          </div>

          {showingCommand || !spoke ? null : (
            <>
              <nav className="drilldown-crumb" aria-label="Location">
                <button
                  type="button"
                  onClick={() => {
                    if (commandCenter) openCommandCenter();
                    else resetCanvasView();
                    frameOverview();
                  }}
                >
                  Map
                </button>
                <span aria-hidden="true">›</span>
                <span>{spoke.navLabel ?? spoke.title}</span>
                <span aria-hidden="true">›</span>
                <span className="drilldown-crumb-here">{spoke.tabs[activeTab]}</span>
              </nav>
              <div className="drilldown-tabs" role="tablist">
                {spoke.tabs.map((tabName, idx) => (
                  <button
                    key={tabName}
                    role="tab"
                    aria-selected={idx === activeTab}
                    className={`drilldown-tab-btn${idx === activeTab ? " active" : ""}`}
                    data-new-tab={spoke.newTabs?.includes(tabName) ? "" : undefined}
                    title={spoke.newTabs?.includes(tabName) ? `${tabName} (new)` : undefined}
                    onClick={() => {
                      setActiveTab(idx);
                      if (spoke.tabs[idx] === "Citation Ecosystem") {
                        setPanelLayout((current) => (current === "narrow" ? "wide" : current));
                      }
                    }}
                  >
                    {tabName}
                  </button>
                ))}
              </div>
            </>
          )}

          {showingCommand && commandCenter ? (
            <div ref={drilldownBodyRef} className="drilldown-body">
              <CommandCenter spec={commandCenter} onOpenItem={focusNode} />
            </div>
          ) : typeof spokeBody === "string" ? (
            <div
              ref={drilldownBodyRef}
              className="drilldown-body"
              dangerouslySetInnerHTML={{ __html: spokeBody }}
            />
          ) : (
            <div ref={drilldownBodyRef} className="drilldown-body">
              {spokeBody}
            </div>
          )}

        </aside>

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
