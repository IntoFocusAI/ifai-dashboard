"use client";

import { DATA_STATUS_MARK_NAME, DATA_STATUS_MARK_PATH, DATA_STATUS_WORD, type DataStatus } from "@/lib/canvas-sdk/data-status";
import { STATUS_MARK_EM, STATUS_MARK_GAP_EM, heroStatus, satelliteHeroLayout } from "@/lib/canvas-sdk/hero-fit";
import type { NodeStatus } from "@/lib/canvas-sdk/types";

const ROW_CLASS = {
  title: "node-title node-face-title",
  value: "node-hero-value",
  valueText: "node-hero-value",
  label: "node-hero-label",
  status: "node-hero-status-word",
} as const;

/** Geist's average advance is narrower than the fit estimate, so center on this share. */
const WORD_WIDTH_EM = 0.56;

/** The x, dash, or check and the status word, centered on one baseline inside the bubble. */
export function HeroStatusRow({ status, y, size }: { status: DataStatus; y: number; size: number }) {
  const word = DATA_STATUS_WORD[status];
  const mark = size * STATUS_MARK_EM;
  const gap = size * STATUS_MARK_GAP_EM;
  const left = -(mark + gap + word.length * size * WORD_WIDTH_EM) / 2;
  const scale = mark / 12;
  return (
    <g className={`node-hero-status status-${status}`} data-status={status} data-status-mark={DATA_STATUS_MARK_NAME[status]}>
      <path
        d={DATA_STATUS_MARK_PATH[status]}
        transform={`translate(${left.toFixed(2)}, ${(y - mark * 0.86).toFixed(2)}) scale(${scale.toFixed(4)})`}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <text className={ROW_CLASS.status} x={left + mark + gap} y={y} fontSize={size}>
        {word}
      </text>
    </g>
  );
}

/** Title, hero value, and label at fixed sizes, centered in a circle sized to hold them. */
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
  const { rows } = satelliteHeroLayout(title, value, label, shown);
  const statusClass = shown ? ` status-${status}` : "";
  return (
    <g className="node-face node-hero satellite-hero">
      {rows.map((row, index) =>
        row.kind === "status" && shown ? (
          <HeroStatusRow key="status" status={shown} y={row.baseline} size={row.size} />
        ) : (
          <text
            key={`${row.kind}-${index}`}
            className={`${ROW_CLASS[row.kind]}${row.kind === "value" || row.kind === "valueText" ? statusClass : ""}`}
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
