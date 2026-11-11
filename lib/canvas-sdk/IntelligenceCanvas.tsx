"use client";

import { CanvasGraph } from "@/lib/canvas-sdk/CanvasGraph";
import { CanvasShell } from "@/lib/canvas-sdk/CanvasShell";
import type { CanvasSpecWithViews } from "@/lib/canvas-sdk/minimal-view-types";

export function IntelligenceCanvas({ spec }: { spec: CanvasSpecWithViews }) {
  return (
    <CanvasShell spec={spec}>
      {(ctx) => (
        <CanvasGraph
          spec={spec}
          svgRef={ctx.svgRef}
          viewportRef={ctx.viewportRef}
          transform={ctx.transform}
          tourActive={ctx.tourActive}
          tourX={ctx.tourX}
          tourY={ctx.tourY}
          tourRadius={ctx.tourRadius}
          tourCategory={ctx.tourCategory}
          onFocusNode={ctx.focusNode}
          onInspectBubble={ctx.inspectBubble}
          onResetView={ctx.resetView}
          overviewNonce={ctx.overviewNonce}
          focusedSpokeId={ctx.focusedSpokeId}
          columnScrollKey={ctx.columnScrollKey}
          columnLayout={ctx.columnLayout}
          mapExiting={ctx.mapExiting}
          mapEntering={ctx.mapEntering}
          columnRailExiting={ctx.columnRailExiting}
          heldGroupId={ctx.heldGroupId}
          onShowTooltip={ctx.showTooltip}
          onHideTooltip={ctx.hideTooltip}
        />
      )}
    </CanvasShell>
  );
}
