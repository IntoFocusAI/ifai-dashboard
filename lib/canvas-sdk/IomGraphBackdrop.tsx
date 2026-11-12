import type { CanvasSpec } from "@/lib/canvas-sdk/types";

function GraphStage({ spec }: { spec: CanvasSpec }) {
  if (spec.appearance !== "iom") return null;
  const hub = spec.nodes?.find((node) => node.variant === "hub");
  const cx = hub?.x ?? 800;
  const cy = hub?.y ?? 500;
  // Swirl occupies the upper mark; pin that center on the hub and clip the wordmark off.
  const swirlWidth = 720;
  const imgW = swirlWidth / 0.366;
  const imgH = imgW * (4500 / 8000);
  const imgX = cx - imgW / 2;
  const imgY = cy - imgH * 0.4436;

  return (
    <g className="graph-stage" pointerEvents="none">
      <g clipPath="url(#iomWatermarkClip)">
        <image
          href="/intofocus-ai-logo-stacked-full-color.png"
          x={imgX}
          y={imgY}
          width={imgW}
          height={imgH}
          opacity={0.13}
        />
      </g>
    </g>
  );
}

/** The map watermark. Hidden in the column rail. */
export function IomGraphBackdrop({ spec }: { spec: CanvasSpec }) {
  if (spec.appearance !== "iom") return null;
  const hub = spec.nodes?.find((node) => node.variant === "hub");
  const mapViewBox = spec.viewBox ?? { w: 1600, h: 1000 };
  return (
    <svg
      className="canvas-stage"
      viewBox={`0 0 ${mapViewBox.w} ${mapViewBox.h}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <defs>
        <clipPath id="iomWatermarkClip">
          <rect x={(hub?.x ?? 800) - 400} y={(hub?.y ?? 500) - 300} width={800} height={580} />
        </clipPath>
      </defs>
      <GraphStage spec={spec} />
    </svg>
  );
}
