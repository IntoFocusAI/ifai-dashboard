"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent, type RefObject } from "react";
import { CanvasGraphNode } from "@/lib/canvas-sdk/CanvasGraphNode";
import { ConnLine, TourSpotlight } from "@/lib/canvas-sdk/GraphPrimitives";
import { IomGraphBackdrop } from "@/lib/canvas-sdk/IomGraphBackdrop";
import { buildColumnLayout, isColumnNode } from "@/lib/canvas-sdk/column-layout";
import { iomMotionMs } from "@/lib/canvas-sdk/iom-motion";
import { MAIN_BUBBLES } from "@/lib/canvas-sdk/satellite-clusters";
import { fittedSatelliteClusters } from "@/lib/canvas-sdk/satellite-fit";
import { useColumnRailScroll } from "@/lib/canvas-sdk/useColumnRailScroll";
import type { CanvasEdge, CanvasNode, CanvasSpec } from "@/lib/canvas-sdk/types";

type Props = {
  spec: CanvasSpec;
  svgRef: RefObject<SVGSVGElement | null>;
  viewportRef: RefObject<HTMLDivElement | null>;
  transform: string;
  tourActive: boolean;
  tourX: number;
  tourY: number;
  tourRadius: number;
  tourCategory: string;
  /** `fromBubble` is the clicked bubble's id, so its tab can land on what that bubble leads with. */
  onFocusNode: (spokeId: string, subTab?: string, fromBubble?: string) => void;
  onInspectBubble?: (nodeId: string) => void;
  onResetView: () => void;
  overviewNonce: number;
  focusedSpokeId?: string | null;
  columnScrollKey?: number;
  columnLayout?: boolean;
  mapExiting?: boolean;
  mapEntering?: boolean;
  columnRailExiting?: boolean;
  /** This main bubble's satellites stay out while its signal slots are showing. */
  heldGroupId?: string | null;
  onShowTooltip: (evt: MouseEvent, title: string, desc: string, hasMoreInfo?: boolean) => void;
  onHideTooltip: () => void;
};

export function CanvasGraph({
  spec,
  svgRef,
  viewportRef,
  transform,
  tourActive,
  tourX,
  tourY,
  tourRadius,
  tourCategory,
  onFocusNode,
  onInspectBubble,
  onResetView,
  overviewNonce,
  focusedSpokeId = null,
  columnScrollKey = 0,
  columnLayout = false,
  mapExiting = false,
  mapEntering = false,
  columnRailExiting = false,
  heldGroupId = null,
  onShowTooltip,
  onHideTooltip,
}: Props) {
  const mapViewBox = spec.viewBox ?? { w: 1600, h: 1000 };
  const columnPlan = useMemo(
    () => (columnLayout ? buildColumnLayout(spec.nodes ?? []) : null),
    [columnLayout, spec.nodes],
  );
  const activeViewBox = columnPlan?.viewBox ?? mapViewBox;
  const viewBoxAttr = columnPlan
    ? `${columnPlan.viewBox.x} ${columnPlan.viewBox.y} ${columnPlan.viewBox.w} ${columnPlan.viewBox.h}`
    : `0 0 ${activeViewBox.w} ${activeViewBox.h}`;
  const revealSatellites = spec.appearance === "iom";
  const motionMs = (baseMs: number) => (revealSatellites ? iomMotionMs(baseMs) : baseMs);
  const clusters = useMemo(
    () => (revealSatellites ? fittedSatelliteClusters(spec) : null),
    [revealSatellites, spec],
  );
  const satelliteIds = new Set(
    clusters?.groups.flatMap((group) => group.nodes.map((node) => node.id)) ?? [],
  );
  /* Which satellite cluster is showing. The camera reset bumps `overviewNonce`,
     and stamping that onto the state lets a reset collapse the clusters by
     derivation — no reset effect, and a hide timer that fires afterwards is
     already a no-op because the derived value is null. */
  const [reveal, setReveal] = useState<{
    nonce: number;
    open: string | null;
    pinned: string | null;
  }>({ nonce: overviewNonce, open: null, pinned: null });
  const hideTimer = useRef(0);
  const columnLayoutWasActiveRef = useRef(false);
  const [columnRailEnterKey, setColumnRailEnterKey] = useState(0);

  useEffect(() => {
    if (columnLayout && !columnLayoutWasActiveRef.current) {
      setColumnRailEnterKey((key) => key + 1);
    }
    columnLayoutWasActiveRef.current = columnLayout;
  }, [columnLayout]);

  const current = reveal.nonce === overviewNonce ? reveal : null;
  const openParentId = current?.open ?? null;
  const pinnedParentId = current?.pinned ?? null;

  useEffect(() => () => window.clearTimeout(hideTimer.current), []);

  const revealGroup = (parentId: string) => {
    window.clearTimeout(hideTimer.current);
    setReveal({ nonce: overviewNonce, open: parentId, pinned: pinnedParentId });
  };

  const holdGroup = () => {
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(
      () => setReveal((prev) => ({ ...prev, open: null })),
      motionMs(2000),
    );
  };

  const pinGroup = (parentId: string) => {
    window.clearTimeout(hideTimer.current);
    setReveal({ nonce: overviewNonce, open: parentId, pinned: parentId });
  };

  const emphasis = spec.appearance === "iom";
  const focusedNode = focusedSpokeId
    ? (spec.nodes ?? []).find((node) => node.spokeId === focusedSpokeId && MAIN_BUBBLES.has(node.id)) ??
      null
    : null;

  const touchesFocus = (edge: CanvasEdge) =>
    Boolean(
      focusedNode &&
        ((edge.x1 === focusedNode.x && edge.y1 === focusedNode.y) ||
          (edge.x2 === focusedNode.x && edge.y2 === focusedNode.y)),
    );

  const nodePosition = (node: CanvasNode) => {
    const slot = columnPlan?.positions.get(node.id);
    return slot ?? { x: node.x, y: node.y };
  };

  useColumnRailScroll({
    columnLayout,
    columnPlan,
    columnScrollKey,
    focusedSpokeId,
    revealSatellites,
    nodes: spec.nodes ?? [],
    svgRef,
    viewportRef,
  });

  const renderNode = (node: CanvasNode, parentId?: string, delayMs = 0) => {
    const { x, y } = nodePosition(node);
    const inColumn = Boolean(columnPlan && isColumnNode(node));
    const r = inColumn ? columnPlan!.bubbleR : node.r;
    // The map radius is `node.r`. The rail lays the face out at `faceRadius`
    // (the pre-expansion size) and scales it up to the rail bubble.
    const contentRadius = inColumn ? (node.faceRadius ?? node.r) : undefined;
    return (
      <CanvasGraphNode
        key={node.id}
        node={{ ...node, x, y, r }}
        contentRadius={contentRadius}
        centered={emphasis}
        emphasis={emphasis && (!columnLayout || node.variant === "hub")}
        selected={Boolean(focusedNode && node.id === focusedNode.id)}
        enterDelay={delayMs}
        onFocusNode={onFocusNode}
        onResetView={onResetView}
        onShowTooltip={onShowTooltip}
        onHideTooltip={onHideTooltip}
        onGroupEnter={parentId ? () => revealGroup(parentId) : undefined}
        onGroupLeave={parentId ? holdGroup : undefined}
        onSelect={MAIN_BUBBLES.has(node.id) && node.id !== "hub" ? () => pinGroup(node.id) : undefined}
        onInspect={
          onInspectBubble && MAIN_BUBBLES.has(node.id) ? () => onInspectBubble(node.id) : undefined
        }
      />
    );
  };

  const columnPreserve = columnLayout ? "xMidYMin meet" : "xMidYMid meet";
  const graphSvg = (
    <svg
      key={columnLayout ? "column" : "map"}
      ref={svgRef}
      className={`canvas-svg${columnLayout ? " column-scroll-svg" : ""}`}
      viewBox={viewBoxAttr}
      preserveAspectRatio={columnPreserve}
      style={columnLayout ? undefined : { transform }}
    >
      {spec.appearance === "iom" && !columnLayout
        ? [250, 390, 530].map((radius) => {
            const hub = spec.nodes?.find((node) => node.variant === "hub");
            return (
              <circle
                key={`orbit-${radius}`}
                className="orbit-ring"
                cx={hub?.x ?? 800}
                cy={hub?.y ?? 500}
                r={radius}
              />
            );
          })
        : null}

      <defs>
        <radialGradient id="brandHubGradient" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.25" />
          <stop offset="70%" stopColor="#4f46e5" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
        </radialGradient>
        <filter id="glow-danger" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id="glow-accent" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="7" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id="nodeShadow" x="-60%" y="-60%" width="220%" height="240%">
          <feDropShadow dx="0" dy="8" stdDeviation="10" floodColor="#0b1220" floodOpacity="0.4" />
        </filter>
        <filter id="auraBlur" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="10" />
        </filter>
        <radialGradient id="hubBody" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#28375f" />
          <stop offset="52%" stopColor="#17213d" />
          <stop offset="100%" stopColor="#0d1222" />
        </radialGradient>
        <radialGradient id="spokeBody" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#222d4a" />
          <stop offset="55%" stopColor="#151c31" />
          <stop offset="100%" stopColor="#0e1322" />
        </radialGradient>
        <radialGradient id="luxHubAura" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#00f0ff" stopOpacity="0.55" />
          <stop offset="55%" stopColor="#6366f1" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
        </radialGradient>
      </defs>

      {!columnLayout
        ? (clusters ? clusters.trunk : (spec.edges ?? [])).map((edge, idx) => (
            <ConnLine key={`edge-${idx}`} {...edge} hot={touchesFocus(edge)} />
          ))
        : null}

      {!columnLayout && clusters
        ? clusters.groups.map((group) => (
            <g
              key={`satellites-${group.parent.id}`}
              className={`satellite-group${[openParentId, pinnedParentId, heldGroupId].includes(group.parent.id) ? " visible" : ""}`}
            >
              {group.edges.map((edge, idx) => (
                <ConnLine key={`sat-edge-${group.parent.id}-${idx}`} {...edge} hot={touchesFocus(edge)} />
              ))}
              {group.nodes.map((node, idx) => renderNode(node, group.parent.id, idx * motionMs(80)))}
            </g>
          ))
        : null}

      {(spec.paths ?? []).map((path, idx) => (
        <path
          key={`path-${idx}`}
          className="conn-path"
          d={path.d}
          fill="none"
          stroke={path.stroke ?? "var(--danger-red)"}
          strokeWidth={path.strokeWidth ?? 2.5}
          opacity={path.opacity ?? 0.85}
        />
      ))}

      {(spec.nodes ?? [])
        .filter(
          (node) =>
            node.variant !== "hub" &&
            !satelliteIds.has(node.id) &&
            (!columnLayout || isColumnNode(node)),
        )
        .map((node) =>
          renderNode(
            node,
            clusters?.groups.some((group) => group.parent.id === node.id) ? node.id : undefined,
          ),
        )}

      {(spec.badges ?? []).map((badge, idx) => (
        <g key={`badge-${idx}`} transform={`translate(${badge.x}, ${badge.y})`}>
          <rect
            className="correlation-badge"
            x={-badge.width / 2}
            y={-badge.height / 2}
            width={badge.width}
            height={badge.height}
            rx={badge.height / 2}
            filter="url(#nodeShadow)"
          />
          <text className="correlation-badge-text" x="0" y="4" textAnchor="middle" fontSize="10.5">
            {badge.text}
          </text>
        </g>
      ))}

      {(spec.nodes ?? [])
        .filter((node) => node.variant === "hub")
        .map((node) => renderNode(node))}

      {!columnLayout ? (
        <TourSpotlight
          active={tourActive}
          x={tourX}
          y={tourY}
          radius={tourRadius}
          category={tourCategory}
        />
      ) : null}
    </svg>
  );

  const showMapLayer = !columnLayout || mapExiting || mapEntering;

  return (
    <>
      {showMapLayer ? (
        spec.appearance === "iom" ? (
          <div
            className={`iom-map-layer${mapExiting ? " iom-map-exiting" : ""}${mapEntering ? " iom-map-entering" : ""}`}
          >
            <IomGraphBackdrop spec={spec} />
            {graphSvg}
          </div>
        ) : (
          graphSvg
        )
      ) : null}
      {columnLayout ? (
        <div
          key={columnRailEnterKey}
          className={`column-bubble-list${columnRailExiting ? " iom-column-rail-exiting" : ""}`}
        >
          {graphSvg}
        </div>
      ) : null}
    </>
  );
}
