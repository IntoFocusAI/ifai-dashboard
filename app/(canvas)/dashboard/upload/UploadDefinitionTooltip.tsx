"use client";

import { useCallback, useState } from "react";
import { useDefinitionTooltips } from "@/lib/canvas-sdk/useDefinitionTooltips";

type Tip = { title: string; desc: string; x: number; y: number };

/** Shows the same definition tooltip the canvas uses, scoped to this page. */
export function UploadDefinitionTooltip() {
  const [tip, setTip] = useState<Tip | null>(null);

  const onShow = useCallback((target: Element) => {
    const title = target.getAttribute("data-ifai-tooltip-title")?.trim() || target.textContent?.trim() || "";
    const desc = target.getAttribute("data-ifai-tooltip-desc")?.trim() ?? "";
    if (!desc) return;
    const rect = target.getBoundingClientRect();
    setTip({ title, desc, x: rect.left + rect.width / 2, y: rect.top });
  }, []);

  const onHide = useCallback(() => setTip(null), []);

  useDefinitionTooltips({
    enabled: true,
    isBlocked: () => false,
    onShow,
    onHide,
  });

  if (!tip) return null;
  return (
    <div className="upload-definition-tip" style={{ left: tip.x, top: tip.y }} role="tooltip">
      <div className="upload-definition-tip-title">{tip.title}</div>
      <div>{tip.desc}</div>
    </div>
  );
}
