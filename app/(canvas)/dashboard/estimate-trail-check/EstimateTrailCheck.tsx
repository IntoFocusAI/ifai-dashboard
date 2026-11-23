"use client";

import "@/lib/canvas-sdk/canvas-sdk.css";
import { useCallback, useRef } from "react";
import { EstimateTrailTrigger } from "@/components/v3/live/estimates/EstimateTrailTrigger";
import { NodeTooltip, type NodeTooltipHandle } from "@/lib/canvas-sdk/NodeTooltip";
import { useDefinitionTooltips } from "@/lib/canvas-sdk/useDefinitionTooltips";
import { HIGH_CONFIDENCE_RESULT, LOW_CONFIDENCE_RESULT } from "@/e2e/estimate-trail-fixtures";

/** The two fixtures behind triggers, with the shared custom tooltip wired as the canvas wires it. */
export function EstimateTrailCheck({ light }: { light: boolean }) {
  const tooltipRef = useRef<NodeTooltipHandle>(null);
  const show = useCallback((target: Element) => {
    const title = target.getAttribute("data-ifai-tooltip-title")?.trim() || target.textContent?.trim() || "";
    const desc = target.getAttribute("data-ifai-tooltip-desc")?.trim() ?? "";
    if (!desc) return;
    const rect = target.getBoundingClientRect();
    tooltipRef.current?.show(
      { title, desc, hasMoreInfo: false, anchor: "definition" },
      rect.left + rect.width / 2,
      rect.top,
      { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom },
    );
  }, []);
  const hide = useCallback(() => tooltipRef.current?.hide(), []);
  const never = useCallback(() => false, []);
  useDefinitionTooltips({ enabled: true, isBlocked: never, onShow: show, onHide: hide });

  return (
    <main
      className={`ifai-canvas${light ? " light-theme" : ""}`}
      style={{ minHeight: "100dvh", padding: 32, background: "var(--bg-primary)", color: "var(--text-main)" }}
      data-estimate-trail-check=""
    >
      <ul style={{ display: "grid", gap: 16, listStyle: "none", margin: 0, padding: 0, fontSize: 18 }}>
        <li>
          {HIGH_CONFIDENCE_RESULT.trail.title}: <EstimateTrailTrigger result={HIGH_CONFIDENCE_RESULT} />
        </li>
        <li>
          {LOW_CONFIDENCE_RESULT.trail.title}: <EstimateTrailTrigger result={LOW_CONFIDENCE_RESULT} />
        </li>
      </ul>
      <NodeTooltip ref={tooltipRef} />
    </main>
  );
}
