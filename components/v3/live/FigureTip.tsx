"use client";

import type { ReactNode } from "react";
import { PARTIAL_MARK, PARTIAL_TITLE, partialFigureTip, type PartialFigure } from "@/lib/fender-canvas/canvas-reads";

/**
 * The shared custom-tooltip attributes (`.ifai-term` + `data-ifai-tooltip-*`) for a figure,
 * the same markup `applyDefinitionTooltipAttrs` writes. Empty when there is no description.
 */
export function figureTipAttrs(label: string, desc: string | null | undefined, testId?: string) {
  if (!desc) return {};
  return {
    className: "ifai-term",
    "data-ifai-tooltip-title": label,
    "data-ifai-tooltip-desc": desc,
    "data-figure-tip": testId ?? "",
    tabIndex: 0,
    "aria-label": `${label}: ${desc}`,
  };
}

/** A figure whose caveat lives in the shared custom tooltip. With no description it renders plain. */
export function FigureTip({
  title,
  desc,
  children,
  testId,
}: {
  title: string;
  desc: string | null | undefined;
  children: ReactNode;
  /** Written as `data-figure-tip` for specs. */
  testId?: string;
}) {
  if (!desc) return <>{children}</>;
  return <span {...figureTipAttrs(title, desc, testId)}>{children}</span>;
}

/**
 * A figure with the partial asterisk (X-25). The asterisk opens the shared custom tooltip,
 * which names what is missing, the coverage, the source, the last check, and the effect.
 * With no `partial` the figure renders plain.
 */
export function PartialFigureMark({
  partial,
  children,
  testId,
}: {
  partial: PartialFigure | null | undefined;
  children: ReactNode;
  testId?: string;
}) {
  if (!partial) return <>{children}</>;
  const title = PARTIAL_TITLE[partial.reason];
  const desc = partialFigureTip(partial);
  return (
    <span className="partial-figure" data-partial-figure={partial.reason}>
      {children}
      <span {...figureTipAttrs(title, desc, testId)} className="ifai-term partial-figure-mark">
        {PARTIAL_MARK}
      </span>
    </span>
  );
}
