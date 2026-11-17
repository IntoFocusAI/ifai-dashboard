/* Shared reference lists of public sites, keyed by the client settings' `vertical` (X-35, decision
   105, parity chunk C2). Each file in data/reference/ holds facts about the public site only (which
   kind of site a domain is, and which brand owns a brand website), never anything drawn from a
   client's answers, listings or prompts (X-16).

   all-verticals.json   sites every vertical shares (Amazon, YouTube, Reddit, Wikipedia)
   <vertical>.json      the vertical's retailers, publications, communities, reference sites and
                        brand websites

   A client whose vertical has no file reads only the shared sites and its own settings (owned
   domains, competitor domains), never another vertical's list. Stored site types
   (public.canvas_site_types) answer before any list here. Adding a vertical: write
   data/reference/<vertical>.json and add it to VERTICALS below. */

import allVerticals from "../../data/reference/all-verticals.json" with { type: "json" };
import lighting from "../../data/reference/lighting.json" with { type: "json" };
import musicInstruments from "../../data/reference/music_instruments.json" with { type: "json" };

/** The site kinds a reference file lists. Brand websites are listed separately with their brand. */
export const REFERENCE_SITE_CLASSES = ["retailer", "editorial", "community", "video", "reference"] as const;
export type ReferenceSiteClass = (typeof REFERENCE_SITE_CLASSES)[number];

export type ReferenceFile = {
  vertical: string | null;
  site_classes: Record<ReferenceSiteClass, string[]>;
  /** Brand website domain to the brand it belongs to. */
  brand_sites: Record<string, string>;
};

const SHARED = allVerticals as ReferenceFile;

const VERTICALS: Readonly<Record<string, ReferenceFile>> = {
  lighting: lighting as ReferenceFile,
  music_instruments: musicInstruments as ReferenceFile,
};

/** The reference file for a vertical, or null when the vertical has no list. */
export function verticalReference(vertical: string | null | undefined): ReferenceFile | null {
  if (!vertical) return null;
  return Object.hasOwn(VERTICALS, vertical) ? VERTICALS[vertical]! : null;
}

/** Verticals with a reference file. */
export function referenceVerticals(): string[] {
  return Object.keys(VERTICALS);
}

/** One kind's domains for a vertical: the shared sites, then the vertical's own. */
export function referenceDomains(vertical: string | null | undefined, kind: ReferenceSiteClass): string[] {
  const own = verticalReference(vertical)?.site_classes[kind] ?? [];
  return [...SHARED.site_classes[kind], ...own];
}

/** Brand websites listed for a vertical, as [domain, brand] pairs. Empty when the vertical has no list. */
export function referenceBrandSites(vertical: string | null | undefined): Array<[string, string]> {
  return Object.entries(verticalReference(vertical)?.brand_sites ?? {});
}

/** The same site or a subdomain of it: uk.fender.com matches fender.com, myfender.com does not. */
export function matchesDomain(domain: string, root: string): boolean {
  return domain === root || domain.endsWith(`.${root}`);
}
