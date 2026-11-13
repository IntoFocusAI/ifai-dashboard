"use client";

import type { CanvasSpecWithViews } from "@/lib/canvas-sdk/canvas-views";
import type { CanvasShellState } from "@/lib/canvas-sdk/useCanvasShellState";
import { useDefinitionTooltips } from "@/lib/canvas-sdk/useDefinitionTooltips";
import { useHoverFraming } from "@/lib/canvas-sdk/useHoverFraming";
import { useCallback, useEffect, type MouseEvent as ReactMouseEvent } from "react";
import { flushSync } from "react-dom";

type HoverFramingOptions = Parameters<typeof useHoverFraming>[0];

type Args = {
  spec: CanvasSpecWithViews;
  iom: boolean;
  s: CanvasShellState;
  graphColumnLayout: boolean;
  pan: HoverFramingOptions["pan"];
  panBy: HoverFramingOptions["panBy"];
  frameOverview: HoverFramingOptions["frameOverview"];
  settleMs: number;
};

/**
 * Node and definition tooltips, and the hovered main bubble that holds the signal slots.
 * Split from CanvasShell without behavior change.
 */
export function useCanvasShellTooltips({ spec, iom, s, graphColumnLayout, pan, panBy, frameOverview, settleMs }: Args) {
  const { tourActiveRef, tourSuspendedRef, activeSpokeRef, canvasBodyRef, columnLayoutRef, tooltipRef, viewportRef } = s;
  const { activeSpoke, panelView, panelLayout, tourActive, hubSlotsVisible, setHubSlotsVisible, setInspectedBubbleId } = s;

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
    [activeSpokeRef, canvasBodyRef, columnLayoutRef, tooltipRef, tourActiveRef, tourSuspendedRef],
  );

  const hideTooltip = useCallback(() => {
    tooltipRef.current?.hide();
  }, [tooltipRef]);

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
    settleMs,
  });

  const inspectBubble = useCallback((nodeId: string) => {
    // Hover updates otherwise wait for the next task, a frame after the pointer arrived.
    flushSync(() => {
      setInspectedBubbleId(nodeId);
      setHubSlotsVisible(true);
    });
    frameHoveredBubble(nodeId);
  }, [frameHoveredBubble, setHubSlotsVisible, setInspectedBubbleId]);

  // Opening a spoke panel, or returning from one, leaves no bubble hovered or focused.
  useEffect(() => {
    setHubSlotsVisible(false);
  }, [activeSpoke, setHubSlotsVisible]);

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
  }, [hubSlotsVisible, setHubSlotsVisible]);

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
      { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom },
    );
  }, [tooltipRef, tourActiveRef, tourSuspendedRef]);

  const definitionTooltipsBlocked = useCallback(
    () => tourActiveRef.current && !tourSuspendedRef.current,
    [tourActiveRef, tourSuspendedRef],
  );

  useDefinitionTooltips({
    enabled: true,
    isBlocked: definitionTooltipsBlocked,
    onShow: showDefinitionTooltip,
    onHide: hideTooltip,
  });

  return { showTooltip, hideTooltip, inspectBubble };
}
