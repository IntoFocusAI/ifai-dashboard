"use client";

import { heroStatus, satelliteHeroLayout } from "@/lib/canvas-sdk/hero-fit";
import type { NodeStatus } from "@/lib/canvas-sdk/types";

const ROW_CLASS = {
  title: "node-title node-face-title",
  value: "node-hero-value",
  valueText: "node-hero-value",
  label: "node-hero-label",
} as const;

/**
 * Title, hero value, and label at fixed sizes, centered in a circle sized to hold them. The
 * value carries its status color; the status word is on the tab, not the bubble.
 */
export function SatelliteHeroFace({
  title,
  value,
  label,
  status,
}: {
  title: string;
  value: string;
  label: string;
  status: NodeStatus;
}) {
  const shown = heroStatus(status, value);
  const { rows } = satelliteHeroLayout(title, value, label);
  const statusClass = shown ? ` status-${status}` : "";
  return (
    <g className="node-face node-hero satellite-hero">
      {rows.map((row, index) => (
        <text
          key={`${row.kind}-${index}`}
          className={`${ROW_CLASS[row.kind]}${row.kind === "value" || row.kind === "valueText" ? statusClass : ""}`}
          data-hero-status={(row.kind === "value" || row.kind === "valueText") && shown ? shown : undefined}
          y={row.baseline}
          textAnchor="middle"
          fontSize={row.size}
        >
          {row.text}
        </text>
      ))}
    </g>
  );
}
