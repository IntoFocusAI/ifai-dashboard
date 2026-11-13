"use client";

import { memo, type MouseEvent } from "react";
import { GraphBubble, GraphHub } from "@/lib/canvas-sdk/GraphPrimitives";
import { MAIN_BUBBLES } from "@/lib/canvas-sdk/satellite-clusters";
import type { CanvasNode } from "@/lib/canvas-sdk/types";

/**
 * One map bubble. Memoised, and every callback takes an id, so a hover that changes which
 * bubble is inspected re-renders the map's groups but none of the bubbles themselves.
 */
export const CanvasGraphNode = memo(function CanvasGraphNode({
  node,
  x,
  y,
  r,
  centered,
  onFocusNode,
  onResetView,
  onShowTooltip,
  onHideTooltip,
  groupId,
  onGroupEnter,
  onGroupLeave,
  onSelect,
  onInspect,
  emphasis,
  selected,
  dimmed,
  enterDelay,
  contentRadius,
}: {
  node: CanvasNode;
  /** Where the bubble is drawn: the map position, or its slot in the column rail. */
  x: number;
  y: number;
  r: number;
  contentRadius?: number;
  centered: boolean;
  onFocusNode: (spokeId: string, subTab?: string, fromBubble?: string) => void;
  onResetView: () => void;
  onShowTooltip: (evt: MouseEvent, title: string, desc: string, hasMoreInfo?: boolean) => void;
  onHideTooltip: () => void;
  /** The main bubble whose satellite group this bubble reveals on hover. */
  groupId?: string;
  onGroupEnter?: (groupId: string) => void;
  onGroupLeave?: () => void;
  onSelect?: (nodeId: string) => void;
  onInspect?: (nodeId: string) => void;
  emphasis?: boolean;
  selected?: boolean;
  dimmed?: boolean;
  enterDelay?: number;
}) {
  const Node = node.variant === "hub" ? GraphHub : GraphBubble;
  const titleSize =
    contentRadius != null && node.railTitleSize != null ? node.railTitleSize : node.titleSize;
  // Satellites lead with one hero figure; hover adds an explanation only for a figure
  // marked partial or Not available*, whose tooltip says what is missing. Main bubbles
  // never show a hover tooltip (decision 87); their tab carries the explanation.
  const partialFace = Boolean(node.heroValue?.value.trim().endsWith("*"));
  const showHoverTooltip = !MAIN_BUBBLES.has(node.id) && partialFace && Boolean(node.tooltip.desc.trim());
  const inspect = onInspect ? () => onInspect(node.id) : undefined;
  return (
    <Node
      id={node.id}
      x={x}
      y={y}
      r={r}
      contentRadius={contentRadius}
      status={node.status}
      title={node.title}
      titleSize={titleSize}
      stats={node.stats}
      meta={node.id === "spoke-retail" || node.id === "spoke-roadmap" ? node.meta : undefined}
      heroValue={node.heroValue}
      centered={centered}
      logoSrc={node.logoSrc}
      emphasis={emphasis}
      selected={selected}
      dimmed={dimmed}
      enterDelay={enterDelay}
      onInspect={inspect}
      onClick={() => {
        onSelect?.(node.id);
        inspect?.();
        // The center node is the portfolio overview. A click always reopens it,
        // including when the camera is already framed on the hub.
        if (node.spokeId) onFocusNode(node.spokeId, node.subTab, node.id);
        else onResetView();
        onHideTooltip();
      }}
      onMouseEnter={(evt) => {
        inspect?.();
        if (groupId) onGroupEnter?.(groupId);
        // A bubble with no stored explainer (title is self-sufficient) shows no hover box at all.
        if (!showHoverTooltip) {
          onHideTooltip();
          return;
        }
        onShowTooltip(
          evt,
          node.tooltip.title,
          node.tooltip.desc,
          node.tooltip.hasMoreInfo ?? Boolean(node.spokeId),
        );
      }}
      onMouseMove={(evt) => {
        if (!showHoverTooltip) return;
        onShowTooltip(
          evt,
          node.tooltip.title,
          node.tooltip.desc,
          node.tooltip.hasMoreInfo ?? Boolean(node.spokeId),
        );
      }}
      onMouseLeave={() => {
        onGroupLeave?.();
        onHideTooltip();
      }}
    />
  );
});
