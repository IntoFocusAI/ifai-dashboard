import { formatInt } from "@/lib/fender-canvas/format";
import { classifySource, isValidCitationUrl, type SourceClass } from "@/lib/ai-search/citations";
import { brandName, leadBrand } from "@/lib/brand-copy";
import { brandMention } from "@/lib/ai-search/brand-words";

/* Why another brand led one answer, for any client: the stored answer and its cited pages only.
   The client brand's names come from brand_name_terms in the client settings. */

export type WhyNotPage = { href: string; label: string; owner: string };

export type WhyNotBrandView = {
  /** True or false once the stored answer is read; null while it is loading or missing. */
  brandMentioned: boolean | null;
  /** One plain sentence built only from the stored answer and its cited pages. */
  summary: string;
  answer: string | null;
  pages: WhyNotPage[];
};

/**
 * Pooled evidence ids are `${audit_run_id}:${call.id}`.
 * Those ids are not rows in the current-run answer view, so they are not queried.
 */
export function answerLookupId(id: string): string | null {
  if (id.includes(":")) return null;
  return id;
}

function hostOf(href: string): string {
  try {
    return new URL(href).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function brandKey(brand: string): string {
  return brand.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function ownerLabel(sourceClass: SourceClass, domain: string, winner: string | null): string {
  if (sourceClass === "fender_owned") return brandName();
  if (sourceClass === "competitor_brand") {
    if (winner && brandKey(domain).includes(brandKey(winner))) return `${winner} site`;
    return "Other brand site";
  }
  if (sourceClass === "retailer") return "Retailer";
  if (sourceClass === "editorial") return "Review site";
  if (sourceClass === "community") return "Forum";
  if (sourceClass === "video") return "Video";
  if (sourceClass === "reference") return "Reference";
  return "Other site";
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function summarize(winner: string | null, mentioned: boolean | null, pages: WhyNotPage[]): string {
  const named = winner ? `${winner} was named most.` : "Another brand was named most.";
  const mention =
    mentioned === null ? "" : mentioned ? ` ${leadBrand()} was mentioned, but named less often.` : ` ${leadBrand()} was not mentioned.`;
  if (pages.length === 0) return `${named}${mention} No cited page was stored.`;
  const brand = brandName();
  const owned = pages.filter((page) => page.owner === brand).length;
  const winnerSite = winner ? pages.filter((page) => page.owner === `${winner} site`).length : 0;
  const cited =
    pages.length === 1
      ? `Its one cited page ${owned === 1 ? "is" : "is not"} a ${brand} page.`
      : owned === 0
        ? `None of its ${formatInt(pages.length)} cited pages is a ${brand} page.`
        : `${formatInt(owned)} of its ${plural(pages.length, "cited page", "cited pages")} ${owned === 1 ? `is a ${brand} page` : `are ${brand} pages`}.`;
  const rival = winnerSite > 0 ? ` ${winnerSite} ${winnerSite === 1 ? "is" : "are"} on ${winner}'s own site.` : "";
  return `${named}${mention} ${cited}${rival}`;
}

/** Stored answer text and stored http(s) pages only. Facts about the answer, no inferred reason. */
export function whyNotBrand(input: {
  answerText: string | null | undefined;
  winner?: string | null;
  pages: ReadonlyArray<{ href: string | null | undefined; label: string | null | undefined }>;
}): WhyNotBrandView {
  const answer = input.answerText?.trim() || null;
  const winner = input.winner?.trim() || null;
  const pages: WhyNotPage[] = [];
  const seen = new Set<string>();
  for (const page of input.pages) {
    const href = page.href?.trim() ?? "";
    if (!isValidCitationUrl(href) || seen.has(href)) continue;
    seen.add(href);
    const domain = hostOf(href);
    pages.push({ href, label: page.label?.trim() || href, owner: ownerLabel(classifySource(domain), domain, winner) });
  }
  const brandMentioned = answer === null ? null : brandMention().test(answer);
  return { brandMentioned, summary: summarize(winner, brandMentioned, pages), answer, pages };
}
