"use client";

import { useState } from "react";
import { CitationPieDisc } from "@/components/v3/live/ai-search/CitationPieDisc";
import { CatalogGovernanceSpecTable } from "@/components/v3/live/CatalogGovernanceSpecTable";
import { DefinedCopy } from "@/components/v3/live/DefinedTerm";
import { ResizableTable, type RetailColumn } from "@/components/v3/live/ResizableTable";
import { useClientTableSort } from "@/components/v3/live/useClientTableSort";
import { CATALOG_GOVERNANCE_EXPLAINER } from "@/lib/fender-canvas/catalog-governance-copy";
import {
  catalogBundleLineLabel,
  catalogBundleBuyBoxLabel,
  catalogBundleSellerIdLabel,
  type PortfolioRetailSnapshot,
  type RetailReading,
  type UnnestedBundleOpportunity,
} from "@/lib/fender-canvas/portfolio-retail";
import type { RetailCanvasRead } from "@/lib/fender-canvas/portfolio-retail-display";
import { catalogHero, specHero } from "@/lib/fender-canvas/retail-overview-lead";
import type { SortInput } from "@/lib/fender-canvas/table-sort";

const SPLINTERED_LISTINGS_LABEL = "Splintered listings";
const SPECS_COMPLETE_LABEL = "Specs complete";
const SPLINTERED_TABLE_ID = "catalog-governance-splintered-table";
const SPECS_TABLE_ID = "catalog-governance-specs-table";

type OpenTable = "splintered" | "specs" | "closed";

const PAGE = 20;
const RETAIL_PIE_SIZE = "citation-pie-disc citation-pie-disc-retail";

const BUNDLE_COLUMNS: RetailColumn[] = [
  { id: "listing", name: "Listing", label: "Listing", width: 220, minWidth: 120, sort: "text" },
  { id: "asin", name: "ASIN", label: "ASIN", width: 118, minWidth: 108, className: "asin-col", sort: "text" },
  { id: "buybox", name: "Buy Box", label: "Buy Box", width: 180, minWidth: 110, sort: "text" },
  { id: "line", name: "Line", label: "Line", width: 120, minWidth: 88, sort: "text" },
];

function bundleSortValue(row: UnnestedBundleOpportunity, columnId: string): SortInput {
  if (columnId === "listing") return row.modelOrTitle?.trim() || row.bundleName?.trim() || null;
  if (columnId === "asin") return row.asin;
  if (columnId === "buybox") return catalogBundleBuyBoxLabel(row.buyboxStatus, row.buyboxSellerName);
  if (columnId === "line") return catalogBundleLineLabel(row.category);
  return null;
}

function amazonHref(asin: string): string | null {
  return /^[A-Z0-9]{10}$/.test(asin) ? `https://www.amazon.com/dp/${asin}` : null;
}

function httpUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function ExploreChevron() {
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

function Pager({
  page,
  total,
  onPage,
}: {
  page: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / PAGE));
  if (total <= PAGE) return null;
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <button
        type="button"
        className="segmented-btn"
        disabled={page <= 0}
        onClick={() => onPage(page - 1)}
      >
        Previous
      </button>
      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
        Page {page + 1} of {pages}
      </span>
      <button
        type="button"
        className="segmented-btn"
        disabled={page + 1 >= pages}
        onClick={() => onPage(page + 1)}
      >
        Next
      </button>
    </div>
  );
}

function AsinLink({ asin, href }: { asin: string; href: string | null }) {
  if (!href) return <span className="asin-chip">{asin}</span>;
  return (
    <a className="listing-link channel-tag channel-amz" href={href} target="_blank" rel="noopener noreferrer">
      <span className="asin-chip">{asin}</span>
    </a>
  );
}

function BuyBoxCell({ row }: { row: UnnestedBundleOpportunity }) {
  const sellerId = catalogBundleSellerIdLabel(row.buyboxStatus, row.buyboxSellerId);
  return (
    <td data-bundle-buybox="">
      {catalogBundleBuyBoxLabel(row.buyboxStatus, row.buyboxSellerName)}
      {sellerId ? <><br /><span className="asin-chip">{sellerId}</span></> : null}
    </td>
  );
}

function BundleRows({ rows }: { rows: UnnestedBundleOpportunity[] }) {
  const [page, setPage] = useState(0);
  const sorted = useClientTableSort(rows, BUNDLE_COLUMNS, bundleSortValue);
  const slice = sorted.rows.slice(page * PAGE, page * PAGE + PAGE);
  return (
    <>
      <ResizableTable
        tableId="catalog-bundles"
        columns={BUNDLE_COLUMNS}
        freezeHeader
        maxHeight={520}
        sort={sorted.sort}
        onSort={(columnId) => {
          setPage(0);
          sorted.onSort(columnId);
        }}
      >
          <tbody>
            {slice.length === 0 ? (
              <tr>
                <td colSpan={BUNDLE_COLUMNS.length}>No unnested bundle is confirmed in this retail read.</td>
              </tr>
            ) : (
              slice.map((row) => (
                <tr key={row.asin}>
                  <td>
                    <strong>{row.modelOrTitle ?? "Listing"}</strong>
                    {row.bundleName ? (
                      <>
                        <br />
                        {row.bundleName}
                      </>
                    ) : null}
                  </td>
                  <td className="asin-col">
                    <AsinLink asin={row.asin} href={httpUrl(row.productUrl) ?? amazonHref(row.asin)} />
                  </td>
                  <BuyBoxCell row={row} />
                  <td>{catalogBundleLineLabel(row.category)}</td>
                </tr>
              ))
            )}
          </tbody>
      </ResizableTable>
      <Pager page={page} total={rows.length} onPage={setPage} />
    </>
  );
}

/**
 * Specs-complete share (checked listings with every Amazon field filled).
 * Percentage / ratio / disc open Amazon Specs; chevron toggles the specs table.
 */
function CatalogSpecHero({
  snapshot,
  open,
  onToggle,
}: {
  snapshot: PortfolioRetailSnapshot;
  open: boolean;
  onToggle: () => void;
}) {
  const hero = specHero(snapshot);
  const aria = hero.ratio
    ? `${hero.percent}. ${hero.ratio}. Opens Amazon Specs.`
    : `${hero.percent}. Opens Amazon Specs.`;
  return (
    <div
      className="content-box findability-lead-card"
      data-catalog-spec-hero=""
      style={{ flex: "0 0 auto", width: "fit-content", maxWidth: "100%" }}
    >
      <button
        type="button"
        data-ifai-open="specs"
        data-ifai-tab="Amazon Specs"
        data-spec-open="amazon-specs"
        aria-label={aria}
        style={{
          appearance: "none",
          background: "none",
          border: 0,
          padding: 0,
          margin: 0,
          color: "inherit",
          font: "inherit",
          textAlign: "left",
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          width: "100%",
        }}
      >
        <div>
          <span>{hero.label}</span>
        </div>
        <div className="findability-lead-row">
          <div className="findability-lead-figures">
            <span className="ai-lead-figure" style={{ color: hero.color }}>
              {hero.percent}
            </span>
            {hero.ratio ? (
              <span className="findability-lead-ratio">{hero.ratio}</span>
            ) : null}
          </div>
          {hero.pie ? (
            <CitationPieDisc pie={hero.pie} sizeClass={RETAIL_PIE_SIZE} tip={hero.tip ?? undefined} />
          ) : null}
        </div>
        <span className="metric-card-sub">{hero.explainer}</span>
      </button>
      <button
        type="button"
        className="retail-explore"
        aria-label={SPECS_COMPLETE_LABEL}
        aria-expanded={open}
        aria-controls={SPECS_TABLE_ID}
        onClick={onToggle}
        style={{ marginTop: "auto", alignSelf: "center" }}
      >
        <ExploreChevron />
      </button>
    </div>
  );
}

/**
 * Same unnested-bundle share as Retail Overview: percentage, N of M, and disc.
 * Visible label is Splintered listings; tab / RETAIL_FINDING_LABELS stay Catalog Governance.
 * Chevron toggles the bundle table; the card itself is not a navigation button.
 */
function CatalogGovernanceLead({
  snapshot,
  open,
  onToggle,
}: {
  snapshot: PortfolioRetailSnapshot;
  open: boolean;
  onToggle: () => void;
}) {
  const hero = catalogHero(snapshot);
  return (
    <div
      className="content-box findability-lead-card"
      data-catalog-governance-lead=""
      style={{ flex: "0 0 auto", width: "fit-content", maxWidth: "100%" }}
    >
      <div>
        <span>{SPLINTERED_LISTINGS_LABEL}</span>
      </div>
      <div className="findability-lead-row">
        <div className="findability-lead-figures">
          <span className="ai-lead-figure" style={{ color: hero.color }}>
            {hero.percent}
          </span>
          {hero.ratio ? (
            <span className="findability-lead-ratio">{hero.ratio}</span>
          ) : null}
        </div>
        {hero.pie ? (
          <CitationPieDisc pie={hero.pie} sizeClass={RETAIL_PIE_SIZE} tip={hero.tip ?? undefined} />
        ) : null}
      </div>
      <span className="metric-card-sub">{hero.explainer}</span>
      <button
        type="button"
        className="retail-explore"
        aria-label={SPLINTERED_LISTINGS_LABEL}
        aria-expanded={open}
        aria-controls={SPLINTERED_TABLE_ID}
        onClick={onToggle}
        style={{ marginTop: "auto", alignSelf: "center" }}
      >
        <ExploreChevron />
      </button>
    </div>
  );
}

/** Explainer column beside the hero pair. Incomplete / unavailable messages sit under the notes. */
function CatalogGovernanceNotes({ specs }: { specs: RetailReading<unknown> }) {
  const showMissing =
    (specs.status === "incomplete" || specs.status === "unavailable") && Boolean(specs.missingMessage);
  return (
    <div
      className="content-box"
      data-catalog-governance-notes=""
      style={{ flex: "1 1 240px", minWidth: 200, display: "flex", flexDirection: "column", gap: 10 }}
    >
      <div className="ceo-callout" style={{ margin: 0 }}>
        <div className="ceo-callout-header">
          <span>What is catalog governance?</span>
        </div>
        <div className="ceo-callout-body">
          <DefinedCopy text={CATALOG_GOVERNANCE_EXPLAINER} />
        </div>
      </div>
      {showMissing ? <p className="retail-missing">{specs.missingMessage}</p> : null}
    </div>
  );
}

export function CatalogGovernancePanel({ read }: { read: RetailCanvasRead }) {
  const [openTable, setOpenTable] = useState<OpenTable>("splintered");

  function toggleTable(which: "splintered" | "specs") {
    setOpenTable((prev) => (prev === which ? "closed" : which));
  }

  if (read.phase === "loading") {
    return <p className="retail-missing">Loading the retail reading…</p>;
  }
  if (read.phase === "error") {
    return <p className="retail-missing">The retail read could not be loaded.</p>;
  }

  const bundles = read.snapshot.unnestedBundles;
  const specs = read.snapshot.amazonSpecGaps;
  const opportunities = bundles.detail?.opportunities ?? [];

  return (
    <div className="catalog-governance retail-surface">
      <div
        data-catalog-governance-lead-row=""
        style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-start" }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "stretch" }}>
          <CatalogGovernanceLead
            snapshot={read.snapshot}
            open={openTable === "splintered"}
            onToggle={() => toggleTable("splintered")}
          />
          <CatalogSpecHero
            snapshot={read.snapshot}
            open={openTable === "specs"}
            onToggle={() => toggleTable("specs")}
          />
        </div>
        <CatalogGovernanceNotes specs={specs} />
      </div>

      {openTable === "splintered" ? (
        <div
          className="content-box"
          style={{ marginTop: 12 }}
          data-catalog-governance-table=""
          id={SPLINTERED_TABLE_ID}
        >
          {bundles.detail ? <BundleRows rows={opportunities} /> : null}
        </div>
      ) : null}

      {openTable === "specs" ? (
        <CatalogGovernanceSpecTable specs={specs} tableId={SPECS_TABLE_ID} />
      ) : null}
    </div>
  );
}
