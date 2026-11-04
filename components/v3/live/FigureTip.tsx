"use client";

import type { ReactNode } from "react";

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
