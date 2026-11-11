import { brandName, brandSite } from "@/lib/brand-copy";

/** Plain-language definitions for the jargon in the panel copy. The SDK marks
    the first mention of each term per panel and shows the definition on hover.
    Keep these in the register an e-commerce operator would use, and short
    enough to read without leaving the page. */
export const fenderGlossary: Record<string, string> = {
  "Buy Box":
    "Amazon also calls it the Featured Offer. The one-click Add to Cart button. Only one seller wins it. When nobody wins it, shoppers see other sellers listed and far fewer of them buy.",
  "Featured Offer":
    "Same as Buy Box. The one-click Add to Cart button on an Amazon listing. Amazon withholds it when the offer, including shipping, is above a benchmark from outside Amazon, even if the price is at MAP.",
  "Competitive External Price":
    "The lowest price Amazon recently found for this product outside its store. Amazon does not name that retailer. An offer above it, including shipping, can lose the Buy Box even at MAP.",
  MAP: "Minimum Advertised Price: the lowest price a retail partner has agreed to display publicly. Partners get around it by bundling a cheap accessory and discounting the pair.",
  "Brand Registry":
    `Amazon's brand-owner program. It lets ${brandName()} control its own listings and fold partner bundles in as variations of the official product.`,
  "Schema.org":
    "A shared vocabulary for publishing facts about a product in a form machines can read, rather than leaving them to guess from marketing copy.",
  "JSON-LD":
    "The block of machine-readable product facts embedded in a web page. It is what an AI engine reads when it needs a hard number like a fingerboard radius.",
  AEO: "Answer Engine Optimization: the technical discipline of making a product the one an AI assistant names when someone asks what to buy, rather than ranking in a list of blue links.",
  ASIN: "Amazon's product ID. Every listing has one, and a product split across several of them has its reviews split too.",
  "A+ Content":
    "Amazon's enhanced product modules, including comparison tables. Amazon's own shopping AI and the frontier models read those tables directly.",
  "Share of Voice":
    "How often a brand is the one an AI engine actually names, out of all the answers it gives in that category.",
  SOV: "Short for Share of Voice: how often a brand is the one an AI engine actually names in a category.",
  DTC: `Direct-to-consumer: ${brandName()}'s own storefront at ${brandSite()}, as opposed to selling through Amazon or a dealer.`,
  Hallucination:
    `An AI engine confidently stating something that is not true. Here, that means quoting specs scraped off a third-party bundle page rather than from ${brandName()}.`,
  "AI Scan Index":
    `Out of 100, how often AI assistants like ChatGPT and Perplexity name ${brandName()} when shoppers ask what to buy. It moves day to day as the models update, so read it as a trend rather than something you steer directly.`,
  "Readiness Score":
    `How much of what AI engines and Amazon read about ${brandName()} (specs, listings, reviews) is in good shape. Unlike the scan, every fix you ship moves this number.`,
  Keepa:
    "A service that records Amazon price, stock, and sales-rank history for each listing, day by day. Used here for which days a listing was in or out of stock.",
  SmartScout:
    "A service that estimates Amazon sales and revenue per listing from public signals. Its figures are estimates, not Amazon's reported sales.",
  "1P": `First-party: ${brandName()} selling directly, including through Amazon Retail.`,
  "3P": `Third-party: an authorized partner or reseller selling ${brandName()} products under its own account.`,
};
