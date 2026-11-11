import type { CommandCenterSpec } from "@/lib/canvas-sdk/types";

/**
 * Offline fallback when the canvas read has not loaded.
 * Measured figures live in `buildLiveCommandCenter`. This copy does not state a count.
 */
export const fenderCommandCenter: CommandCenterSpec = {
  badge: "COMMAND CENTER · TODAY",
  title: "What do I need to worry about?",
  desc: "The highest-value moves across the monitored electric catalog, ranked by what they cost you while they sit open.",
  summary:
    "The retail headline and the published AI run load with the canvas read.",
  openByDefault: true,
  storageKey: "ifai:fender:command-center",
  items: [
    {
      id: "buybox-suppression",
      title: "The retail headline loads with the catalog read",
      why: "Suppressed Buy Boxes, MAP leakage, and unnested bundles are ranked from the stored retail read. The count and any missing coverage appear when that read finishes.",
      severity: "critical",
      spokeId: "ecommerce",
      subTab: "Retail Overview",
      defaultOwner: "intofocus",
    },
    {
      id: "schema-coverage",
      title: "fender.com pages are missing machine-readable specs",
      why: "Brand-Site Specs shows which fender.com product pages carry a spec block that AI engines can read as product data.",
      severity: "high",
      spokeId: "specs",
      subTab: "Brand-Site Specs",
      defaultOwner: "intofocus",
    },
    {
      id: "map-leakage",
      title: "Below-MAP listings load with the retail read",
      why: "The MAP Leakage tab states how many stored prices are below MAP. When that reading is partial, it also states what is still missing. Amazon, Walmart, and Musician's Friend appear only when this read stored a price for that channel.",
      impact: "The summary and the listing rows are the rows returned by the latest retail listing read.",
      severity: "high",
      spokeId: "ecommerce",
      subTab: "MAP Leakage",
      defaultOwner: "client",
    },
    {
      id: "aplus-tables",
      title: "Amazon listings are missing bullet copy",
      why: "The Amazon A+ Matrix tab shows which live listings fill all five bullets, and where A+ content and video are confirmed.",
      severity: "moderate",
      spokeId: "specs",
      subTab: "A+",
      defaultOwner: "intofocus",
    },
  ],
};
