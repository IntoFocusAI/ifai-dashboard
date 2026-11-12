"use client";

import { useState } from "react";
import { CatalogGovernanceBundleTable } from "@/components/v3/live/CatalogGovernanceBundleTable";
import { CatalogGovernanceSpecTable } from "@/components/v3/live/CatalogGovernanceSpecTable";
import { DefinedCopy } from "@/components/v3/live/DefinedTerm";
import { figureTipAttrs, PartialFigureMark } from "@/components/v3/live/FigureTip";
import { RetailShareDisc, RetailStatusMark } from "@/components/v3/live/RetailOverviewFigure";
import { CATALOG_GOVERNANCE_EXPLAINER } from "@/lib/fender-canvas/catalog-governance-copy";
import type { PortfolioRetailSnapshot, RetailReading } from "@/lib/fender-canvas/portfolio-retail";
import type { RetailCanvasRead } from "@/lib/fender-canvas/portfolio-retail-display";
import {
  catalogHero,
  heroFigureColor,
  heroFigureTone,
  specHero,
} from "@/lib/fender-canvas/retail-overview-lead";

/** One name for the figure everywhere (X-18): splintering may cover more than bundles. */
const SPLINTERED_LISTINGS_LABEL = "Splintered Listings";
const SPECS_COMPLETE_LABEL = "Specs complete";
const SPLINTERED_TABLE_ID = "catalog-governance-splintered-table";
const SPECS_TABLE_ID = "catalog-governance-specs-table";

type OpenTable = "splintered" | "specs" | "closed";


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
  const aria = `${[hero.percent, hero.ratio, hero.tip?.replace(/\.$/, "")].filter(Boolean).join(". ")}. Opens Amazon Specs.`;
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
            <span className="ai-lead-figure" style={{ color: heroFigureColor(hero) }}>
              <PartialFigureMark partial={hero.partial} testId="spec-hero-stale">
                {hero.percent}
              </PartialFigureMark>
            </span>
            {hero.ratio ? (
              <span className="findability-lead-ratio">
                <span {...figureTipAttrs(SPECS_COMPLETE_LABEL, hero.tip, "spec-coverage")} tabIndex={-1}>{hero.ratio}</span>
              </span>
            ) : null}
            <RetailStatusMark tone={heroFigureTone(hero)} />
          </div>
          {hero.pie ? <RetailShareDisc pie={hero.pie} measuredKey="matched" tip={hero.tip} /> : null}
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
 * Visible label is Splintered Listings; tab / RETAIL_FINDING_LABELS stay Catalog Governance.
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
          <span className="ai-lead-figure" style={{ color: heroFigureColor(hero) }}>
            <PartialFigureMark partial={hero.partial} testId="bundle-hero-stale">
              {hero.percent}
            </PartialFigureMark>
          </span>
          {hero.ratio ? (
            <span className="findability-lead-ratio">
              <span {...figureTipAttrs(SPLINTERED_LISTINGS_LABEL, hero.tip, "bundle-population")}>{hero.ratio}</span>
            </span>
          ) : null}
          <RetailStatusMark tone={heroFigureTone(hero)} />
        </div>
        {hero.pie ? <RetailShareDisc pie={hero.pie} measuredKey="contradicted" tip={hero.tip} /> : null}
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

/** Explainer column beside the hero pair. A missing spec reading says why under the notes; coverage caveats stay in the figure's tooltip. */
function CatalogGovernanceNotes({ specs }: { specs: RetailReading<unknown> }) {
  const showMissing = specs.status === "unavailable" && Boolean(specs.missingMessage);
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
          {bundles.detail ? <CatalogGovernanceBundleTable rows={opportunities} /> : null}
        </div>
      ) : null}

      {openTable === "specs" ? (
        <CatalogGovernanceSpecTable specs={specs} tableId={SPECS_TABLE_ID} />
      ) : null}
    </div>
  );
}
