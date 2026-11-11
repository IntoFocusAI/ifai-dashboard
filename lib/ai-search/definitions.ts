import { brandName, isFenderClient, leadBrand, leadBrandOr } from "@/lib/brand-copy";

/** Plain-language definitions shown on the dotted AI Search terms. */
export const AI_DEFINITIONS = {
  "Fender lead":
    `An answer where ${leadBrandOr()} is named more often than any competitor brand, counted by whole-word brand mentions. It measures mention share. It does not prove the engine recommended a specific ${brandName()} product.`,
  "unbranded discovery":
    "A shopping question that does not name a brand or a model line. The shopper asks what to buy, and the engine chooses which brands to name.",
  "branded consideration":
    `A shopping question that names ${isFenderClient() ? "Fender, Squier," : brandName()} or a rival and asks whether that product is a good buy, or which of the named options to choose.`,
  "brand-associated discovery":
    `A shopping question that names a brand or a model line${isFenderClient() ? ", such as Stratocaster," : ""} while still asking what to buy. It is counted on its own, not inside unbranded discovery.`,
  "shopping guidance":
    "A question about how to shop, such as what to spend, rather than which product to buy. It is left out of the discovery and consideration rates.",
  "product-fact question":
    "A question about how a named product is built or how two models differ. These prompts are stored with the shopping prompts, and they are left out of the discovery and consideration rates. They are not the separate product fact checks.",
  resolved:
    `A commercial answer with a clear leader: ${leadBrand()} or one competitor is named most. Answers with no clear leader and provider errors are not in the denominator.`,
  "no clear leader":
    "The answer did not name one brand more than the others. It is neither a win nor a loss, and it is reported on its own line.",
  "provider error":
    "The AI engine failed to return an answer for this call. It is neither a win nor a loss, and it is reported on its own line.",
  "product fact check":
    `A factual question about a ${brandName()} product, sent on purpose to check an answer against a fact IntoFocus verified on an official ${brandName()} page. These are not buying prompts, so they never count toward win rates or competitor share.`,
  "shopping answer": "A usable response from one AI engine to one shopping prompt.",
  "cited link":
    "A web URL the AI engine explicitly returned with its answer. It does not prove that the source caused or endorsed the recommendation.",
  association:
    "A stored answer and a page that answer cited, shown together. The link records that the engine cited the page. It does not show that the page caused the engine to name another brand.",
  "Fender-owned": `A cited site controlled by ${isFenderClient() ? "Fender or another FMIC brand" : brandName()}, classified by IntoFocus.`,
  "top cited sites":
    "Each site is ranked by how many answers in the selected period cite it at least once, and ties go to the site with more cited links.",
  "top cited sites by links":
    "Each site is ranked by how many cited links in the selected period point to it, and ties go to the site cited in more answers.",
  "partial run":
    "The run was published with some calls unanswered. Every figure covers the answered calls only, and the unanswered calls are listed.",
  "published run":
    "The one audit run IntoFocus has published as current. The map stays on that run. AI Search tabs follow the run control, which starts on the published runs from the last 30 days. The published run itself is not a blend of those runs.",
  "question set":
    "The full list of questions sent in one AI Search run. A change means a later run asked a different list, so the rates on each side are not one continuous series.",
  "query version":
    "One exact wording of a question. Editing the wording starts a new version. A trend for one version includes only runs that asked that wording.",
  "confirmed contradiction":
    `The answer contradicts a fact IntoFocus verified on a ${brandName()} page, and the stored evidence quotes the conflicting text.`,
  "no contradiction found":
    `The answer was compared with one verified ${brandName()} fact and nothing in it contradicted that fact. It does not prove every statement in the answer is accurate.`,
  "source class":
    "IntoFocus's grouping of a cited domain as brand-owned, retailer, editorial, community, video, or other.",
  "canonical URL":
    "The cited link with tracking parameters, page fragments, and www removed, so the same page counts once per answer.",
  "small sample":
    "The percentage describes this run exactly, but it is based on relatively few answers or substantially fewer answers than another row beside it. A few additional answers could move it sharply, so do not treat it as a stable ranking.",
} as const;

export type AiTermKey = keyof typeof AI_DEFINITIONS;
