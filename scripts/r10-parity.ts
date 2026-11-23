/**
 * R-10 step 3 parity gate: every MAP and Catalog Health number, computed from the wmt_* / mf_*
 * columns (the way the dashboard read them before this change) and from the retailer rows (the
 * way it reads them now), for Fender and Ledlenser, on production data. Read-only: it signs in
 * as TEST_LOGIN_EMAIL and only selects from the canvas views.
 *
 *   node --env-file=.env.local --experimental-strip-types --import ./scripts/register-alias.mjs \
 *     --import ./scripts/register-ts-extensions.mjs scripts/r10-parity.ts
 *
 * Remove with the step-4 column drop: the column side has nothing to read after that.
 */

import { createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { resetActiveClientForTests } from "../lib/client/active-client.ts";
import { lowerPricesElsewhere } from "../lib/fender-canvas/buy-box-cause.ts";
import { withheldListings, type FeaturedOfferRow } from "../lib/fender-canvas/featured-offer.ts";
import { retailerCarry } from "../lib/fender-canvas/map-channel-carry.ts";
import { listingChannelFacts, mapTabModel, type MapSourceRow } from "../lib/fender-canvas/map-channels.ts";
import { mapChannelStale } from "../lib/fender-canvas/map-reading-status.ts";
import { mapLeakageFinding } from "../lib/fender-canvas/portfolio-retail.ts";
import { loadRetailerPrices, type RetailerPriceClient } from "../lib/fender-canvas/retailer-prices-read.ts";
import {
  byWorstLeakage,
  withRetailerPrices,
  type RetailerCell,
  type RetailerPriceIndex,
} from "../lib/fender-canvas/retailer-prices.ts";

type Row = Record<string, unknown> & { asin: string };

const CLIENTS = [
  { key: "fender", schema: "public" },
  { key: "ledlenser", schema: "ledlenser" },
] as const;

function num(value: unknown): number | null {
  if (value == null || (typeof value === "string" && value.trim() === "")) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function positive(value: unknown): number | null {
  const n = num(value);
  return n == null || n <= 0 ? null : n;
}

const round = (value: number) => Math.round(value * 100) / 100;

/** The removed column read: Walmart and Musician's Friend from wmt_* / mf_*, gap = stored leakage, else price − MAP. */
function columnCells(row: Row): RetailerCell[] {
  const out: RetailerCell[] = [];
  const add = (key: string, name: string, prefix: "wmt" | "mf") => {
    if (!(`${prefix}_price` in row)) return;
    const price = positive(row[`${prefix}_price`]);
    const leak = num(row[`${prefix}_leakage`]);
    const map = positive(row.map_price);
    const gap = leak != null ? round(leak) : price != null && map != null ? round(price - map) : null;
    out.push({
      key,
      name,
      mapChannel: true,
      price,
      gap,
      url: typeof row[`${prefix}_url`] === "string" ? (row[`${prefix}_url`] as string) : null,
      checkedAt: (row[`${prefix}_checked_at`] as string | null) ?? null,
      firstMiss: false,
    });
  };
  add("walmart", "Walmart", "wmt");
  add("musicians-friend", "Musician's Friend", "mf");
  return out;
}

async function allRows(client: SupabaseClient, view: string): Promise<Row[]> {
  const rows: Row[] = [];
  for (let page = 0; page < 40; page += 1) {
    const { data, error } = await client
      .from(view)
      .select("*")
      .order("asin")
      .range(page * 1000, page * 1000 + 999);
    if (error) throw new Error(`${view}: ${error.message}`);
    rows.push(...((data ?? []) as Row[]));
    if ((data ?? []).length < 1000) return rows;
  }
  throw new Error(`${view}: too many rows`);
}

type Figures = Record<string, string | number | null>;

const sha1 = (text: string) => createHash("sha1").update(text).digest("hex").slice(0, 12);

function figures(
  listings: Array<Row & { retailers: RetailerCell[]; worst_leakage: number | null; is_map_violation: boolean }>,
  index: RetailerPriceIndex,
  now: number,
): Figures {
  const order = index.retailers.map((retailer) => retailer.key);
  const out: Figures = {};
  const mapRows = listings as unknown as MapSourceRow[];
  const violations = listings.filter((row) => row.is_map_violation).sort(byWorstLeakage);

  // Catalog Health, MAP Leakage reading.
  const reading = mapLeakageFinding(listings as never, { now });
  out["CH MAP status"] = reading.status;
  out["CH MAP violations"] = reading.detail?.violations ?? null;
  out["CH MAP decided"] = reading.detail?.decided ?? null;
  out["CH MAP undecided"] = reading.detail?.undecided ?? null;
  out["CH MAP population"] = reading.detail?.population ?? null;
  out["CH MAP average leakage"] = reading.detail?.averageLeakage ?? null;
  out["CH MAP stale note"] = reading.stale?.missing ?? "none";

  // MAP tab: the below-MAP table model, channel lines, carry and stale notes.
  const model = mapTabModel(violations as unknown as MapSourceRow[], order);
  out["MAP rows below MAP"] = model.count;
  out["MAP combined gap"] = model.combinedGap == null ? null : round(model.combinedGap);
  out["MAP average gap"] = model.averageGap == null ? null : round(model.averageGap);
  out["MAP columns"] = model.columns.map((column) => column.name).join(", ");
  for (const channel of model.channels) out[`MAP line ${channel.name}`] = channel.count;
  const carry = retailerCarry({
    retailers: index.retailers,
    byAsin: new Map(listings.map((row) => [row.asin, row.retailers])),
  });
  for (const [name, value] of Object.entries(carry)) {
    out[`MAP carried ${name}`] = value?.carried ?? null;
    out[`MAP carried no price ${name}`] = value?.missing ?? null;
  }
  const stale = mapChannelStale(violations as unknown as MapSourceRow[], now);
  for (const [name, value] of Object.entries(stale)) out[`MAP stale ${name}`] = value?.missing ?? "none";

  // Explore all listings: columns, violations-only count, and every price/gap cell.
  out["Explore columns"] = mapTabModel(mapRows, order).columns.map((column) => column.name).join(", ");
  out["Explore violations-only rows"] = violations.length;
  out["Explore retailer cells (sha1)"] = sha1(listings
    .flatMap((row) =>
      listingChannelFacts(row as unknown as MapSourceRow)
        .filter((fact) => fact.key !== "amazon")
        .map((fact) => `${row.asin}:${fact.key}:${fact.price}:${fact.gap}`),
    )
    .sort()
    .join("|"));
  out["Worst-leakage sum"] = round(listings.reduce((sum, row) => sum + (row.worst_leakage ?? 0), 0));

  // Suppressed Listings: withheld listings with a lower price elsewhere.
  const withheld = withheldListings(listings as unknown as FeaturedOfferRow[]) as unknown as Array<
    Row & { retailers: RetailerCell[] }
  >;
  out["Suppressed with lower price elsewhere"] = withheld.filter((row) => lowerPricesElsewhere(row as never).length > 0).length;
  return out;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const email = process.env.TEST_LOGIN_EMAIL;
  const password = process.env.TEST_LOGIN_PASSWORD;
  if (!url || !key || !email || !password) throw new Error("Set the Supabase URL and key and TEST_LOGIN_EMAIL / TEST_LOGIN_PASSWORD.");
  const auth = createClient(url, key, { auth: { persistSession: false } });
  const { data: session, error } = await auth.auth.signInWithPassword({ email, password });
  if (error || !session.session) throw new Error(`sign-in failed: ${error?.message}`);
  const token = session.session.access_token;
  const now = Date.now();

  for (const target of CLIENTS) {
    resetActiveClientForTests(target.key);
    const client = createClient(url, key, {
      db: { schema: target.schema },
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    }) as unknown as SupabaseClient;
    const listings = await allRows(client, "canvas_retail_listings");
    const index = await loadRetailerPrices(client as unknown as RetailerPriceClient, now);

    // Columns: the view's own worst_leakage / is_map_violation, cells from wmt_* / mf_*.
    const columnSide = listings.map((row) => ({
      ...row,
      retailers: columnCells(row),
      worst_leakage: num(row.worst_leakage),
      is_map_violation: row.is_map_violation === true,
    }));
    const columnIndex: RetailerPriceIndex = {
      retailers: index.retailers.filter((retailer) => columnSide.some((row) => row.retailers.some((cell) => cell.key === retailer.key))),
      byAsin: new Map(columnSide.map((row) => [row.asin, row.retailers])),
    };
    // Rows: the new read, computed in the app.
    const rowSide = withRetailerPrices(listings, index);

    const before = figures(columnSide, columnIndex, now);
    const after = figures(rowSide, index, now);
    const worstDiff = rowSide.filter((row, i) => row.worst_leakage !== columnSide[i].worst_leakage).length;
    const flagDiff = rowSide.filter((row, i) => row.is_map_violation !== columnSide[i].is_map_violation).length;
    const firstMiss = rowSide.flatMap((row) => row.retailers.filter((cell) => cell.firstMiss).map((cell) => `${row.asin} ${cell.name}`));
    // Every retailer cell whose price or gap differs, so a mismatch names its listing.
    const cellDiffs: string[] = [];
    rowSide.forEach((row, i) => {
      for (const key of new Set([...row.retailers, ...columnSide[i].retailers].map((cell) => cell.key))) {
        const a = columnSide[i].retailers.find((cell) => cell.key === key);
        const b = row.retailers.find((cell) => cell.key === key);
        if ((a?.price ?? null) !== (b?.price ?? null) || (a?.gap ?? null) !== (b?.gap ?? null)) {
          cellDiffs.push(
            `${row.asin} ${key}: columns ${a?.price ?? "-"} / ${a?.gap ?? "-"} (checked ${a?.checkedAt ?? "-"}), rows ${b?.price ?? "-"} / ${b?.gap ?? "-"} (checked ${b?.checkedAt ?? "-"})`,
          );
        }
      }
    });
    const linkedNow = rowSide.reduce(
      (n, row, i) =>
        n +
        row.retailers.filter(
          (cell) => cell.price != null && cell.url && !columnSide[i].retailers.find((old) => old.key === cell.key)?.url,
        ).length,
      0,
    );

    console.log(`\n### ${target.key} (${listings.length} listings, ${index.retailers.map((r) => r.key).join(", ")})\n`);
    console.log("| Figure | Columns | Rows | Match |");
    console.log("| --- | --- | --- | --- |");
    let mismatches = 0;
    for (const name of [...new Set([...Object.keys(before), ...Object.keys(after)])]) {
      const a = before[name] ?? null;
      const b = after[name] ?? null;
      const same = a === b;
      if (!same) mismatches += 1;
      console.log(`| ${name} | ${a} | ${b} | ${same ? "yes" : "**NO**"} |`);
    }
    console.log(`| Listings whose worst leakage differs from the view | | ${worstDiff} | ${worstDiff === 0 ? "yes" : "**NO**"} |`);
    console.log(`| Listings whose violation flag differs from the view | | ${flagDiff} | ${flagDiff === 0 ? "yes" : "**NO**"} |`);
    console.log(`\nRetailer cells that differ: ${cellDiffs.length ? cellDiffs.join("; ") : "none"}.`);
    console.log(`First-miss listings kept priced: ${firstMiss.length ? firstMiss.join("; ") : "none"}.`);
    console.log(`Retailer prices that now link to their checked page (no URL in the column read): ${linkedNow}.`);
    console.log(`Mismatches: ${mismatches + worstDiff + flagDiff}.`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
