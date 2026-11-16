"use client";

import { useState } from "react";
import { ListingContentTable } from "@/components/v3/live/ListingContentTable";
import { ShareHeroCard } from "@/components/v3/live/ShareHeroCard";
import {
  listingContentHeroes,
  type ContentHeroId,
  type ListingContentSummary,
} from "@/lib/fender-canvas/listing-content";

const CONTENT_TABLE_ID = "aplus-matrix-listings";

type OpenTable = ContentHeroId | "closed";

function AplusNotes() {
  return (
    <div className="ceo-callout" style={{ margin: 0 }} data-aplus-notes="">
      <div className="ceo-callout-header">
        <span>Why does Amazon listing content matter to AI?</span>
      </div>
      <div className="ceo-callout-body">
        Amazon&apos;s shopping assistant and other AI engines answer from what the listing says.
        Bullets are the first copy they quote. A+ modules and comparison charts let them explain
        how one model steps up from another, and a video adds proof a shopper can watch.
      </div>
    </div>
  );
}

export function AplusMatrixPanel({ summary }: { summary: ListingContentSummary | null }) {
  const [openTable, setOpenTable] = useState<OpenTable>("bullets");
  const heroes = listingContentHeroes(summary);

  function toggle(which: ContentHeroId) {
    setOpenTable((prev) => (prev === which ? "closed" : which));
  }

  return (
    <div className="readiness-surface" data-aplus-matrix="">
      <div
        data-aplus-matrix-lead=""
        style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "stretch" }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "stretch" }}>
          {heroes.map((hero) => (
            <ShareHeroCard
              key={hero.id}
              hero={hero}
              dataAttr="data-content-hero"
              open={openTable === hero.id}
              onToggle={() => toggle(hero.id as ContentHeroId)}
              controls={CONTENT_TABLE_ID}
            />
          ))}
        </div>
        <AplusNotes />
      </div>

      {summary && openTable !== "closed" ? (
        <ListingContentTable summary={summary} filter={openTable} tableId={CONTENT_TABLE_ID} />
      ) : null}
    </div>
  );
}
