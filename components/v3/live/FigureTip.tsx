"use client";

import type { ReactNode } from "react";

/**
 * A figure whose caveat lives in the shared custom tooltip (`.ifai-term` +
 * `data-ifai-tooltip-*`), the same markup `applyDefinitionTooltipAttrs` writes.
 * With no description the figure renders plain, so no empty tooltip appears.
 */
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
  return (
    <span
      className="ifai-term"
      data-ifai-tooltip-title={title}
      data-ifai-tooltip-desc={desc}
      data-figure-tip={testId ?? ""}
      tabIndex={0}
      aria-label={`${title}: ${desc}`}
    >
      {children}
    </span>
  );
}
