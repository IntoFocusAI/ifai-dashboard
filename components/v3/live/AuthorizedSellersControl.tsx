"use client";

import { useState } from "react";
import {
  AMAZON_RETAIL_ALWAYS_INCLUDED,
  AUTHORIZED_SELLERS_BROWSER_LINE,
  AUTHORIZED_SELLERS_LOADING,
  AUTHORIZED_SELLERS_MARK_LINE,
  AUTHORIZED_SELLERS_NONE_IN_READ,
  AUTHORIZED_SELLERS_UNAVAILABLE,
  AUTHORIZED_SELLERS_SAVE_LABEL,
  CONTROLLED_BUY_BOX_PLACEHOLDER_TOOLTIP,
  authorizedPartnersFromSave,
  authorizedSellersSavedLine,
  sellerChecked,
  toggleSeller,
  type AuthorizedSellerSave,
} from "@/lib/fender-canvas/authorized-sellers";
import { useAuthorizedSellers } from "@/lib/fender-canvas/authorized-sellers-store";
import type { BuyBoxSellerChoice } from "@/lib/fender-canvas/consensus-scores";
import type { RetailCanvasRead } from "@/lib/fender-canvas/portfolio-retail-display";

function choicesFor(read: RetailCanvasRead): BuyBoxSellerChoice[] | null | "unavailable" {
  if (read.phase !== "ready") return null;
  if (!read.snapshot.buyBoxSellers) return "unavailable";
  return read.snapshot.buyBoxSellers.sellers;
}

/**
 * Checkboxes for seller names already in the Buy Box read.
 * Amazon Retail is always included and is not a checkbox.
 */
export function AuthorizedSellersFields({
  read,
  saved,
  onSave,
}: {
  read: RetailCanvasRead;
  saved: AuthorizedSellerSave | null;
  onSave: (sellers: string[]) => void;
}) {
  const [draft, setDraft] = useState<string[] | null>(null);
  const choices = choicesFor(read);
  const checked = draft ?? saved?.sellers ?? [];
  const partners = authorizedPartnersFromSave(saved);

  return (
    <div className="authorized-sellers-body" id="authorized-sellers-panel">
      <p className="metric-card-sub" style={{ margin: 0 }}>
        {AUTHORIZED_SELLERS_MARK_LINE}
      </p>
      <p className="authorized-sellers-always" data-amazon-retail-always="">
        {AMAZON_RETAIL_ALWAYS_INCLUDED}
      </p>
      {choices == null ? (
        <p className="metric-card-sub" style={{ margin: 0 }} data-authorized-sellers-waiting="">
          {AUTHORIZED_SELLERS_LOADING}
        </p>
      ) : choices === "unavailable" ? (
        <p className="metric-card-sub" style={{ margin: 0 }} data-authorized-sellers-unavailable="">
          {AUTHORIZED_SELLERS_UNAVAILABLE}
        </p>
      ) : choices.length === 0 ? (
        <p className="metric-card-sub" style={{ margin: 0 }} data-authorized-sellers-empty="">
          {AUTHORIZED_SELLERS_NONE_IN_READ}
        </p>
      ) : (
        <ul className="authorized-sellers-list">
          {choices.map((choice) => (
            <li key={choice.name}>
              <label className="authorized-sellers-choice">
                <input
                  type="checkbox"
                  checked={sellerChecked(checked, choice.name)}
                  onChange={() => setDraft(toggleSeller(checked, choice.name))}
                  data-authorized-seller={choice.name}
                />
                <span>{choice.name}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
      {partners == null ? (
        <p className="authorized-sellers-status" data-authorized-sellers-placeholder="">
          {CONTROLLED_BUY_BOX_PLACEHOLDER_TOOLTIP}{" "}
          <span
            className="ifai-term"
            data-ifai-tooltip-title="Controlled Buy Box"
            data-ifai-tooltip-desc={CONTROLLED_BUY_BOX_PLACEHOLDER_TOOLTIP}
            tabIndex={0}
            aria-label={`Controlled Buy Box: ${CONTROLLED_BUY_BOX_PLACEHOLDER_TOOLTIP}`}
          >
            *
          </span>
        </p>
      ) : (
        <p className="authorized-sellers-status" data-authorized-sellers-status="">
          {authorizedSellersSavedLine(partners)}
        </p>
      )}
      <p className="metric-card-sub" style={{ margin: 0 }} data-authorized-sellers-browser="">
        {AUTHORIZED_SELLERS_BROWSER_LINE}
      </p>
      <button
        type="button"
        className="authorized-sellers-save"
        data-authorized-sellers-save=""
        disabled={choices == null || choices === "unavailable"}
        onClick={() => {
          if (!choices || choices === "unavailable") return;
          const next = choices
            .filter((choice) => sellerChecked(checked, choice.name))
            .map((choice) => choice.name);
          onSave(next);
          setDraft(null);
        }}
      >
        {AUTHORIZED_SELLERS_SAVE_LABEL}
      </button>
    </div>
  );
}

function SellersChevron() {
  return (
    <svg
      className="retail-explore-chevron"
      viewBox="0 0 12 12"
      width="12"
      height="12"
      aria-hidden="true"
    >
      <path
        d="M2.2 4.2 6 8l3.8-3.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AuthorizedSellersControl({ read }: { read: RetailCanvasRead }) {
  const [saved, setSaved] = useAuthorizedSellers();
  const [open, setOpen] = useState(false);

  return (
    <div
      className="content-box authorized-sellers"
      data-authorized-sellers=""
      data-authorized-sellers-open={open ? "true" : "false"}
      data-authorized-sellers-saved={saved ? "true" : "false"}
    >
      <button
        type="button"
        className="retail-explore authorized-sellers-toggle"
        aria-expanded={open}
        aria-controls="authorized-sellers-panel"
        onClick={() => setOpen((value) => !value)}
      >
        Authorized sellers
        <SellersChevron />
      </button>
      {open ? (
        <AuthorizedSellersFields
          read={read}
          saved={saved}
          onSave={(sellers) => setSaved({ sellers })}
        />
      ) : null}
    </div>
  );
}
