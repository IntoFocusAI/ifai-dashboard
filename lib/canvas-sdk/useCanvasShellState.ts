"use client";

import type { NodeTooltipHandle } from "@/lib/canvas-sdk/NodeTooltip";
import type { CanvasSpecWithViews } from "@/lib/canvas-sdk/canvas-views";
import { useEffect, useRef, useState } from "react";

export type PanelLayout = "wide" | "narrow" | "hidden";
export type PanelView = "spoke" | "command";

/**
 * The shell's refs and state in one place, so the shell's hooks can share them.
 * Split from CanvasShell without behavior change.
 */
export function useCanvasShellState(spec: CanvasSpecWithViews, iom: boolean) {
  const commandCenter = spec.commandCenter;
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
  const panelViewRef = useRef<PanelView>("spoke");
  const tourOverlayRef = useRef<HTMLDivElement>(null);
  const tourCardRef = useRef<HTMLDivElement>(null);
  const columnLayoutRef = useRef(false);
  const tooltipRef = useRef<NodeTooltipHandle>(null);

  const [lightTheme, setLightTheme] = useState(!iom);
  const [promptsOpen, setPromptsOpen] = useState(false);
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
  const [panelLayout, setPanelLayout] = useState<PanelLayout>(iom ? "hidden" : "wide");
  const panelLayoutBeforeHideRef = useRef<Exclude<PanelLayout, "hidden">>("wide");
  const [panelView, setPanelView] = useState<PanelView>(
    !iom && commandCenter?.openByDefault ? "command" : "spoke",
  );
  const [windowWidth, setWindowWidth] = useState(0);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [overviewNonce, setOverviewNonce] = useState(0);

  /* These refs exist so the document-level pointer/key listeners can read the
     latest values without being re-registered on every change. They are written
     after commit, which is before any user event can read them. */
  useEffect(() => {
    activeSpokeRef.current = activeSpoke;
    tourStepRef.current = tourStep;
    tourSuspendedRef.current = tourSuspended;
    panelViewRef.current = panelView;
  }, [activeSpoke, panelView, tourStep, tourSuspended]);

  return {
    viewportRef,
    canvasBodyRef,
    headerRef,
    rootRef,
    svgRef,
    drilldownBodyRef,
    tourActiveRef,
    tourSuspendedRef,
    activeSpokeRef,
    tourStepRef,
    panelViewRef,
    tourOverlayRef,
    tourCardRef,
    columnLayoutRef,
    tooltipRef,
    panelLayoutBeforeHideRef,
    lightTheme,
    setLightTheme,
    promptsOpen,
    setPromptsOpen,
    activeSpoke,
    setActiveSpoke,
    activeTab,
    setActiveTab,
    inspectedBubbleId,
    setInspectedBubbleId,
    hubSlotsVisible,
    setHubSlotsVisible,
    tourActive,
    setTourActive,
    tourStep,
    setTourStep,
    tourSuspended,
    setTourSuspended,
    tourProgress,
    setTourProgress,
    panelLayout,
    setPanelLayout,
    panelView,
    setPanelView,
    windowWidth,
    setWindowWidth,
    userMenuOpen,
    setUserMenuOpen,
    profileOpen,
    setProfileOpen,
    overviewNonce,
    setOverviewNonce,
  };
}

export type CanvasShellState = ReturnType<typeof useCanvasShellState>;
