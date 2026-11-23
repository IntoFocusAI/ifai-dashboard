"use client";

import { useEffect, useMemo, useState } from "react";
import {
  featuredOfferColumnProbe,
  featuredOfferReadingCountQuery,
  suppressedListingsQuery,
  withRetailerCells,
} from "@/lib/canvasData";
import { splitBuyBoxCauses, type BuyBoxCauseSplit, type WithheldCauseRow } from "@/lib/fender-canvas/buy-box-cause";
import { withheldListings } from "@/lib/fender-canvas/featured-offer";

const PAGE_SIZE = 1000;

export type WithheldListingsRead = "loading" | "unavailable" | { rows: WithheldCauseRow[] };

async function loadWithheldListings(): Promise<WithheldCauseRow[] | null> {
  const probe = await featuredOfferColumnProbe();
  if (probe.error || !probe.present) return null;

  const reading = await featuredOfferReadingCountQuery();
  if (reading.error || !reading.count) return null;

  const rows: WithheldCauseRow[] = [];
  for (let page = 0; page < 20; page += 1) {
    const { data, error, count } = await suppressedListingsQuery(page, PAGE_SIZE);
    if (error) return null;
    rows.push(...((data ?? []) as WithheldCauseRow[]));
    const total = count ?? rows.length;
    if (rows.length >= total || (data ?? []).length < PAGE_SIZE) {
      // R-10: the outside prices come from the retailer rows.
      return withRetailerCells(withheldListings(rows) as WithheldCauseRow[]);
    }
  }
  return null;
}

/** One read per page load: Suppressed Listings and the Action Items fix list share it. */
let shared: Promise<WithheldCauseRow[] | null> | null = null;

function readWithheldListings(): Promise<WithheldCauseRow[] | null> {
  if (!shared) {
    shared = loadWithheldListings().catch(() => null);
    shared.then((rows) => {
      if (!rows) shared = null;
    });
  }
  return shared;
}

/** Every listing whose Buy Box is withheld now, with its stored cause and outside prices. */
export function useWithheldListings(): WithheldListingsRead {
  const [state, setState] = useState<WithheldListingsRead>("loading");
  useEffect(() => {
    let cancelled = false;
    readWithheldListings().then((rows) => {
      if (!cancelled) setState(rows ? { rows } : "unavailable");
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}

/** The cause split of the withheld listings, or null while loading or after a failed read. */
export function useBuyBoxCauseSplit(): BuyBoxCauseSplit | null {
  const read = useWithheldListings();
  return useMemo(() => (typeof read === "object" ? splitBuyBoxCauses(read.rows) : null), [read]);
}
