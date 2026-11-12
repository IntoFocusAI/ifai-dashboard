"use client";

import "@/lib/canvas-sdk/canvas-sdk.css";
import "@/components/staff/sites-to-review.css";
import Link from "next/link";
import { useCallback, useRef } from "react";
import { ArrowLeft } from "lucide-react";
import { SitesToReviewTable } from "@/components/staff/SitesToReviewTable";
import { NodeTooltip, type NodeTooltipHandle } from "@/lib/canvas-sdk/NodeTooltip";
import { useDefinitionTooltips } from "@/lib/canvas-sdk/useDefinitionTooltips";
import type { SitesToReviewRead } from "@/lib/ai-search/site-review-read";
import { SITES_TO_REVIEW_PATH } from "@/lib/ai-search/site-review";
import { DASHBOARD_PATH } from "@/lib/auth/dashboard-path";
import { CLIENT_KEYS, CLIENTS, clientHref, type ClientKey } from "@/lib/client/active-client";
import { formatInt } from "@/lib/fender-canvas/format";

const THRESHOLD_TIP =
  "The classifier said how sure it was from 0 to 1. Under the review threshold (0.7, stored in site_type_settings) the site lands here. Your choice is saved as a staff override, which the classifier never changes.";

function withTheme(href: string, light: boolean): string {
  if (!light) return href;
  return `${href}${href.includes("?") ? "&" : "?"}theme=light`;
}

/** Fender and Ledlenser, as full page loads so the list is read again for the brand picked. */
function ClientSwitch({ client, light }: { client: ClientKey; light: boolean }) {
  return (
    <div className="segmented-control" role="group" aria-label="Client">
      {CLIENT_KEYS.map((key) => (
        <a
          key={key}
          href={withTheme(clientHref(key, SITES_TO_REVIEW_PATH), light)}
          className={`segmented-btn${key === client ? " active" : ""}`}
          aria-current={key === client ? "page" : undefined}
          data-sites-review-client={key}
        >
          {CLIENTS[key].brandName}
        </a>
      ))}
    </div>
  );
}

export function SitesToReviewView({
  client,
  read,
  light,
}: {
  client: ClientKey;
  read: SitesToReviewRead;
  light: boolean;
}) {
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

  const brand = CLIENTS[client].brandName;
  const count = read.ok ? read.rows.length : null;

  return (
    <main className={`ifai-canvas sites-review-page${light ? " light-theme" : ""}`} data-sites-review={client}>
      <div className="sites-review-card">
        <header className="sites-review-header">
          <div>
            <p className="sites-review-eyebrow">IntoFocus staff</p>
            <h1>Sites to review</h1>
          </div>
          <div className="sites-review-actions">
            <ClientSwitch client={client} light={light} />
            <Link href={withTheme(clientHref(client, DASHBOARD_PATH), light)} className="sites-review-back">
              <ArrowLeft size={14} aria-hidden />
              <span>Back to dashboard</span>
            </Link>
          </div>
        </header>
        <p className="sites-review-lead" data-sites-review-count={count ?? ""}>
          {count == null ? (
            "The list could not be read."
          ) : (
            <>
              {formatInt(count)} {count === 1 ? "site has" : "sites have"} a{" "}
              <span
                className="ifai-term"
                data-ifai-tooltip-title="Low-confidence site type"
                data-ifai-tooltip-desc={THRESHOLD_TIP}
                tabIndex={0}
                aria-label={`Low-confidence site type: ${THRESHOLD_TIP}`}
              >
                low-confidence site type
              </span>{" "}
              for {brand}. Confirm the type or pick another.
            </>
          )}
        </p>
        {read.ok ? (
          <SitesToReviewTable
            key={client}
            client={client}
            rows={read.rows}
            writable={read.writable}
            hasAnswers={read.hasAnswers}
          />
        ) : (
          <p className="sites-review-error" role="status">
            {read.message}
          </p>
        )}
      </div>
      <NodeTooltip ref={tooltipRef} />
    </main>
  );
}
