// Loads the estimates fixtures: one row per listing, joined from the dashboard's canvas views as
// read on 17 Nov 2026 (the day the proposal's figures were read). ASINs are replaced by row ids.
import { readFileSync } from "node:fs";
import type { EstimateListingInput } from "../../../lib/estimates/types.ts";

type FixtureFile = { client: string; readOn: string; rankCategory: string; columns: string[]; rows: Array<Array<string | number | null>> };

export type FixtureListing = EstimateListingInput & {
  /** In canvas_listing_sales_loss_v2. */
  inSalesView: boolean;
  /** In canvas_retail_listings. */
  inRetailRead: boolean;
  /** canvas_spec_readiness.amazon_checked; null when the listing is not in that view. */
  specChecked: boolean | null;
};

export type EstimatesFixture = { client: string; readOn: string; rankCategory: string; listings: FixtureListing[] };

export function loadEstimatesFixture(client: "fender" | "ledlenser"): EstimatesFixture {
  const file = JSON.parse(readFileSync(new URL(`./${client}.json`, import.meta.url), "utf8")) as FixtureFile;
  const listings = file.rows.map((row): FixtureListing => {
    const r = Object.fromEntries(file.columns.map((c, i) => [c, row[i]])) as Record<string, string | number | null>;
    const num = (k: string) => (r[k] == null ? null : Number(r[k]));
    const flag = (k: string) => (r[k] == null ? null : r[k] === 1);
    return {
      asin: String(r.id),
      inSalesView: r.inSalesView === 1,
      inRetailRead: r.inRetailRead === 1,
      price: num("price"),
      smartscoutHasRecord: r.smartscoutHasRecord === 1,
      smartscoutTtmRevenue: num("smartscoutTtmRevenue"),
      smartscoutMonthlyUnits: num("smartscoutMonthlyUnits"),
      baselineDailyRevenue: num("baselineDailyRevenue"),
      missedSalesOos365: num("missedSalesOos365"),
      inStockDays365: num("inStockDays365"),
      inStockDays30: num("inStockDays30"),
      oosDays365: num("oosDays365"),
      noBuyBoxDays365: num("noBuyBoxDays365"),
      observedDays365: num("observedDays365"),
      salesRank: num("salesRank"),
      rankCategory: file.rankCategory,
      keepaMonthlySold: num("keepaMonthlySold"),
      amzLeakage: num("amzLeakage"),
      isBundle: flag("isBundle"),
      // The fixture keeps whether a parent exists, not which.
      parentAsin: r.hasParent === 1 ? "parent" : null,
      specChecked: flag("specChecked"),
      amazonCompletenessPct: r.specChecked === 1 ? num("amazonCompletenessPct") : null,
      aplusState: r.aplusState == null ? null : String(r.aplusState),
    };
  });
  return { client: file.client, readOn: file.readOn, rankCategory: file.rankCategory, listings };
}
