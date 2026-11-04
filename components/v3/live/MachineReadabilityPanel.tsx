"use client";

import { useState } from "react";
import { MachineReadabilityPageTable } from "@/components/v3/live/MachineReadabilityPageTable";
import { PageFoundTable } from "@/components/v3/live/PageFoundTable";
import { ShareHeroCard } from "@/components/v3/live/ShareHeroCard";
import { openedFromPageFoundBubble, useLandOnPageFoundHero } from "@/components/v3/live/useLandOnPageFoundHero";
import { usePageFoundEvidence } from "@/components/v3/live/usePageFoundEvidence";
import { useSpecCheckRunAt } from "@/components/v3/live/useSpecCheckRunAt";
import {
  machineReadabilityHeroes,
  sharedGapSentence,
  type MachineHeroId,
  type SpecPageSummary,
} from "@/lib/fender-canvas/machine-readability";
import {
  brandSitePageFoundHero,
  PAGE_FOUND_ANCHOR,
  PAGE_FOUND_HERO_ID,
} from "@/lib/fender-canvas/page-found-hero";
import type { CanvasMetricsRow } from "@/lib/fender-canvas/types";
import { brandSite } from "@/lib/brand-copy";

const PAGES_TABLE_ID = "machine-readability-pages";
const PAGE_FOUND_TABLE_ID = "brand-site-page-found-skus";

type OpenTable = MachineHeroId | typeof PAGE_FOUND_HERO_ID | "closed";

function BrandSiteSpecsNotes({ summary }: { summary: SpecPageSummary | null }) {
  const shared = sharedGapSentence(summary);
  return (
    <div
      className="content-box"
      data-machine-readability-notes=""
      data-brand-site-specs-notes=""
      style={{ flex: "1 1 240px", minWidth: 200, display: "flex", flexDirection: "column", gap: 10 }}
    >
      <div className="ceo-callout" style={{ margin: 0 }}>
        <div className="ceo-callout-header">
          <span>What is machine-readable product data?</span>
        </div>
        <div className="ceo-callout-body">
          Shoppers read {brandSite()}&apos;s spec tables. AI engines read the Schema.org product data
          behind the page and take what is there as fact. A spec that only appears as page text has
          to be guessed. {shared}
        </div>
      </div>
    </div>
  );
}

/**
 * Brand-Site Specs. The page-found hero leads with checked SKUs; the heroes after it
 * count found fender.com pages only. Hero cards in one row, explainer to the right.
 */
export function MachineReadabilityPanel({
  summary,
  metrics,
}: {
  summary: SpecPageSummary | null;
  metrics: CanvasMetricsRow | null;
}) {
  const [openTable, setOpenTable] = useState<OpenTable>(() =>
    openedFromPageFoundBubble() ? PAGE_FOUND_HERO_ID : "missing_specs",
  );
  const heroes = machineReadabilityHeroes(summary);
  const pageFound = brandSitePageFoundHero(metrics, useSpecCheckRunAt());
  const pageFoundRead = usePageFoundEvidence(openTable === PAGE_FOUND_HERO_ID);
  useLandOnPageFoundHero(PAGE_FOUND_ANCHOR, () => setOpenTable(PAGE_FOUND_HERO_ID));

  function toggle(which: Exclude<OpenTable, "closed">) {
    setOpenTable((prev) => (prev === which ? "closed" : which));
  }

  return (
    <div className="readiness-surface" data-machine-readability="" data-brand-site-specs="">
      <div
        data-machine-readability-lead=""
        data-brand-site-specs-lead=""
        style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-start" }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "stretch" }}>
          <ShareHeroCard
            hero={pageFound}
            dataAttr="data-machine-hero"
            open={openTable === PAGE_FOUND_HERO_ID}
            onToggle={() => toggle(PAGE_FOUND_HERO_ID)}
            controls={PAGE_FOUND_TABLE_ID}
            anchorId={PAGE_FOUND_ANCHOR}
          />
          {heroes.map((hero) => (
            <ShareHeroCard
              key={hero.id}
              hero={hero}
              dataAttr="data-machine-hero"
              open={openTable === hero.id}
              onToggle={() => toggle(hero.id)}
              controls={PAGES_TABLE_ID}
            />
          ))}
        </div>
        <BrandSiteSpecsNotes summary={summary} />
      </div>

      {openTable === PAGE_FOUND_HERO_ID ? (
        <PageFoundTable read={pageFoundRead} hero={pageFound} tableId={PAGE_FOUND_TABLE_ID} />
      ) : null}

      {summary && openTable !== "closed" && openTable !== PAGE_FOUND_HERO_ID ? (
        <MachineReadabilityPageTable
          summary={summary}
          filter={openTable}
          tableId={PAGES_TABLE_ID}
        />
      ) : null}
    </div>
  );
}
