"use client";

import { HeroFigureText } from "@/lib/canvas-sdk/HeroFigureText";
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
 * value carries its status color and mark (x, dash, or check); the status word is on the tab,
 * not the bubble (decision 59).
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
  const { rows } = satelliteHeroLayout(title, value, label, shown != null);
  const statusClass = shown ? ` status-${status}` : "";
  return (
    <g className="node-face node-hero satellite-hero">
      {rows.map((row, index) =>
        row.kind === "value" && shown ? (
          <HeroFigureText
            key={`${row.kind}-${index}`}
            value={row.text}
            status={shown}
            className={`${ROW_CLASS.value}${statusClass}`}
            y={row.baseline}
            fontSize={row.size}
          />
        ) : (
          <text
            key={`${row.kind}-${index}`}
            className={`${ROW_CLASS[row.kind]}${row.kind === "valueText" ? statusClass : ""}`}
            data-hero-status={row.kind === "valueText" && shown ? shown : undefined}
            y={row.baseline}
            textAnchor="middle"
            fontSize={row.size}
          >
            {row.text}
          </text>
        ),
      )}
    </g>
  );
}
