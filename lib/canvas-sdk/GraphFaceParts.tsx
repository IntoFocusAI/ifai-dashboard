"use client";

import { type ReactElement } from "react";
import { BUBBLE_TEXT_MIN, fitMainHero, heroStatus } from "@/lib/canvas-sdk/hero-fit";
import { headerArcPath, pillMetrics, wrapText } from "@/lib/canvas-sdk/graph-text";
import type { NodeStatus } from "@/lib/canvas-sdk/types";

/**
 * One big number with a short label, in place of the stacked stat pills. The number carries
 * its status color; the status word lives on the tab. Sizing lives in `fitMainHero` so every
 * row clears the ring at this radius and renders at 11px or more at 1280x720.
 */
export function HeroValue({
  value,
  label,
  status,
  radius,
  startY,
  minText = BUBBLE_TEXT_MIN,
  explainer = false,
}: {
  value: string;
  label: string;
  /** Reads as a clarifying line under the title: label size, label grey. */
  explainer?: boolean;
  status: NodeStatus;
  radius: number;
  startY: number;
  minText?: number;
}) {
  const shown = heroStatus(status, value);
  const fit = fitMainHero(value, label, radius, startY, minText, explainer);
  const statusClass = shown ? ` status-${status}` : "";

  return (
    <g className="node-hero">
      <text
        className={explainer ? "node-hero-label" : `node-hero-value${statusClass}`}
        data-hero-status={shown ?? undefined}
        y={fit.valueY}
        textAnchor="middle"
        fontSize={fit.valueSize}
      >
        {value}
      </text>
      {fit.labelLines.length ? (
        <text className="node-hero-label" y={fit.labelY} textAnchor="middle" fontSize={fit.labelSize}>
          {fit.labelLines.map((line, index) => (
            <tspan key={`${line}-${index}`} x={0} dy={index === 0 ? 0 : fit.labelLineH}>
              {line}
            </tspan>
          ))}
        </text>
      ) : null}
    </g>
  );
}

export function CurvedHeader({
  id,
  radius,
  title,
  fontSize,
  inset,
  className = "node-title",
}: {
  id: string;
  radius: number;
  title: string;
  fontSize: number;
  inset?: number;
  className?: string;
}) {
  const pathId = `node-header-arc-${id}`;
  return (
    <>
      <path id={pathId} d={headerArcPath(radius, fontSize, title, inset)} fill="none" />
      <text className={className} fontSize={fontSize} dy={fontSize * 0.82}>
        <textPath href={`#${pathId}`} startOffset="50%" textAnchor="middle">
          {title}
        </textPath>
      </text>
    </>
  );
}

function StatPill({
  label,
  y,
  fontSize,
  status,
  maxWidth,
}: {
  label: string;
  y: number;
  fontSize: number;
  status?: NodeStatus;
  maxWidth?: number;
}) {
  const { width, height, lines, lineH } = pillMetrics(label, fontSize, maxWidth);
  const statusClass =
    status && status !== "neutral" ? ` status-${status}` : "";
  const textStartY = -((lines.length - 1) * lineH) / 2 + fontSize * 0.35;
  return (
    <g className="node-stat" transform={`translate(0, ${y})`}>
      <rect
        className={`node-stat-pill${statusClass}`}
        x={-width / 2}
        y={-height / 2}
        width={width}
        height={height}
        rx={Math.min(height / 2, 999)}
      />
      <text className="node-stat-text" textAnchor="middle" fontSize={fontSize}>
        {lines.map((entry, index) => (
          <tspan key={`${entry}-${index}`} x={0} dy={index === 0 ? textStartY : lineH}>
            {entry}
          </tspan>
        ))}
      </text>
    </g>
  );
}

function MetaBlock({
  meta,
  fontSize,
  y,
  maxWidth,
}: {
  meta: string;
  fontSize: number;
  y: number;
  maxWidth: number;
}) {
  const lines = wrapText(meta, maxWidth, fontSize);
  const lineH = fontSize + 2;
  const startY = y - ((lines.length - 1) * lineH) / 2;
  return (
    <text className="node-meta" textAnchor="middle" fontSize={fontSize}>
      {lines.map((entry, index) => (
        <tspan key={`${entry}-${index}`} x={0} dy={index === 0 ? startY : lineH}>
          {entry}
        </tspan>
      ))}
    </text>
  );
}

export function CenteredStack({
  radius,
  stats,
  meta,
  pillSize: fontSize,
  status,
  maxWidth,
  layout = "center",
  flowStartY = 0,
}: {
  radius: number;
  stats: string[];
  meta?: string;
  pillSize: number;
  status?: NodeStatus;
  maxWidth?: number;
  layout?: "center" | "flow";
  flowStartY?: number;
}) {
  const pillMax = maxWidth ?? Math.max(radius * 2 - 14, fontSize * 4);
  // Meta used to shrink to 82% of the pill; at the 11px floor that reads under 11px.
  const metaSize = fontSize;
  const metaMax = pillMax;
  const gap = radius < 62 ? 4 : 5;

  const pillMetricsList = stats.map((label) => pillMetrics(label, fontSize, pillMax));
  const metaLines = meta ? wrapText(meta, metaMax, metaSize) : [];
  const metaBlockH = metaLines.length ? metaLines.length * (metaSize + 2) + 2 : 0;

  const stackH =
    pillMetricsList.reduce((sum, pill) => sum + pill.height, 0) +
    Math.max(0, pillMetricsList.length - 1) * gap +
    (meta ? gap + metaBlockH : 0);

  const startY =
    layout === "flow" ? flowStartY : -stackH / 2 + (pillMetricsList[0]?.height ?? fontSize + 9) / 2 + 2;

  const placed = pillMetricsList.reduce(
    (acc, pill, index) => {
      const y = acc.cursor + pill.height / 2;
      return {
        cursor: acc.cursor + pill.height + gap,
        nodes: [
          ...acc.nodes,
          <StatPill
            key={`${stats[index]}-${index}`}
            label={stats[index]}
            y={y}
            fontSize={fontSize}
            status={status}
            maxWidth={pillMax}
          />,
        ],
      };
    },
    { cursor: startY, nodes: [] as ReactElement[] },
  );

  const metaY = meta ? placed.cursor + metaBlockH / 2 : 0;

  return (
    <>
      {placed.nodes}
      {meta ? <MetaBlock meta={meta} fontSize={metaSize} y={metaY} maxWidth={metaMax} /> : null}
    </>
  );
}
