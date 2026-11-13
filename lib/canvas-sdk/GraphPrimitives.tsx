"use client";

import { type KeyboardEvent, type MouseEvent } from "react";
import { bubbleTextMin, heroStatus } from "@/lib/canvas-sdk/hero-fit";
import { CenteredFace, PRIMARY_SPOKES, SPOKE_ICONS } from "@/lib/canvas-sdk/CenteredFace";
import { CenteredStack, CurvedHeader, HeroValue } from "@/lib/canvas-sdk/GraphFaceParts";
import { IOM_STAT_PILL_FONT } from "@/lib/canvas-sdk/graph-text";
import type { CanvasEdge, NodeStatus } from "@/lib/canvas-sdk/types";

export { CenteredStack, CurvedHeader } from "@/lib/canvas-sdk/GraphFaceParts";

type BubbleProps = {
  id: string;
  x: number;
  y: number;
  r: number;
  /** When set, face/icon layout uses this radius and scales up to `r` (column rail). */
  contentRadius?: number;
  status: NodeStatus;
  title: string;
  titleSize?: number;
  stats: string[];
  meta?: string;
  heroValue?: { value: string; label: string; explainer?: boolean };
  centered?: boolean;
  logoSrc?: string;
  emphasis?: boolean;
  selected?: boolean;
  dimmed?: boolean;
  enterDelay?: number;
  onClick: () => void;
  onMouseEnter: (evt: MouseEvent) => void;
  onMouseMove?: (evt: MouseEvent) => void;
  onMouseLeave: () => void;
  onInspect?: () => void;
};

function inspectProps(label: string, onInspect: (() => void) | undefined, onActivate: () => void) {
  if (!onInspect) return {};
  return {
    tabIndex: 0,
    role: "button" as const,
    "aria-label": label || "Bubble",
    onFocus: onInspect,
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      onActivate();
    },
  };
}

export function GraphBubble({
  id,
  x,
  y,
  r,
  contentRadius,
  status,
  title,
  titleSize,
  stats,
  meta,
  heroValue,
  centered = false,
  emphasis = false,
  selected = false,
  dimmed = false,
  enterDelay = 0,
  onClick,
  onMouseEnter,
  onMouseMove,
  onMouseLeave,
  onInspect,
}: BubbleProps) {
  const faceR = contentRadius ?? r;
  const faceScale = faceR > 0 && r !== faceR ? r / faceR : 1;
  const headerSize = titleSize ?? (faceR >= 70 ? 14.5 : faceR >= 50 ? 13 : 12);
  const statPillFont = (PRIMARY_SPOKES.has(id) ? 13.5 : IOM_STAT_PILL_FONT) / faceScale;
  /* The ring takes the status color when the hero figure does. */
  const ringStatus = heroValue ? heroStatus(status, heroValue.value) : null;
  const statusClass = ringStatus ? ` status-${status}` : "";
  const stateClass = `${selected ? " node-selected" : ""}${dimmed ? " node-dimmed" : ""}`;

  const face = centered ? (
    <CenteredFace
      title={title}
      stats={stats}
      meta={meta}
      status={status}
      icon={SPOKE_ICONS[id]}
      radius={faceR}
      prominent={PRIMARY_SPOKES.has(id)}
      plate={centered && Boolean(SPOKE_ICONS[id])}
      titleSize={titleSize}
      statPillSize={statPillFont}
      heroValue={heroValue}
      minText={bubbleTextMin(faceScale)}
    />
  ) : (
    <>
      <CurvedHeader id={id} radius={faceR} title={title} fontSize={headerSize} />
      <CenteredStack radius={faceR} stats={stats} meta={meta} pillSize={statPillFont} status={status} />
    </>
  );

  return (
    <g
      className={`graph-node${PRIMARY_SPOKES.has(id) ? " spoke-primary" : ""}${stateClass}`}
      data-graph-node-id={id}
      transform={`translate(${x}, ${y})`}
      style={enterDelay ? { transitionDelay: `${enterDelay}ms` } : undefined}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      {...inspectProps(title, onInspect, onClick)}
    >
      <circle r={r + (emphasis ? 12 : 10)} className="node-halo" />
      <g className="node-inner">
        <circle r={r} className={`node-circle${statusClass}`} />
        {faceScale === 1 ? face : <g transform={`scale(${faceScale})`}>{face}</g>}
      </g>
    </g>
  );
}

export function GraphHub({
  id,
  x,
  y,
  r,
  contentRadius,
  status,
  title,
  titleSize,
  stats,
  meta,
  heroValue,
  centered = false,
  logoSrc,
  selected = false,
  dimmed = false,
  onClick,
  onMouseEnter,
  onMouseMove,
  onMouseLeave,
  onInspect,
}: BubbleProps) {
  const faceR = contentRadius ?? r;
  const faceScale = faceR > 0 && r !== faceR ? r / faceR : 1;
  const statPillFont = IOM_STAT_PILL_FONT / faceScale;
  const pulseR = r * (140 / 98);
  const midR = r * (118 / 98);
  const headerSize = titleSize ?? 15;
  const stateClass = `${selected ? " node-selected" : ""}${dimmed ? " node-dimmed" : ""}`;

  const face = centered ? (
    <CenteredFace
      title={title}
      stats={stats}
      meta={meta}
      status={status}
      radius={faceR}
      hub
      logoSrc={logoSrc}
      statPillSize={statPillFont}
      heroValue={heroValue}
    />
  ) : (
    <>
      <CurvedHeader id={id} radius={faceR} title={title} fontSize={headerSize} className="node-title hub-title" />
      {heroValue ? (
        <HeroValue value={heroValue.value} label={heroValue.label} explainer={heroValue.explainer} status={status} radius={faceR} startY={12} />
      ) : (
        <CenteredStack radius={faceR} stats={stats} meta={meta} pillSize={statPillFont} status={status} />
      )}
    </>
  );

  return (
    <g
      className={`graph-node graph-hub${stateClass}`}
      data-graph-node-id={id}
      transform={`translate(${x}, ${y})`}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      {...inspectProps(title, onInspect, onClick)}
    >
      <circle r={pulseR} className="hub-halo-edge" fill="none" pointerEvents="fill" />
      <g className="node-inner">
        <circle className="hub-mid-ring" r={midR} fill="none" />
        <circle r={r} className="node-circle hub-core" />
        {faceScale === 1 ? face : <g transform={`scale(${faceScale})`}>{face}</g>}
      </g>
    </g>
  );
}

export function ConnLine({ x1, y1, x2, y2, kind = "default", hot = false }: CanvasEdge & { hot?: boolean }) {
  const kindClass =
    kind === "active" ? " active-spoke" : kind !== "default" ? ` ${kind}` : "";
  return <line x1={x1} y1={y1} x2={x2} y2={y2} className={`conn-line${kindClass}${hot ? " conn-hot" : ""}`} />;
}

export function TourSpotlight({
  active,
  x,
  y,
  radius,
  category,
}: {
  active: boolean;
  x: number;
  y: number;
  radius: number;
  category: string;
}) {
  return (
    <g
      id="tour-spotlight-group"
      style={{ display: active ? "block" : "none", pointerEvents: "none" }}
      transform={`translate(${x}, ${y})`}
    >
      <circle
        id="tour-spotlight-pulse"
        r={radius + 10}
        fill="none"
        stroke="var(--accent-purple)"
        strokeWidth="3"
        strokeDasharray="10 5"
        className="node-pulse-ring"
        opacity="0.8"
      />
      <circle
        id="tour-spotlight-ring"
        r={radius}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2.5"
      />
      <g id="tour-spotlight-tag" transform={`translate(0, -${radius + 10})`}>
        <rect
          x="-95"
          y="-14"
          width="190"
          height="28"
          rx="14"
          fill="var(--brand-card)"
          stroke="var(--accent-purple)"
          strokeWidth="1.8"
        />
        <circle cx="-75" cy="0" r="4" fill="var(--accent-purple)" />
        <text
          x="6"
          y="4"
          textAnchor="middle"
          fontSize="11"
          fontWeight="600"
          fill="var(--brand-headline)"
          letterSpacing="0.5"
          id="tour-spotlight-tag-text"
        >
          {category}
        </text>
      </g>
    </g>
  );
}
