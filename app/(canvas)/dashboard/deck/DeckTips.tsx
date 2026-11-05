"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { useDefinitionTooltips } from "@/lib/canvas-sdk/useDefinitionTooltips";

type Tip = { title: string; desc: string; x: number; y: number };

/** Shows the shared definition tooltip for `.ifai-term` marks on this page. */
export function DeckTips({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
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
    rootRef,
  });

  return (
    <div ref={rootRef}>
      {children}
      {tip ? (
        <div className="deck-tooltip" role="tooltip" style={{ left: tip.x, top: tip.y }}>
          {tip.title ? <div className="deck-tooltip-title">{tip.title}</div> : null}
          <div className="deck-tooltip-desc">{tip.desc}</div>
        </div>
      ) : null}
    </div>
  );
}
