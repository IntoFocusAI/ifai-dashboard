"use client";

import { useLayoutEffect, useRef, useState } from "react";
import {
  DATA_STATUS_MARK_NAME,
  DATA_STATUS_MARK_PATH,
  dataStatusColor,
  type DataStatus,
} from "@/lib/canvas-sdk/data-status";
import { HERO_MARK_EM, HERO_MARK_GAP_EM } from "@/lib/canvas-sdk/hero-fit";

/** Rough first-paint width before the browser measures the figure. */
const FIRST_PAINT_CHAR_EM = 0.56;

/**
 * A map bubble's hero figure in its status color, with the StatusMark glyph (x, dash, or check)
 * beside it and no word (decision 59: words stay on the tabs). The pair is centered on x = 0.
 * A figure with no status draws alone, centered, as before.
 */
export function HeroFigureText({
  value,
  status,
  className,
  y,
  fontSize,
}: {
  value: string;
  status: DataStatus | null;
  className: string;
  y: number;
  fontSize: number;
}) {
  const ref = useRef<SVGTextElement>(null);
  const [width, setWidth] = useState(() => value.length * fontSize * FIRST_PAINT_CHAR_EM);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!status || !node || typeof node.getComputedTextLength !== "function") return;
    const measured = node.getComputedTextLength();
    if (measured > 0 && Math.abs(measured - width) > 0.5) setWidth(measured);
  }, [status, value, fontSize, width]);

  if (!status) {
    return (
      <text ref={ref} className={className} y={y} textAnchor="middle" fontSize={fontSize}>
        {value}
      </text>
    );
  }

  const side = fontSize * HERO_MARK_EM;
  const gap = fontSize * HERO_MARK_GAP_EM;
  const left = -(width + gap + side) / 2;
  // Center the mark on the digits' middle, a little over a third of the size above the baseline.
  const markTop = y - fontSize * 0.36 - side / 2;
  return (
    <g className="node-hero-figure">
      <text ref={ref} className={className} data-hero-status={status} x={left + width / 2} y={y} textAnchor="middle" fontSize={fontSize}>
        {value}
      </text>
      <g
        className="node-hero-mark"
        data-status-mark={DATA_STATUS_MARK_NAME[status]}
        aria-hidden="true"
        transform={`translate(${left + width + gap} ${markTop}) scale(${side / 12})`}
        style={{ color: dataStatusColor(status) }}
      >
        <path
          d={DATA_STATUS_MARK_PATH[status]}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </g>
  );
}
