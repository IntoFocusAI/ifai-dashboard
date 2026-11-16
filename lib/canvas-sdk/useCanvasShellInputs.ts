"use client";

import type { CanvasSpecWithViews } from "@/lib/canvas-sdk/canvas-views";
import type { useCanvasCamera } from "@/lib/canvas-sdk/useCanvasCamera";
import type { CanvasShellState } from "@/lib/canvas-sdk/useCanvasShellState";
import { useEffect } from "react";

type Args = {
  spec: CanvasSpecWithViews;
  s: CanvasShellState;
  pan: ReturnType<typeof useCanvasCamera>["pan"];
  applyTransform: () => void;
  closeDrilldown: () => void;
  closeTour: (completed?: boolean) => void;
  tourStepCount: number;
};

/**
 * Map drag and wheel zoom, click outside the panel, and the Escape and arrow keys.
 * Split from CanvasShell without behavior change.
 */
export function useCanvasShellInputs({ spec, s, pan, applyTransform, closeDrilldown, closeTour, tourStepCount }: Args) {
  const { viewportRef, columnLayoutRef, tourSuspendedRef, activeSpokeRef, tourActiveRef, tourStepRef } = s;
  const { activeSpoke, tourSuspended, setTourStep } = s;

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
  }, [activeSpokeRef, applyTransform, closeDrilldown, columnLayoutRef, pan, spec.appearance, tourSuspendedRef, viewportRef]);

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
          if (tourStepRef.current < tourStepCount - 1) {
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
  }, [closeDrilldown, closeTour, setTourStep, tourActiveRef, tourStepCount, tourStepRef, tourSuspendedRef]);
}
