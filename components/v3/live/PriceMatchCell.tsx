"use client";

import type { RetailColumn } from "@/components/v3/live/ResizableTable";
import {
  PRICE_MATCH_DESC,
  PRICE_MATCH_LABEL,
  PRICE_MATCH_MISSING_DESC,
  PRICE_MATCH_MISSING_LABEL,
} from "@/lib/fender-canvas/price-matches";

/** One column of stored pages. The header uses the same definition as each link. */
export const PRICE_MATCH_COLUMN: RetailColumn = {
  id: "price-match",
  name: "Price match",
  label: "Price match",
  width: 168,
  minWidth: 140,
  headerTooltip: {
    title: PRICE_MATCH_LABEL,
    description: PRICE_MATCH_DESC,
  },
};

function termAttrs(title: string, description: string, className: string) {
  return {
    className,
    "data-ifai-tooltip-title": title,
    "data-ifai-tooltip-desc": description,
    tabIndex: 0 as const,
    "aria-label": `${title}: ${description}`,
  };
}

/**
 * Each stored page is a link labeled Price match.
 * No stored http(s) page reads Not available*, never a blank cell.
 */
export function PriceMatchCell({ hrefs }: { hrefs: readonly string[] }) {
  if (hrefs.length === 0) {
    return (
      <td data-price-match="missing">
        <span {...termAttrs(PRICE_MATCH_MISSING_LABEL, PRICE_MATCH_MISSING_DESC, "ifai-term fo-note")}>
          {PRICE_MATCH_MISSING_LABEL}
        </span>
      </td>
    );
  }

  return (
    <td data-price-match="stored">
      <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
        {hrefs.map((href) => (
          <a
            key={href}
            {...termAttrs(PRICE_MATCH_LABEL, PRICE_MATCH_DESC, "ifai-term listing-link")}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            data-price-match-href={href}
          >
            {PRICE_MATCH_LABEL}
          </a>
        ))}
      </span>
    </td>
  );
}
