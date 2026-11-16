"use client";

import type { CanvasSpecWithViews } from "@/lib/canvas-sdk/canvas-views";
import type { CanvasShellState } from "@/lib/canvas-sdk/useCanvasShellState";
import type { TourStep } from "@/lib/canvas-sdk/types";
import { useTourCard } from "@/lib/canvas-sdk/useTourCard";
import { useCallback, useRef, useState } from "react";

/**
 * The overview chrome (tour launcher and zoom controls): it leaves when a panel opens
 * and returns on the overview. Split from CanvasShell without behavior change.
 */
export function useOverviewChrome(s: Pick<CanvasShellState, "tourActiveRef">, tourStepCount: number) {
  const { tourActiveRef } = s;
  /** Bottom-left launcher hides after click until the tour closes again. */
  const [tourLauncherDismissed, setTourLauncherDismissed] = useState(false);
  const [tourLauncherExiting, setTourLauncherExiting] = useState(false);
  const overviewChromeExitPartsRef = useRef(0);
  const restoreTourLauncher = useCallback(() => {
    if (!tourActiveRef.current) {
      setTourLauncherExiting(false);
      setTourLauncherDismissed(false);
    }
  }, [tourActiveRef]);
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
    if (tourStepCount > 0 && !tourActiveRef.current) parts += 1;
    overviewChromeExitPartsRef.current = parts;
    setTourLauncherExiting(true);
  }, [tourActiveRef, tourLauncherDismissed, tourLauncherExiting, tourStepCount]);

  return {
    tourLauncherDismissed,
    setTourLauncherDismissed,
    tourLauncherExiting,
    restoreTourLauncher,
    onOverviewChromePartExitComplete,
    beginOverviewChromeExit,
  };
}

type TourArgs = {
  spec: CanvasSpecWithViews;
  iom: boolean;
  s: CanvasShellState;
  tourSteps: TourStep[];
  framePoint: Parameters<typeof useTourCard>[0]["framePoint"];
  cameraAnimationMs: number | undefined;
  restoreTourLauncher: () => void;
  resetCanvasView: () => void;
  focusNode: (spokeId: string, subTab?: string, fromBubble?: string) => void;
};

/** Guided tour: enter, close, suspend behind a panel, and step. Split from CanvasShell without behavior change. */
export function useCanvasShellTour({
  spec,
  iom,
  s,
  tourSteps,
  framePoint,
  cameraAnimationMs,
  restoreTourLauncher,
  resetCanvasView,
  focusNode,
}: TourArgs) {
  const { tourActiveRef, tourSuspendedRef, tourStepRef, tooltipRef, setActiveSpoke } = s;
  const { tourActive, setTourActive, tourStep, setTourStep, tourSuspended, setTourSuspended } = s;
  const { tourProgress, setTourProgress, setPanelView, setPanelLayout } = s;
  const commandCenter = spec.commandCenter;

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
    [resetCanvasView, restoreTourLauncher, setTourActive, setTourProgress, setTourSuspended, tourActiveRef, tourStepRef, tourSuspendedRef],
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
    [iom, setActiveSpoke, setTourActive, setTourProgress, setTourStep, setTourSuspended, tooltipRef, tourActiveRef, tourSteps, tourSuspendedRef],
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
  }, [setTourSuspended, tourSuspendedRef]);

  const tourTarget = tourSteps[tourStep];
  useTourCard({
    active: tourActive && !tourSuspended,
    stepIndex: tourStep,
    target: tourTarget
      ? { x: tourTarget.targetX, y: tourTarget.targetY, radius: tourTarget.radius }
      : null,
    rootRef: s.rootRef,
    overlayRef: s.tourOverlayRef,
    cardRef: s.tourCardRef,
    svgRef: s.svgRef,
    viewportRef: s.viewportRef,
    viewBox: spec.viewBox,
    framePoint,
    cameraMs: cameraAnimationMs,
  });

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

  return {
    closeTour,
    enterTour,
    startTour,
    resumeTour,
    suspendTour,
    nextTourStep,
    prevTourStep,
    openDrilldownFromTour,
    openCommandCenter,
  };
}
