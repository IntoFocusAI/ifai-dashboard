import { FMIC_CLIENT_KEY } from "@/lib/set-aside/keys";
import type { CommandCenterSpec } from "@/lib/canvas-sdk/types";
import { aiCommandSummary, aiPriorityItems } from "@/lib/ai-search/canvas-surfaces";
import type { AiSearchRead } from "@/lib/ai-search/types";
import { formatInt } from "@/lib/fender-canvas/format";
import { bulletCounts } from "@/lib/fender-canvas/listing-content";
import { specPageCounts } from "@/lib/fender-canvas/machine-readability";
import {
  headlineSentence,
  headlineSurface,
  type RetailCanvasRead,
} from "@/lib/fender-canvas/portfolio-retail-display";
import { MAP_PRICES_NOT_STORED } from "@/lib/fender-canvas/portfolio-retail";
import { mapReadLine } from "@/lib/fender-canvas/retail-copy";
import type { CanvasBundle } from "@/lib/fender-canvas/types";

const MAP_CHANNEL_WHY =
  "Open the MAP tab for the current below-MAP listings. Amazon, Walmart, and Musician's Friend appear only when this read stored a price for that channel. Any other retailer appears only when a stored price exists for that channel.";

const MAP_PRICES_NOT_STORED_WHY =
  "Fender MAP prices have not been stored. Amazon, Walmart, and Musician's Friend prices still show when a price is stored for that channel. A missing price stays blank.";

/** The MAP tab shows this sentence while the reading is unfinished or missing. */
function mapMissingSentence(retail: RetailCanvasRead): string | null {
  if (retail.phase !== "ready") return null;
  const reading = retail.snapshot.mapLeakage;
  const showMissing = reading.status === "incomplete" || reading.status === "unavailable";
  return showMissing ? reading.missingMessage : null;
}

function mapPriority(retail: RetailCanvasRead): { title: string; why: string } {
  if (retail.phase === "ready" && retail.snapshot.mapLeakage.missingMessage === MAP_PRICES_NOT_STORED) {
    return { title: MAP_PRICES_NOT_STORED, why: MAP_PRICES_NOT_STORED_WHY };
  }
  const title = mapReadLine(retail).replace(/\.$/, "");
  return { title, why: mapMissingSentence(retail) ?? MAP_CHANNEL_WHY };
}

/** Command center copy from the canvas reads. Unsourced counts are omitted. */
export function buildLiveCommandCenter(
  bundle: CanvasBundle,
  retail: RetailCanvasRead = { phase: "loading" },
  ai: AiSearchRead = { phase: "loading" },
): CommandCenterSpec {
  const { m, divisions } = bundle;
  const schemaPages = specPageCounts(bundle.specPages);
  const bullets = bulletCounts(bundle.listingContent);
  const divisionCount = divisions.length > 0 ? divisions.length : m.division_count;
  const headline = headlineSurface(retail);
  const mapItem = mapPriority(retail);
  const aiItems = aiPriorityItems(ai);
  const aiCritical = aiItems.filter((item) => item.severity === "critical");
  const aiOther = aiItems.filter((item) => item.severity !== "critical");

  const summaryParts = [headlineSentence(headline)];
  if (divisionCount != null) summaryParts.push(`The catalog read covers ${formatInt(divisionCount)} divisions.`);
  const aiLine = aiCommandSummary(ai);
  if (aiLine) summaryParts.push(aiLine);

  return {
    badge: "COMMAND CENTER · TODAY",
    title: "What do I need to worry about?",
    desc: "The highest-value moves across the monitored electric catalog, ranked by what they cost you while they sit open.",
    summary: summaryParts.join(" "),
    openByDefault: true,
    storageKey: "ifai:fender:command-center",
    setAsideClientKey: FMIC_CLIENT_KEY,
    items: [
      {
        id: "buybox-suppression",
        title: headline.countLabel ? `${headline.label}: ${headline.countLabel}` : headline.label,
        why: headline.missingMessage
          ? headline.missingMessage
          : `${headline.label} is the current retail headline${headline.countLabel ? `, with ${headline.countLabel}` : ""}.`,
        severity: "critical",
        spokeId: "ecommerce",
        subTab: headline.commandTab,
        defaultOwner: "intofocus",
      },
      ...aiCritical,
      {
        id: "schema-coverage",
        title: "fender.com pages are missing machine-readable specs",
        why: schemaPages
          ? `${formatInt(schemaPages.missingSpecBlock)} of ${formatInt(schemaPages.pages)} fender.com product pages have no spec block, so AI engines cannot read neck, pickup, and hardware specs there as product data.`
          : "The fender.com page read could not be loaded.",
        severity: "high",
        spokeId: "specs",
        subTab: "Brand-Site Specs",
        defaultOwner: "intofocus",
      },
      {
        id: "map-leakage",
        title: mapItem.title,
        why: mapItem.why,
        impact: "The summary and the listing rows are the rows returned by the latest retail listing read.",
        severity: "high",
        spokeId: "ecommerce",
        subTab: "MAP",
        defaultOwner: "client",
      },
      ...aiOther,
      {
        id: "aplus-tables",
        title: "Amazon listings are missing bullet copy",
        why: bullets
          ? `${formatInt(bullets.short)} of ${formatInt(bullets.listings)} live Amazon listings fill fewer than five bullets. Bullets are the first copy an AI shopping assistant quotes about a listing.`
          : "The Amazon listing-content read could not be loaded.",
        severity: "moderate",
        spokeId: "specs",
        subTab: "A+",
        defaultOwner: "intofocus",
      },
    ],
  };
}
